package com.kongbap.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.kongbap.domain.Video;
import com.kongbap.dto.StreamerDto;
import com.kongbap.dto.VideoDto;
import com.kongbap.repository.VideoRepository;
import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.web.client.RestClient;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.*;

import static org.junit.jupiter.api.Assertions.assertTrue;

@org.junit.jupiter.api.Disabled("배치 동기화용 수동 실행 테스트")
@SpringBootTest
public class BatchViewCountSyncTest {

    private static final Logger log = LoggerFactory.getLogger(BatchViewCountSyncTest.class);

    @Autowired
    private YouTubeService youTubeService;

    @Autowired
    private ChzzkService chzzkService;

    @Autowired
    private StreamerService streamerService;

    @Autowired
    private VideoRepository videoRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Value("${youtube.api.key:AIzaSyCaWTqIMqfGvXE8-Wg4FpYxvAW-qRWYDYA}")
    private String youtubeApiKey;

    private static final String STATIC_JSON_PATH = "src/main/resources/static/streamers.json";
    private static final String DOCS_JSON_PATH = "docs/streamers.json";
    private static final String BACKUP_JSON_PATH = "D:/백업 파일/KONGBAP_BACKUPS_JSON/backup.json";

    @Test
    void patchRemainingChzzk() throws Exception {
        Map<Long, Long> chzzkMap = Map.ofEntries(
                Map.entry(7532103L, 1262L),
                Map.entry(7548798L, 1467L),
                Map.entry(7563905L, 1581L),
                Map.entry(7580739L, 998L),
                Map.entry(7611813L, 4509L),
                Map.entry(7629058L, 3145L),
                Map.entry(7644498L, 8839L),
                Map.entry(7654593L, 3654L),
                Map.entry(7659412L, 2749L),
                Map.entry(7418115L, 845L),
                Map.entry(7437378L, 2497L),
                Map.entry(7451514L, 3268L),
                Map.entry(7467347L, 3873L),
                Map.entry(7467185L, 5104L),
                Map.entry(7580717L, 2472L)
        );

        File jsonFile = new File(STATIC_JSON_PATH);
        JsonNode root = objectMapper.readTree(jsonFile);
        List<ObjectNode> allVideoNodes = new ArrayList<>();
        Set<String> dummyYt = new HashSet<>();
        Set<Long> dummyChzzk = new HashSet<>();
        JsonNode categories = root.path("categories");
        if (categories.isArray()) {
            for (JsonNode cat : categories) {
                JsonNode groups = cat.path("groups");
                if (groups.isArray()) {
                    for (JsonNode g : groups) {
                        JsonNode members = g.path("members");
                        if (members.isArray()) {
                            collectVideos(members, allVideoNodes, dummyYt, dummyChzzk);
                        }
                    }
                }
                JsonNode members = cat.path("members");
                if (members.isArray()) {
                    collectVideos(members, allVideoNodes, dummyYt, dummyChzzk);
                }
            }
        }

        int patched = 0;
        for (ObjectNode vNode : allVideoNodes) {
            String url = vNode.path("url").asText("");
            Long cNo = chzzkService.extractVideoNo(url);
            if (cNo != null && chzzkMap.containsKey(cNo)) {
                vNode.put("viewCount", chzzkMap.get(cNo));
                patched++;
            }
        }
        log.info("✓ 치지직 15개 영상 viewCount 주입 완료: {}개", patched);

        byte[] updatedJsonBytes = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(root);
        Files.write(Path.of(STATIC_JSON_PATH), updatedJsonBytes);
        Files.write(Path.of(DOCS_JSON_PATH), updatedJsonBytes);
        Path backupDir = Path.of("D:/백업 파일/KONGBAP_BACKUPS_JSON");
        if (Files.exists(backupDir)) {
            Files.write(Path.of(BACKUP_JSON_PATH), updatedJsonBytes);
        }

        List<StreamerDto> dtoList = parseAllStreamers(root);
        if (dtoList != null && !dtoList.isEmpty()) {
            streamerService.syncStreamers(dtoList);
            log.info("✓ MariaDB DB 동기화 완료 (총 {}명)", dtoList.size());
        }
    }

