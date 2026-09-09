package com.kongbab.controller;

import com.kongbab.dto.YouTubeInfoDto;
import com.kongbab.service.YouTubeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/youtube")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class YouTubeController {

    private final YouTubeService youtubeService;

    @GetMapping("/info")
    public ResponseEntity<YouTubeInfoDto> getVideoInfo(@RequestParam(name = "url", required = false) String url,
                                                      @RequestParam(name = "videoId", required = false) String videoId) {
        String query = (videoId != null && !videoId.isBlank()) ? videoId : url;
        if (query == null || query.isBlank()) {
            return ResponseEntity.badRequest().body(
                    YouTubeInfoDto.builder()
                            .success(false)
                            .message("url 또는 videoId 파라미터가 필요합니다.")
                            .build()
            );
        }
        YouTubeInfoDto info = youtubeService.getVideoInfo(query);
        return ResponseEntity.ok(info);
    }

    @GetMapping("/playlist")
    public ResponseEntity<?> getPlaylistVideos(@RequestParam(name = "url", required = false) String url,
                                               @RequestParam(name = "playlistId", required = false) String playlistId) {
        String query = (playlistId != null && !playlistId.isBlank()) ? playlistId : url;
        if (query == null || query.isBlank()) {
            return ResponseEntity.badRequest().body(
                    YouTubeInfoDto.builder()
                            .success(false)
                            .message("url 또는 playlistId 파라미터가 필요합니다.")
                            .build()
            );
        }
        java.util.List<YouTubeInfoDto> list = youtubeService.getPlaylistVideos(query);
        return ResponseEntity.ok(list);
    }
}
