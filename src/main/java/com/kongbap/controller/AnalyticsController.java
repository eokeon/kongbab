package com.kongbap.controller;

import com.kongbap.service.AdminTokenService;
import com.kongbap.service.GoogleAnalyticsService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/admin/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final GoogleAnalyticsService googleAnalyticsService;
    private final AdminTokenService adminTokenService;

    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> getSummary(
            @RequestParam(value = "refresh", defaultValue = "false") boolean refresh,
            HttpServletRequest request, 
            HttpServletResponse response) {
        // 관리자 인증 여부 검증
        if (!adminTokenService.validateAndRestoreSession(request, response)) {
            Map<String, Object> errorRes = new HashMap<>();
            errorRes.put("success", false);
            errorRes.put("message", "관리자 로그인이 필요한 기능입니다.");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(errorRes);
        }

        Map<String, Object> summary = googleAnalyticsService.getAnalyticsSummary(refresh);
        return ResponseEntity.ok(summary);
    }

    @GetMapping("/realtime")
    public ResponseEntity<Map<String, Object>> getRealtime(
            HttpServletRequest request, 
            HttpServletResponse response) {
        if (!adminTokenService.validateAndRestoreSession(request, response)) {
            Map<String, Object> errorRes = new HashMap<>();
            errorRes.put("success", false);
            errorRes.put("message", "관리자 로그인이 필요한 기능입니다.");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(errorRes);
        }

        Map<String, Object> realtime = googleAnalyticsService.getRealtimeUsers();
        return ResponseEntity.ok(realtime);
    }
}
