package com.kongbab.controller;

import com.kongbab.domain.AdminLoginLog;
import com.kongbab.dto.AuthResponse;
import com.kongbab.dto.LoginRequest;
import com.kongbab.repository.AdminLoginLogRepository;
import com.kongbab.service.AdminTokenService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    public static final String SESSION_USER_KEY = "KONGBAB_USER";
    public static final String SESSION_LOGIN_TIME_KEY = "KONGBAB_LOGIN_TIME";
    public static final int SESSION_TIMEOUT_SECONDS = (int) (AdminTokenService.TOKEN_VALIDITY_MILLIS / 1000L); // 30일

    private final AdminLoginLogRepository adminLoginLogRepository;
    private final AdminTokenService adminTokenService;

    @Value("${kongbab.admin.username:admin}")
    private String adminUsername;

    @Value("${kongbab.admin.password:kongbab1234}")
    private String adminPassword;

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@RequestBody LoginRequest request, 
                                              HttpServletRequest httpRequest, 
                                              HttpServletResponse httpResponse,
                                              HttpSession session) {
        String clientIp = getClientIp(httpRequest);
        String userAgent = httpRequest.getHeader("User-Agent");
        if (userAgent != null && userAgent.length() > 500) {
            userAgent = userAgent.substring(0, 500);
        }

        if (request == null || request.getUsername() == null || request.getPassword() == null) {
            return ResponseEntity.status(400).body(AuthResponse.builder()
                    .success(false)
                    .role("guest")
                    .username("게스트")
                    .message("아이디와 비밀번호를 입력해주세요.")
                    .build());
        }

        boolean isValid = adminUsername.equals(request.getUsername().trim()) && adminPassword.equals(request.getPassword());

        // DB에 로그인 기록 저장
        AdminLoginLog logEntry = AdminLoginLog.builder()
                .username(request.getUsername().trim())
                .ipAddress(clientIp)
                .loginTime(LocalDateTime.now())
                .status(isValid ? "SUCCESS" : "FAILED")
                .userAgent(userAgent)
                .build();
        adminLoginLogRepository.save(logEntry);

        if (isValid) {
            long now = System.currentTimeMillis();
            session.setMaxInactiveInterval(SESSION_TIMEOUT_SECONDS);
            session.setAttribute(SESSION_USER_KEY, "admin");
            session.setAttribute(SESSION_LOGIN_TIME_KEY, now);

            // 서버 재시작 후에도 로그인 유지를 위한 영구 토큰 및 쿠키 발급
            String token = adminTokenService.generateToken("admin");
            adminTokenService.addTokenCookie(httpResponse, token);

            return ResponseEntity.ok(AuthResponse.builder()
                    .success(true)
                    .role("admin")
                    .username(adminUsername)
                    .loginTime(now)
                    .expiresInSeconds((long) SESSION_TIMEOUT_SECONDS)
                    .token(token)
                    .message("로그인되었습니다. (서버 재시작 후에도 로그인 유지)")
                    .build());
        }

        return ResponseEntity.status(401).body(AuthResponse.builder()
                .success(false)
                .role("guest")
                .username("게스트")
                .message("아이디 또는 비밀번호가 일치하지 않습니다.")
                .build());
    }

    @PostMapping("/logout")
    public ResponseEntity<AuthResponse> logout(HttpServletRequest request, HttpServletResponse response) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.removeAttribute(SESSION_USER_KEY);
            session.removeAttribute(SESSION_LOGIN_TIME_KEY);
            session.invalidate();
        }
        adminTokenService.removeTokenCookie(response);

        return ResponseEntity.ok(AuthResponse.builder()
                .success(true)
                .role("guest")
                .username("게스트")
                .message("로그아웃되었습니다.")
                .build());
    }

    @GetMapping("/me")
    public ResponseEntity<AuthResponse> getCurrentUser(HttpServletRequest request,
                                                      HttpServletResponse response,
                                                      HttpSession session) {
        // 서버 재시작으로 세션이 비어있는 경우, 쿠키나 헤더의 토큰으로 세션 복구 시도
        adminTokenService.validateAndRestoreSession(request, response);

        HttpSession currentSession = request.getSession(false);
        if (currentSession != null) {
            Object user = currentSession.getAttribute(SESSION_USER_KEY);
            if (user != null && "admin".equals(user.toString())) {
                Long loginTime = (Long) currentSession.getAttribute(SESSION_LOGIN_TIME_KEY);
                long now = System.currentTimeMillis();
                if (loginTime == null) loginTime = now;

                String token = adminTokenService.extractToken(request);
                if (token == null) {
                    token = adminTokenService.generateToken("admin");
                    adminTokenService.addTokenCookie(response, token);
                }

                return ResponseEntity.ok(AuthResponse.builder()
                        .success(true)
                        .role("admin")
                        .username(adminUsername)
                        .loginTime(loginTime)
                        .expiresInSeconds((long) SESSION_TIMEOUT_SECONDS)
                        .token(token)
                        .message("관리자 로그인 상태입니다. (서버 재시작 후에도 유지)")
                        .build());
            }
        }

        return ResponseEntity.ok(AuthResponse.builder()
                .success(true)
                .role("guest")
                .username("게스트")
                .message("게스트 상태입니다.")
                .build());
    }

    @GetMapping("/logs")
    public ResponseEntity<List<AdminLoginLog>> getLoginLogs(HttpServletRequest request,
                                                            HttpServletResponse response,
                                                            HttpSession session) {
        adminTokenService.validateAndRestoreSession(request, response);
        HttpSession currentSession = request.getSession(false);
        if (currentSession == null || !"admin".equals(String.valueOf(currentSession.getAttribute(SESSION_USER_KEY)))) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(adminLoginLogRepository.findTop20ByOrderByLoginTimeDesc());
    }

    private String getClientIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("Proxy-Client-IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("WL-Proxy-Client-IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }
        if (ip != null && ip.contains(",")) {
            ip = ip.split(",")[0].trim();
        }
        return ip;
    }
}
