package com.kongbap.controller;

import com.kongbap.dto.MyPageSummaryDto;
import com.kongbap.dto.WatchRecordDto;
import com.kongbap.dto.WatchToggleRequest;
import com.kongbap.service.AdminTokenService;
import com.kongbap.service.UserWatchService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
public class UserWatchController {

    private final UserWatchService userWatchService;
    private final AdminTokenService adminTokenService;

    private String getAuthenticatedUser(HttpServletRequest request, HttpServletResponse response) {
        adminTokenService.validateAndRestoreSession(request, response);
        HttpSession session = request.getSession(false);
        if (session != null) {
            Object user = session.getAttribute(AuthController.SESSION_USER_KEY);
            if (user != null && !user.toString().isBlank()) {
                return user.toString().trim();
            }
        }
        return null;
    }

    @GetMapping("/watch/records")
    public ResponseEntity<List<WatchRecordDto>> getWatchRecords(HttpServletRequest request, HttpServletResponse response) {
        String username = getAuthenticatedUser(request, response);
        if (username == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(userWatchService.getWatchRecords(username));
    }

    @PostMapping("/watch/toggle")
    public ResponseEntity<WatchRecordDto> toggleWatchRecord(
            @RequestBody WatchToggleRequest toggleRequest,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        String username = getAuthenticatedUser(request, response);
        if (username == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        try {
            WatchRecordDto result = userWatchService.toggleWatchRecord(username, toggleRequest);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            log.error("시청 기록 토글 중 오류: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/mypage")
    public ResponseEntity<MyPageSummaryDto> getMyPage(HttpServletRequest request, HttpServletResponse response) {
        String username = getAuthenticatedUser(request, response);
        if (username == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        MyPageSummaryDto summary = userWatchService.getMyPageSummary(username);
        return ResponseEntity.ok(summary);
    }

    @PostMapping("/watch/export")
    public ResponseEntity<Void> exportUser1WatchData(HttpServletRequest request, HttpServletResponse response) {
        String username = getAuthenticatedUser(request, response);
        if (username == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        userWatchService.exportUser1WatchDataToJson();
        return ResponseEntity.ok().build();
    }
}
