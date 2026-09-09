package com.kongbab.controller;

import com.kongbab.dto.StreamerDto;
import com.kongbab.dto.VideoDto;
import com.kongbab.service.StreamerService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class StreamerController {

    private final StreamerService streamerService;

    public StreamerController(StreamerService streamerService) {
        this.streamerService = streamerService;
    }

    @GetMapping("/streamers")
    public ResponseEntity<List<StreamerDto>> getAllStreamers(@RequestParam(required = false) String category) {
        if (category != null && !category.isBlank()) {
            return ResponseEntity.ok(streamerService.getStreamersByCategory(category));
        }
        return ResponseEntity.ok(streamerService.getAllStreamers());
    }

    @GetMapping("/streamers/{id}")
    public ResponseEntity<StreamerDto> getStreamer(@PathVariable String id) {
        return streamerService.getStreamer(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/streamers")
    public ResponseEntity<StreamerDto> saveStreamer(@RequestBody StreamerDto dto) {
        StreamerDto saved = streamerService.saveStreamer(dto);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/streamers/{id}")
    public ResponseEntity<Map<String, Object>> deleteStreamer(
            @PathVariable String id,
            @RequestHeader(value = "X-Delete-Password", required = false) String passwordHeader,
            @RequestParam(value = "password", required = false) String passwordParam) {

        String inputPassword = (passwordHeader != null && !passwordHeader.isBlank())
                ? passwordHeader
                : passwordParam;

        if (inputPassword == null || !inputPassword.trim().equals("kongbab1234")) {
            Map<String, Object> res = new HashMap<>();
            res.put("success", false);
            res.put("message", "인원 삭제를 위한 비밀번호가 일치하지 않습니다.");
            return ResponseEntity.status(403).body(res);
        }

        boolean deleted = streamerService.deleteStreamer(id);
        Map<String, Object> res = new HashMap<>();
        res.put("success", deleted);
        if (deleted) {
            res.put("message", "스트리머가 삭제되었습니다.");
            return ResponseEntity.ok(res);
        } else {
            res.put("message", "해당 스트리머를 찾을 수 없습니다.");
            return ResponseEntity.status(404).body(res);
        }
    }

    @PostMapping("/streamers/{id}/videos")
    public ResponseEntity<VideoDto> saveVideo(@PathVariable String id, @RequestBody VideoDto dto) {
        VideoDto saved = streamerService.saveVideo(id, dto);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/videos/{id}")
    public ResponseEntity<Map<String, Object>> deleteVideo(@PathVariable String id) {
        boolean deleted = streamerService.deleteVideo(id);
        Map<String, Object> res = new HashMap<>();
        res.put("success", deleted);
        if (deleted) {
            res.put("message", "영상이 삭제되었습니다.");
            return ResponseEntity.ok(res);
        } else {
            res.put("message", "해당 영상을 찾을 수 없습니다.");
            return ResponseEntity.status(404).body(res);
        }
    }

    @PostMapping("/streamers/sync")
    public ResponseEntity<Map<String, Object>> syncStreamers(@RequestBody List<StreamerDto> streamers) {
        List<StreamerDto> synced = streamerService.syncStreamers(streamers);
        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("count", synced.size());
        res.put("streamers", synced);
        return ResponseEntity.ok(res);
    }
}