    @org.junit.jupiter.api.Disabled("전체 일괄 수집 완료됨")
    @Test
    void syncAllVideoViewCounts() throws Exception {
        File jsonFile = new File(STATIC_JSON_PATH);
        assertTrue(jsonFile.exists(), "streamers.json 파일이 존재해야 합니다.");

        JsonNode root = objectMapper.readTree(jsonFile);
        JsonNode categories = root.path("categories");

        List<ObjectNode> allVideoNodes = new ArrayList<>();
        Set<String> uniqueYtIds = new LinkedHashSet<>();
        Set<Long> uniqueChzzkNos = new LinkedHashSet<>();

        // 1. 모든 영상 노드 수집 및 고유 ID 분류
        if (categories.isArray()) {
            for (JsonNode cat : categories) {
                JsonNode groups = cat.path("groups");
                if (groups.isArray()) {
                    for (JsonNode g : groups) {
                        JsonNode members = g.path("members");
                        if (members.isArray()) {
                            collectVideos(members, allVideoNodes, uniqueYtIds, uniqueChzzkNos);
                        }
                    }
                }
                JsonNode members = cat.path("members");
                if (members.isArray()) {
                    collectVideos(members, allVideoNodes, uniqueYtIds, uniqueChzzkNos);
                }
            }
        }

        log.info("==================================================");
        log.info("📊 전체 등록 영상 수: {}개", allVideoNodes.size());
        log.info("🔴 유튜브 고유 영상 수: {}개", uniqueYtIds.size());
        log.info("🟢 치지직 고유 영상 수: {}개", uniqueChzzkNos.size());
        log.info("==================================================");

        // 2. 유튜브 영상 조회수 일괄 수집 (50개 단위 배치 호출)
        Map<String, Long> ytViewCounts = new ConcurrentHashMap<>();
        List<String> ytIdList = new ArrayList<>(uniqueYtIds);
        RestClient restClient = RestClient.builder()
                .defaultHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
                .build();

        log.info("🚀 유튜브 조회수 일괄 수집 시작 (총 {}개 배치 요청 예상)...", (ytIdList.size() + 49) / 50);
        long startTime = System.currentTimeMillis();

        for (int i = 0; i < ytIdList.size(); i += 50) {
            int end = Math.min(i + 50, ytIdList.size());
            List<String> chunk = ytIdList.subList(i, end);
            String idsParam = String.join(",", chunk);

            String apiUrl = "https://www.googleapis.com/youtube/v3/videos?part=statistics&id=" 
                    + idsParam + "&key=" + youtubeApiKey.trim();

            try {
                String responseBody = restClient.get()
                        .uri(apiUrl)
                        .retrieve()
                        .body(String.class);

                if (responseBody != null && !responseBody.isBlank()) {
                    JsonNode resNode = objectMapper.readTree(responseBody);
                    JsonNode items = resNode.path("items");
                    if (items.isArray()) {
                        for (JsonNode item : items) {
                            String id = item.path("id").asText();
                            JsonNode stats = item.path("statistics");
                            if (!stats.isMissingNode() && stats.has("viewCount")) {
                                long vc = stats.path("viewCount").asLong(0);
                                ytViewCounts.put(id, vc);
                            }
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("유튜브 배치 조회 실패 (index {}~{}): {}", i, end, e.getMessage());
            }
        }
        log.info("✓ 유튜브 조회수 수집 완료: {}개 / {}개 (소요시간: {}ms)", 
                ytViewCounts.size(), uniqueYtIds.size(), System.currentTimeMillis() - startTime);

        // 3. 치지직 영상 조회수 병렬 수집 (스레드 풀 5 + 재시도)
        Map<Long, Long> chzzkViewCounts = new ConcurrentHashMap<>();
        ExecutorService chzzkExecutor = Executors.newFixedThreadPool(5);
        List<CompletableFuture<Void>> futures = new ArrayList<>();

        log.info("🚀 치지직 조회수 병렬 수집 시작 (총 {}개 영상)...", uniqueChzzkNos.size());
        long chzzkStartTime = System.currentTimeMillis();

        for (Long videoNo : uniqueChzzkNos) {
            CompletableFuture<Void> future = CompletableFuture.runAsync(() -> {
                for (int attempt = 1; attempt <= 3; attempt++) {
                    try {
                        if (attempt > 1) {
                            Thread.sleep(300L * attempt);
                        }
                        // v2 API 우선 시도
                        String apiUrl = "https://api.chzzk.naver.com/service/v2/videos/" + videoNo;
                        String body = restClient.get()
                                .uri(apiUrl)
                                .retrieve()
                                .body(String.class);

                        if (body != null && !body.isBlank()) {
                            JsonNode resNode = objectMapper.readTree(body);
                            int code = resNode.path("code").asInt(0);
                            if (code == 200) {
                                long readCount = resNode.path("content").path("readCount").asLong(0);
                                chzzkViewCounts.put(videoNo, readCount);
                                return;
                            }
                        }

                        // v1 API 시도
                        apiUrl = "https://api.chzzk.naver.com/service/v1/videos/" + videoNo;
                        body = restClient.get()
                                .uri(apiUrl)
                                .retrieve()
                                .body(String.class);

                        if (body != null && !body.isBlank()) {
                            JsonNode resNode = objectMapper.readTree(body);
                            int code = resNode.path("code").asInt(0);
                            if (code == 200) {
                                long readCount = resNode.path("content").path("readCount").asLong(0);
                                chzzkViewCounts.put(videoNo, readCount);
                                return;
                            }
                        }
                    } catch (Exception e) {
                        if (attempt == 3) {
                            log.warn("치지직 영상({}) 조회수 최종 조회 실패: {}", videoNo, e.getMessage());
                        }
                    }
                }
            }, chzzkExecutor);
            futures.add(future);
        }

        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
        chzzkExecutor.shutdown();
        log.info("✓ 치지직 조회수 수집 완료: {}개 / {}개 (소요시간: {}ms)", 
                chzzkViewCounts.size(), uniqueChzzkNos.size(), System.currentTimeMillis() - chzzkStartTime);

        // 4. 수집한 조회수를 JSON 트리의 각 Video 노드에 반영
        int updatedCount = 0;
        for (ObjectNode vNode : allVideoNodes) {
            String url = vNode.path("url").asText("");
            Long viewCount = null;

            Long chzzkNo = chzzkService.extractVideoNo(url);
            if (chzzkNo != null && chzzkViewCounts.containsKey(chzzkNo)) {
                viewCount = chzzkViewCounts.get(chzzkNo);
            } else {
                String ytId = youTubeService.extractVideoId(url);
                if (ytId != null && ytViewCounts.containsKey(ytId)) {
                    viewCount = ytViewCounts.get(ytId);
                }
            }

            if (viewCount != null) {
                vNode.put("viewCount", viewCount);
                updatedCount++;
            }
        }
        log.info("✓ 전체 {}개 영상 중 {}개 영상 노드에 viewCount 주입 완료!", allVideoNodes.size(), updatedCount);

        // 5. 갱신된 JSON 파일 저장 (src/main/resources/static/streamers.json, docs/streamers.json, backup.json)
        byte[] updatedJsonBytes = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(root);

        Files.write(Path.of(STATIC_JSON_PATH), updatedJsonBytes);
        log.info("✓ {} 저장 완료", STATIC_JSON_PATH);

        Files.write(Path.of(DOCS_JSON_PATH), updatedJsonBytes);
        log.info("✓ {} 저장 완료", DOCS_JSON_PATH);

        Path backupDir = Path.of("D:/백업 파일/KONGBAP_BACKUPS_JSON");
        if (Files.exists(backupDir)) {
            Files.write(Path.of(BACKUP_JSON_PATH), updatedJsonBytes);
            log.info("✓ {} 저장 완료", BACKUP_JSON_PATH);
        }

        // 6. DB 동기화 실행 (MariaDB Video 테이블에 view_count 저장)
        log.info("🔄 MariaDB DB 동기화 시작...");
        List<StreamerDto> dtoList = parseAllStreamers(root);
        if (dtoList != null && !dtoList.isEmpty()) {
            streamerService.syncStreamers(dtoList);
            log.info("✓ MariaDB DB 동기화 완료 (총 {}명 스트리머)", dtoList.size());
        }

        // 7. 결과 검증
        List<Video> sampleVideos = videoRepository.findAll();
        log.info("==================================================");
        log.info("🎉 최종 DB 검증: 총 {}개 Video 레코드 저장됨", sampleVideos.size());
        long withViewCount = sampleVideos.stream().filter(v -> v.getViewCount() != null && v.getViewCount() > 0).count();
        log.info("📊 조회수가 정상 등록된 영상: {}개 ({}%)", 
                withViewCount, (sampleVideos.isEmpty() ? 0 : (withViewCount * 100 / sampleVideos.size())));
        log.info("==================================================");
    }

    private void collectVideos(JsonNode members, List<ObjectNode> allVideoNodes, 
                               Set<String> uniqueYtIds, Set<Long> uniqueChzzkNos) {
        for (JsonNode m : members) {
            JsonNode videos = m.path("videos");
            if (videos.isArray()) {
                for (JsonNode v : videos) {
                    if (v instanceof ObjectNode obj) {
                        allVideoNodes.add(obj);
                        String url = obj.path("url").asText("");
                        Long chzzkNo = chzzkService.extractVideoNo(url);
                        if (chzzkNo != null) {
                            uniqueChzzkNos.add(chzzkNo);
                        } else {
                            String ytId = youTubeService.extractVideoId(url);
                            if (ytId != null && !ytId.isBlank()) {
                                uniqueYtIds.add(ytId);
                            }
                        }
                    }
                }
            }
        }
    }

    private List<StreamerDto> parseAllStreamers(JsonNode root) {
        Map<String, StreamerDto> dtoMap = new LinkedHashMap<>();
        JsonNode categories = root.has("categories") ? root.get("categories") : root;
        if (categories != null && categories.isArray()) {
            for (JsonNode cat : categories) {
                String catId = cat.has("id") ? cat.get("id").asText() : "";
                boolean hasSubgroups = cat.has("hasSubgroups") && cat.get("hasSubgroups").asBoolean();
                if (hasSubgroups && cat.has("groups") && cat.get("groups").isArray()) {
                    for (JsonNode g : cat.get("groups")) {
                        String gId = g.has("id") ? g.get("id").asText() : "";
                        if (g.has("members") && g.get("members").isArray()) {
                            for (JsonNode m : g.get("members")) {
                                StreamerDto dto = parseMemberNode(m, catId, gId);
                                if (dto != null && dto.getId() != null && !dtoMap.containsKey(dto.getId())) {
                                    dtoMap.put(dto.getId(), dto);
                                }
                            }
                        }
                    }
                } else if (cat.has("members") && cat.get("members").isArray()) {
                    for (JsonNode m : cat.get("members")) {
                        StreamerDto dto = parseMemberNode(m, catId, null);
                        if (dto != null && dto.getId() != null && !dtoMap.containsKey(dto.getId())) {
                            dtoMap.put(dto.getId(), dto);
                        }
                    }
                }
            }
        }
        return new ArrayList<>(dtoMap.values());
    }

    private StreamerDto parseMemberNode(JsonNode m, String catId, String subgroupId) {
        StreamerDto.StreamerDtoBuilder builder = StreamerDto.builder();
        String mId = m.has("id") ? m.get("id").asText() : null;
        builder.id(mId);
        builder.name(m.has("name") ? m.get("name").asText() : "");
        builder.streamer(m.has("streamer") ? m.get("streamer").asText() : "");
        builder.category(catId);
        builder.subgroup(subgroupId);
        builder.role(m.has("role") ? m.get("role").asText() : null);
        builder.swatRole(m.has("swatRole") ? m.get("swatRole").asText() : null);
        builder.badgeColor(m.has("badgeColor") ? m.get("badgeColor").asText() : null);
        builder.status(m.has("status") ? m.get("status").asText() : "active");
        builder.avatar(m.has("avatar") ? m.get("avatar").asText() : null);
        builder.youtubeUrl(m.has("youtubeUrl") ? m.get("youtubeUrl").asText() : null);

        if (m.has("subscriberCount") && !m.get("subscriberCount").isNull()) {
            builder.subscriberCount(m.get("subscriberCount").asText());
        }
        if (m.has("displayOrder") && !m.get("displayOrder").isNull()) {
            builder.displayOrder(m.get("displayOrder").asInt());
        }

        if (m.has("videos") && m.get("videos").isArray()) {
            List<VideoDto> vList = new ArrayList<>();
            for (JsonNode v : m.get("videos")) {
                VideoDto.VideoDtoBuilder vb = VideoDto.builder();
                vb.id(v.has("id") ? v.get("id").asText() : null);
                vb.title(v.has("title") ? v.get("title").asText() : "");
                vb.url(v.has("url") ? v.get("url").asText() : "");
                vb.videoType(v.has("videoType") ? v.get("videoType").asText() : "clip");
                vb.date(v.has("date") ? v.get("date").asText() : "");
                vb.duration(v.has("duration") ? v.get("duration").asText() : "");
                vb.description(v.has("description") ? v.get("description").asText() : "");
                vb.thumbnailUrl(v.has("thumbnailUrl") ? v.get("thumbnailUrl").asText() : null);
                if (v.has("viewCount") && !v.get("viewCount").isNull()) {
                    vb.viewCount(v.get("viewCount").asLong());
                }
                if (v.has("displayOrder") && !v.get("displayOrder").isNull()) {
                    vb.displayOrder(v.get("displayOrder").asInt());
                }
                vList.add(vb.build());
            }
            builder.videos(vList);
        }

        return builder.build();
    }
}
