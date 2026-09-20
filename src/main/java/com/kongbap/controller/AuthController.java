package com.kongbap.controller;

import com.kongbap.domain.AdminLoginLog;
import com.kongbap.dto.AuthResponse;
import com.kongbap.dto.LoginRequest;
import com.kongbap.repository.AdminLoginLogRepository;
import com.kongbap.service.AdminTokenService;
import com.kongbap.service.LoginAttemptService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    public static final String SESSION_USER_KEY = "KONGBAP_USER";
    public static final String SESSION_LOGIN_TIME_KEY = "KONGBAP_LOGIN_TIME";
    public static final int SESSION_TIMEOUT_SECONDS = (int) (AdminTokenService.TOKEN_VALIDITY_MILLIS / 1000L); // 30일

    private final AdminLoginLogRepository adminLoginLogRepository;
    private final AdminTokenService adminTokenService;
    private final LoginAttemptService loginAttemptService;

    @Value("${kongbap.admin.username:admin}")
    private String adminUsername;

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
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(AuthResponse.builder()
                    .success(false)
                    .role("guest")
                    .username("게스트")
                    .message("아이디와 비밀번호를 입력해주세요.")
                    .build());
        }

        String inputUsername = request.getUsername().trim();

        // 1. Brute-Force 공격 방어: IP 및 계정 잠금 여부 확인
        if (loginAttemptService.isBlocked(clientIp) || loginAttemptService.isBlocked(inputUsername)) {
            long remainingSeconds = Math.max(
                    loginAttemptService.getRemainingLockTimeSeconds(clientIp),
                    loginAttemptService.getRemainingLockTimeSeconds(inputUsername)
            );
            long remainingMinutes = (remainingSeconds / 60) + 1;
            log.warn("차단된 계정/IP의 로그인 시도 차단: user={}, IP={}", inputUsername, clientIp);
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(AuthResponse.builder()
                    .success(false)
                    .role("guest")
                    .username("게스트")
                    .message(String.format("연속된 로그인 실패로 인해 일시적으로 차단되었습니다. 약 %d분 후 다시 시도해주세요.", remainingMinutes))
                    .build());
        }

        // 2. 비밀번호 암호화 검증 (BCrypt 및 타이밍 공격 방지 안전 비교)
        boolean isUsernameValid = adminUsername.equals(inputUsername);
        boolean isPasswordValid = adminTokenService.matchesAdminPassword(request.getPassword());
        boolean isValid = isUsernameValid && isPasswordValid;

        // DB에 로그인 기록 저장
        AdminLoginLog logEntry = AdminLoginLog.builder()
                .username(inputUsername)
                .ipAddress(clientIp)
                .loginTime(LocalDateTime.now())
                .status(isValid ? "SUCCESS" : "FAILED")
                .userAgent(userAgent)
                .build();
        adminLoginLogRepository.save(logEntry);

        if (isValid) {
            // 로그인 성공: 실패 카운트 초기화
            loginAttemptService.loginSucceeded(clientIp);
            loginAttemptService.loginSucceeded(inputUsername);

            long now = System.currentTimeMillis();
            session.setMaxInactiveInterval(SESSION_TIMEOUT_SECONDS);
            session.setAttribute(SESSION_USER_KEY, adminUsername);
            session.setAttribute(SESSION_LOGIN_TIME_KEY, now);

            // 서버 재시작 후에도 로그인 유지를 위한 영구 토큰 및 SameSite 쿠키 발급
            String token = adminTokenService.generateToken(adminUsername);
            boolean isSecure = adminTokenService.isHttpsRequest(httpRequest);
            adminTokenService.addTokenCookie(httpResponse, token, isSecure);

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

        // 로그인 실패 기록
        loginAttemptService.loginFailed(clientIp);
        loginAttemptService.loginFailed(inputUsername);

        int currentAttempts = Math.max(loginAttemptService.getAttempts(clientIp), loginAttemptService.getAttempts(inputUsername));
        int remainingAttempts = Math.max(0, 5 - currentAttempts);
        String failMsg = remainingAttempts > 0
                ? String.format("아이디 또는 비밀번호가 일치하지 않습니다. (남은 시도: %d회)", remainingAttempts)
                : "로그인 실패 횟수를 초과하여 계정이 일시적으로 잠겼습니다.";

        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(AuthResponse.builder()
                .success(false)
                .role("guest")
                .username("게스트")
                .message(failMsg)
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
        boolean isSecure = adminTokenService.isHttpsRequest(request);
        adminTokenService.removeTokenCookie(response, isSecure);

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
            if (user != null && adminUsername.equals(user.toString())) {
                Long loginTime = (Long) currentSession.getAttribute(SESSION_LOGIN_TIME_KEY);
                long now = System.currentTimeMillis();
                if (loginTime == null) loginTime = now;

                String token = adminTokenService.extractToken(request);
                if (token == null) {
                    token = adminTokenService.generateToken(adminUsername);
                    boolean isSecure = adminTokenService.isHttpsRequest(request);
                    adminTokenService.addTokenCookie(response, token, isSecure);
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
        if (currentSession == null || !adminUsername.equals(String.valueOf(currentSession.getAttribute(SESSION_USER_KEY)))) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(adminLoginLogRepository.findTop20ByOrderByLoginTimeDesc());
    }

    private String getClientIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip != null && !ip.isEmpty() && !"unknown".equalsIgnoreCase(ip)) {
            // 다중 프록시인 경우 첫 번째 클라이언트 IP 추출
            if (ip.contains(",")) {
                ip = ip.split(",")[0].trim();
            }
            return ip;
        }
        ip = request.getHeader("Proxy-Client-IP");
        if (ip != null && !ip.isEmpty() && !"unknown".equalsIgnoreCase(ip)) {
            return ip;
        }
        ip = request.getHeader("WL-Proxy-Client-IP");
        if (ip != null && !ip.isEmpty() && !"unknown".equalsIgnoreCase(ip)) {
            return ip;
        }
        return request.getRemoteAddr();
    }
}
