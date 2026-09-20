package com.kongbap.controller;

import com.kongbap.dto.ChzzkInfoDto;
import com.kongbap.service.ChzzkService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/chzzk")
@RequiredArgsConstructor
public class ChzzkController {

    private final ChzzkService chzzkService;

    @GetMapping("/info")
    public ResponseEntity<ChzzkInfoDto> getVideoInfo(@RequestParam(name = "url", required = false) String url,
                                                    @RequestParam(name = "videoNo", required = false) String videoNo) {
        String query = (videoNo != null && !videoNo.isBlank()) ? videoNo : url;
        if (query == null || query.isBlank()) {
            return ResponseEntity.badRequest().body(
                    ChzzkInfoDto.builder()
                            .success(false)
                            .message("url 또는 videoNo 파라미터가 필요합니다.")
                            .build()
            );
        }
        ChzzkInfoDto info = chzzkService.getVideoInfo(query);
        return ResponseEntity.ok(info);
    }

    @GetMapping("/channel")
    public ResponseEntity<ChzzkInfoDto> getChannelInfo(@RequestParam(name = "url", required = false) String url,
                                                       @RequestParam(name = "channelId", required = false) String channelId) {
        String query = (channelId != null && !channelId.isBlank()) ? channelId : url;
        if (query == null || query.isBlank()) {
            return ResponseEntity.badRequest().body(
                    ChzzkInfoDto.builder()
                            .success(false)
                            .message("url 또는 channelId 파라미터가 필요합니다.")
                            .build()
            );
        }
        ChzzkInfoDto info = chzzkService.getChannelInfo(query);
        return ResponseEntity.ok(info);
    }
}
