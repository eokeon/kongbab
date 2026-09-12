package com.kongbab.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kongbab.domain.AppConfig;
import com.kongbab.dto.StreamerDto;
import com.kongbab.dto.VideoDto;
import com.kongbab.repository.AppConfigRepository;
import com.kongbab.service.StreamerService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Slf4j
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class BackupController {

    private static final String CONFIG_KEY_STRUCTURE = "category_structure";
    private static final Path FIXED_BACKUP_PATH = Paths.get("D:", "\uBC31\uC5C5 \uD30C\uC77C", "KONGBAB_BACKUPS_JSON");

    private final AppConfigRepository appConfigRepository;
    private final StreamerService streamerService;
    private final ObjectMapper objectMapper;

    @Value("${kongbab.backup.directory:}")
    private String backupDirectory;

    @Value("${kongbab.backup.max-count:20}")
    private int maxBackups;

    private static final DateTimeFormatter FILE_DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss");

    private File getTargetDir() {
        File dir;
        if (backupDirectory != null && !backupDirectory.trim().isEmpty() 
                && (backupDirectory.contains("\uBC31\uC5C5") || backupDirectory.contains("백업"))) {
            dir = new File(backupDirectory.trim());
        } else {
            dir = FIXED_BACKUP_PATH.toFile();
        }

        if (!dir.exists()) {
            dir.mkdirs();
        }
        return dir;
    }

    @GetMapping("/config/structure")
    public ResponseEntity<Map<String, Object>> getCategoryStructure() {
        Map<String, Object> res = new HashMap<>();
        try {
            // 1. MariaDB app_config 테이블 우선 조회
            Optional<AppConfig> configOpt = appConfigRepository.findById(CONFIG_KEY_STRUCTURE);
            if (configOpt.isPresent() && configOpt.get().getConfigValue() != null && !configOpt.get().getConfigValue().isBlank()) {
                JsonNode node = objectMapper.readTree(configOpt.get().getConfigValue());
                res.put("success", true);
                res.put("categories", node);
                res.put("source", "mariadb");
                return ResponseEntity.ok(res);
            }

            // 2. DB에 없으면 backup.json 또는 streamers.json 파일에서 복원 시도
            File dir = getTargetDir();
            Path latestPath = Paths.get(dir.getAbsolutePath(), "backup.json");
            Path staticPath = Paths.get("src", "main", "resources", "static", "streamers.json");

            Path candidatePath = Files.exists(latestPath) ? latestPath : (Files.exists(staticPath) ? staticPath : null);
            if (candidatePath != null) {
                String content = Files.readString(candidatePath, StandardCharsets.UTF_8);
                if (content != null && content.startsWith("\uFEFF")) {
                    content = content.substring(1);
                }
                JsonNode root = objectMapper.readTree(content);
                JsonNode categories = null;
                if (root.has("categories") && root.get("categories").isArray() && root.get("categories").size() > 0) {
                    categories = root.get("categories");
                } else if (root.isArray() && root.size() > 0) {
                    JsonNode first = root.get(0);
                    if (first.has("hasSubgroups") || first.has("groups") || first.has("color")) {
                        categories = root;
                    }
                }
                if (categories != null && categories.isArray() && categories.size() > 0) {
                    saveCategoriesToDb(categories.toString());
                    res.put("success", true);
                    res.put("categories", categories);
                    res.put("source", "backup_file");
                    return ResponseEntity.ok(res);
                }
            }
        } catch (Exception e) {
            log.warn("카테고리/조직 구조 불러오기 실패: {}", e.getMessage());
        }

        res.put("success", true);
        res.put("categories", Collections.emptyList());
        return ResponseEntity.ok(res);
    }

    @PostMapping("/config/structure")
    public ResponseEntity<Map<String, Object>> saveCategoryStructure(@RequestBody String payload) {
        Map<String, Object> res = new HashMap<>();
        try {
            JsonNode root = objectMapper.readTree(payload);
            JsonNode categoriesNode = root.has("categories") ? root.get("categories") : root;
            String categoriesJson = objectMapper.writeValueAsString(categoriesNode);

            saveCategoriesToDb(categoriesJson);

            res.put("success", true);
            res.put("message", "조직 및 카테고리 순서가 DB에 성공적으로 저장되었습니다.");
            return ResponseEntity.ok(res);
        } catch (Exception e) {
            log.error("카테고리/조직 구조 저장 실패", e);
            res.put("success", false);
            res.put("error", e.getMessage());
            return ResponseEntity.internalServerError().body(res);
        }
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus() {
        File dir = getTargetDir();
        File[] files = dir.listFiles((d, name) -> name.startsWith("kongbab_backup_") && name.endsWith(".json"));
        List<String> fileNames = new ArrayList<>();
        if (files != null) {
            Arrays.sort(files, Comparator.comparing(File::getName).reversed());
            for (File f : files) {
                fileNames.add(f.getName());
            }
        }

        Map<String, Object> res = new HashMap<>();
        res.put("status", "ok");
        res.put("directory", dir.getAbsolutePath());
        res.put("maxBackups", maxBackups);
        res.put("count", fileNames.size());
        res.put("files", fileNames);
        return ResponseEntity.ok(res);
    }

    @GetMapping("/backup/list")
    public ResponseEntity<Map<String, Object>> getBackupList() {
        File dir = getTargetDir();
        File[] files = dir.listFiles((d, name) -> name.startsWith("kongbab_backup_") && name.endsWith(".json"));
        List<Map<String, Object>> backupItems = new ArrayList<>();

        if (files != null) {
            Arrays.sort(files, Comparator.comparing(File::getName).reversed());
            for (File f : files) {
                Map<String, Object> item = new HashMap<>();
                item.put("fileName", f.getName());
                item.put("fileSizeBytes", f.length());
                item.put("fileSizeFormatted", formatFileSize(f.length()));
                item.put("lastModified", f.lastModified());

                try {
                    String content = Files.readString(f.toPath(), StandardCharsets.UTF_8);
                    JsonNode root = objectMapper.readTree(content);
                    item.put("createdAt", root.has("createdAt") ? root.get("createdAt").asText() : formatDate(f.lastModified()));
                    item.put("reason", root.has("reason") ? root.get("reason").asText() : "데이터 백업");
                    if (root.has("stats")) {
                        JsonNode stats = root.get("stats");
                        item.put("totalMembers", stats.has("totalMembers") ? stats.get("totalMembers").asInt() : 0);
                        item.put("totalVideos", stats.has("totalVideos") ? stats.get("totalVideos").asInt() : 0);
                        item.put("totalCategories", stats.has("totalCategories") ? stats.get("totalCategories").asInt() : 0);
                    } else {
                        item.put("totalMembers", 0);
                        item.put("totalVideos", 0);
                    }
                } catch (Exception e) {
                    item.put("createdAt", formatDate(f.lastModified()));
                    item.put("reason", "백업 파일");
                    item.put("totalMembers", 0);
                    item.put("totalVideos", 0);
                }
                backupItems.add(item);
            }
        }

        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("directory", dir.getAbsolutePath());
        res.put("maxBackups", maxBackups);
        res.put("count", backupItems.size());
        res.put("backups", backupItems);
        return ResponseEntity.ok(res);
    }

    @PostMapping("/backup/restore")
    public ResponseEntity<Map<String, Object>> restoreBackup(@RequestBody Map<String, String> request) {
        String fileName = request.get("fileName");
        String directContent = request.get("content");
        Map<String, Object> res = new HashMap<>();

        try {
            String jsonContent;
            if (directContent != null && !directContent.isBlank()) {
                jsonContent = directContent;
            } else if (fileName != null && !fileName.isBlank()) {
                if (fileName.contains("..") || fileName.contains("/") || fileName.contains("\\")) {
                    res.put("success", false);
                    res.put("message", "유효하지 않은 파일 이름입니다.");
                    return ResponseEntity.badRequest().body(res);
                }
                File dir = getTargetDir();
                File targetFile = new File(dir, fileName);
                if (!targetFile.exists()) {
                    res.put("success", false);
                    res.put("message", "백업 파일을 찾을 수 없습니다: " + fileName);
                    return ResponseEntity.status(404).body(res);
                }
                jsonContent = Files.readString(targetFile.toPath(), StandardCharsets.UTF_8);
            } else {
                res.put("success", false);
                res.put("message", "복원할 파일명 또는 백업 내용이 지정되지 않았습니다.");
                return ResponseEntity.badRequest().body(res);
            }

            if (jsonContent != null && jsonContent.startsWith("\uFEFF")) {
                jsonContent = jsonContent.substring(1);
            }
            JsonNode root = objectMapper.readTree(jsonContent);
            JsonNode categoriesNode = root.has("categories") ? root.get("categories") : (root.isArray() ? root : null);

            if (categoriesNode == null || !categoriesNode.isArray()) {
                res.put("success", false);
                res.put("message", "올바른 백업 JSON 형식이 아닙니다 (카테고리 정보 없음).");
                return ResponseEntity.badRequest().body(res);
            }

            // 1. 카테고리 구조 저장
            String cleanStructureJson = extractCleanCategoryStructure(categoriesNode);
            saveCategoriesToDb(cleanStructureJson);

            // 2. 카테고리 트리에서 스트리머 목록 추출 후 MariaDB 일괄 동기화
            List<StreamerDto> streamerDtoList = extractStreamersFromCategoriesNode(categoriesNode);
            if (!streamerDtoList.isEmpty()) {
                streamerService.syncStreamers(streamerDtoList);
            }

            // 복원된 전체 백업 json을 static 및 docs의 streamers.json에도 즉시 동기화
            List<Path> targets = List.of(
                    Paths.get("src", "main", "resources", "static", "streamers.json"),
                    Paths.get("build", "resources", "main", "static", "streamers.json"),
                    Paths.get("docs", "streamers.json")
            );
            for (Path p : targets) {
                try {
                    if (Files.exists(p.getParent())) {
                        Files.writeString(p, jsonContent, StandardCharsets.UTF_8);
                    }
                } catch (Exception ignored) {}
            }

            res.put("success", true);
            res.put("message", "백업 데이터가 성공적으로 복원되었습니다.");
            res.put("categories", categoriesNode);
            res.put("streamerCount", streamerDtoList.size());
            return ResponseEntity.ok(res);
        } catch (Exception e) {
            log.error("백업 복원 실패", e);
            res.put("success", false);
            res.put("error", e.getMessage());
            return ResponseEntity.internalServerError().body(res);
        }
    }

    @GetMapping("/backup/download/{fileName}")
    public ResponseEntity<byte[]> downloadBackup(@PathVariable String fileName) {
        if (fileName.contains("..") || fileName.contains("/") || fileName.contains("\\")) {
            return ResponseEntity.badRequest().build();
        }
        File dir = getTargetDir();
        File file = new File(dir, fileName);
        if (!file.exists()) {
            return ResponseEntity.notFound().build();
        }
        try {
            byte[] bytes = Files.readAllBytes(file.toPath());
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(bytes);
        } catch (IOException e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    @PostMapping("/backup")
    public ResponseEntity<Map<String, Object>> saveBackup(@RequestBody String payload) {
        try {
            File dir = getTargetDir();
            String timestamp = LocalDateTime.now().format(FILE_DATE_FORMATTER);
            String fileName = "kongbab_backup_" + timestamp + ".json";

            Path backupPath = Paths.get(dir.getAbsolutePath(), fileName);
            Path latestPath = Paths.get(dir.getAbsolutePath(), "backup.json");

            Files.writeString(backupPath, payload, StandardCharsets.UTF_8);
            Files.writeString(latestPath, payload, StandardCharsets.UTF_8);

            // static 및 docs, build 폴더의 streamers.json에도 최신 백업 데이터(순서 포함) 자동 동기화
            List<Path> targets = List.of(
                    Paths.get("src", "main", "resources", "static", "streamers.json"),
                    Paths.get("build", "resources", "main", "static", "streamers.json"),
                    Paths.get("docs", "streamers.json")
            );
            for (Path p : targets) {
                try {
                    if (Files.exists(p.getParent())) {
                        Files.writeString(p, payload, StandardCharsets.UTF_8);
                    }
                } catch (Exception ignored) {}
            }

            cleanOldBackups(dir);

            File[] currentFiles = dir.listFiles((d, name) -> name.startsWith("kongbab_backup_") && name.endsWith(".json"));
            int count = currentFiles != null ? currentFiles.length : 1;

            Map<String, Object> res = new HashMap<>();
            res.put("success", true);
            res.put("fileName", fileName);
            res.put("directory", dir.getAbsolutePath());
            res.put("count", count);

            return ResponseEntity.ok(res);
        } catch (IOException e) {
            Map<String, Object> err = new HashMap<>();
            err.put("success", false);
            err.put("error", e.getMessage());
            return ResponseEntity.internalServerError().body(err);
        }
    }

    private List<StreamerDto> extractStreamersFromCategoriesNode(JsonNode categoriesNode) {
        List<StreamerDto> list = new ArrayList<>();
        if (categoriesNode == null || !categoriesNode.isArray()) return list;

        // 혹시 categoriesNode 자체가 streamers 배열인 경우
        if (categoriesNode.size() > 0 && categoriesNode.get(0).has("streamer")) {
            for (JsonNode sNode : categoriesNode) {
                try {
                    StreamerDto dto = objectMapper.treeToValue(sNode, StreamerDto.class);
                    if (dto != null && dto.getId() != null) {
                        list.add(dto);
                    }
                } catch (Exception ignored) {}
            }
            return list;
        }

        Map<String, StreamerDto> map = new LinkedHashMap<>();
        int globalOrder = 0;

        for (JsonNode cat : categoriesNode) {
            String catId = cat.has("id") ? cat.get("id").asText() : "";
            boolean hasSubgroups = cat.has("hasSubgroups") && cat.get("hasSubgroups").asBoolean();

            if (hasSubgroups && cat.has("groups") && cat.get("groups").isArray()) {
                for (JsonNode g : cat.get("groups")) {
                    String gId = g.has("id") ? g.get("id").asText() : "";
                    if (g.has("members") && g.get("members").isArray()) {
                        for (JsonNode m : g.get("members")) {
                            addMemberNodeToMap(map, m, catId, gId, globalOrder++);
                        }
                    }
                }
            } else if (cat.has("members") && cat.get("members").isArray()) {
                for (JsonNode m : cat.get("members")) {
                    addMemberNodeToMap(map, m, catId, null, globalOrder++);
                }
            }
        }

        return new ArrayList<>(map.values());
    }

    private void addMemberNodeToMap(Map<String, StreamerDto> map, JsonNode m, String catId, String gId, int defaultOrder) {
        String id = m.has("id") ? m.get("id").asText() : null;
        if (id == null || id.isBlank()) return;

        if (!map.containsKey(id)) {
            StreamerDto dto = new StreamerDto();
            dto.setId(id);
            dto.setName(m.has("name") ? m.get("name").asText() : "");
            dto.setStreamer(m.has("streamer") ? m.get("streamer").asText() : "");
            dto.setCategory(catId);
            dto.setSubgroup(gId);
            dto.setRole(m.has("role") ? m.get("role").asText() : "");
            dto.setSwatRole(m.has("swatRole") ? m.get("swatRole").asText() : "");
            dto.setBadgeColor(m.has("badgeColor") ? m.get("badgeColor").asText() : "bg-zinc-800");
            dto.setAvatar(m.has("avatar") ? m.get("avatar").asText() : "assets/default-avatar.svg");
            dto.setDisplayOrder(m.has("displayOrder") ? m.get("displayOrder").asInt() : defaultOrder);
            if (m.has("subscriberCount") && !m.get("subscriberCount").isNull()) {
                dto.setSubscriberCount(m.get("subscriberCount").asText());
            }
            if (m.has("youtubeUrl") && !m.get("youtubeUrl").isNull()) {
                dto.setYoutubeUrl(m.get("youtubeUrl").asText());
            }

            if (m.has("affiliations")) {
                dto.setAffiliations(m.get("affiliations").toString());
            } else {
                dto.setAffiliations("[{\"category\":\"" + catId + "\",\"subgroup\":" + (gId != null ? "\"" + gId + "\"" : "null") + "}]");
            }

            List<VideoDto> videos = new ArrayList<>();
            if (m.has("videos") && m.get("videos").isArray()) {
                for (JsonNode v : m.get("videos")) {
                    try {
                        VideoDto vDto = objectMapper.treeToValue(v, VideoDto.class);
                        if (vDto != null) videos.add(vDto);
                    } catch (Exception ignored) {}
                }
            }
            dto.setVideos(videos);
            map.put(id, dto);
        }
    }

    private String extractCleanCategoryStructure(JsonNode categoriesNode) {
        try {
            List<Map<String, Object>> cleanList = new ArrayList<>();
            for (JsonNode cat : categoriesNode) {
                Map<String, Object> catMap = new LinkedHashMap<>();
                catMap.put("id", cat.has("id") ? cat.get("id").asText() : "");
                catMap.put("name", cat.has("name") ? cat.get("name").asText() : "");
                catMap.put("emoji", cat.has("emoji") ? cat.get("emoji").asText() : "");
                boolean hasSubgroups = cat.has("hasSubgroups") && cat.get("hasSubgroups").asBoolean();
                catMap.put("hasSubgroups", hasSubgroups);

                List<Map<String, Object>> groupList = new ArrayList<>();
                if (hasSubgroups && cat.has("groups") && cat.get("groups").isArray()) {
                    for (JsonNode g : cat.get("groups")) {
                        Map<String, Object> gMap = new LinkedHashMap<>();
                        gMap.put("id", g.has("id") ? g.get("id").asText() : "");
                        gMap.put("name", g.has("name") ? g.get("name").asText() : "");
                        gMap.put("emoji", g.has("emoji") ? g.get("emoji").asText() : "");
                        groupList.add(gMap);
                    }
                }
                catMap.put("groups", groupList);
                cleanList.add(catMap);
            }
            return objectMapper.writeValueAsString(cleanList);
        } catch (Exception e) {
            return "[]";
        }
    }

    private String formatFileSize(long bytes) {
        if (bytes < 1024) return bytes + " B";
        int exp = (int) (Math.log(bytes) / Math.log(1024));
        char pre = "KMGTPE".charAt(exp - 1);
        return String.format(Locale.KOREA, "%.1f %sB", bytes / Math.pow(1024, exp), pre);
    }

    private String formatDate(long millis) {
        return LocalDateTime.ofInstant(java.time.Instant.ofEpochMilli(millis), java.time.ZoneId.of("Asia/Seoul"))
                .format(DateTimeFormatter.ofPattern("yyyy.MM.dd HH:mm:ss"));
    }

    private void saveCategoriesToDb(String categoriesJson) {
        try {
            AppConfig config = appConfigRepository.findById(CONFIG_KEY_STRUCTURE)
                    .orElseGet(() -> AppConfig.builder().configKey(CONFIG_KEY_STRUCTURE).build());
            config.setConfigValue(categoriesJson);
            appConfigRepository.save(config);
            log.info("카테고리/조직 구조가 MariaDB app_config에 영구 저장되었습니다.");
        } catch (Exception e) {
            log.error("MariaDB 카테고리 설정 저장 실패", e);
        }
    }

    private void cleanOldBackups(File dir) {
        File[] files = dir.listFiles((d, name) -> name.startsWith("kongbab_backup_") && name.endsWith(".json"));
        if (files != null && files.length > maxBackups) {
            Arrays.sort(files, Comparator.comparing(File::getName));
            int excess = files.length - maxBackups;
            for (int i = 0; i < excess; i++) {
                files[i].delete();
            }
        }
    }
}
