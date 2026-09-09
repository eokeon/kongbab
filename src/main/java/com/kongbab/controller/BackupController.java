package com.kongbab.controller;

import org.springframework.beans.factory.annotation.Value;
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

@RestController
@RequestMapping("/api")
public class BackupController {

    private static final Path FIXED_BACKUP_PATH = Paths.get("D:", "\uBC31\uC5C5 \uD30C\uC77C", "KONGBAB_BACKUPS_JSON");

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

            // GitHub Pages 배포용 루트 streamers.json에만 단일 저장
            try {
                Path rootPath = Paths.get("streamers.json");
                Files.writeString(rootPath, payload, StandardCharsets.UTF_8);
            } catch (Exception ignored) {}

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
