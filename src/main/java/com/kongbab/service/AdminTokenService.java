package com.kongbab.service;

import com.kongbab.controller.AuthController;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;

@Slf4j
@Service
public class AdminTokenService {

    public static final String TOKEN_COOKIE_NAME = "KONGBAB_ADMIN_TOKEN";
    public static final long TOKEN_VALIDITY_MILLIS = 30L * 24 * 60 * 60 * 1000L; // 30일 동안 로그인 유지

    @Value("${kongbab.admin.username:admin}")
    private String adminUsername;

    @Value("${kongbab.admin.password:kongbab1234}")
    private String adminPassword;

    private static final String HMAC_ALGORITHM = "HmacSHA256";
    private static final String STATIC_SALT = "KONGBAB_SECRET_SALT_2026";

    private String getSecretKey() {
        return adminPassword + "_" + STATIC_SALT;
    }

    public String generateToken(String username) {
        long expiry = System.currentTimeMillis() + TOKEN_VALIDITY_MILLIS;
        String payload = username + ":" + expiry;
        String signature = sign(payload);
        String rawToken = payload + ":" + signature;
        return Base64.getUrlEncoder().withoutPadding().encodeToString(rawToken.getBytes(StandardCharsets.UTF_8));
    }

    public boolean validateToken(String token, String expectedUsername) {
        if (token == null || token.isBlank()) {
            return false;
        }
        try {
            byte[] decodedBytes = Base64.getUrlDecoder().decode(token.trim());
            String decoded = new String(decodedBytes, StandardCharsets.UTF_8);
            String[] parts = decoded.split(":");
            if (parts.length != 3) {
                return false;
            }
            String username = parts[0];
            long expiry = Long.parseLong(parts[1]);
            String signature = parts[2];

            if (!username.equals(expectedUsername)) {
                return false;
            }
            if (System.currentTimeMillis() > expiry) {
                return false;
            }

            String expectedSignature = sign(username + ":" + expiry);
            return MessageDigest.isEqual(
                    signature.getBytes(StandardCharsets.UTF_8),
                    expectedSignature.getBytes(StandardCharsets.UTF_8)
            );
        } catch (Exception e) {
            log.debug("토큰 검증 실패: {}", e.getMessage());
            return false;
        }
    }

    public String extractToken(HttpServletRequest request) {
        // 1. Authorization: Bearer <token> 헤더 확인
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7).trim();
        }

        // 2. X-Admin-Token 헤더 확인
        String customHeader = request.getHeader("X-Admin-Token");
        if (customHeader != null && !customHeader.isBlank()) {
            return customHeader.trim();
        }

        // 3. 쿠키 확인
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if (TOKEN_COOKIE_NAME.equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }

        return null;
    }

    public boolean validateAndRestoreSession(HttpServletRequest request, HttpServletResponse response) {
        // 1. 이미 유효한 세션이 있다면 패스
        HttpSession session = request.getSession(false);
        if (session != null) {
            Object user = session.getAttribute(AuthController.SESSION_USER_KEY);
            if (adminUsername.equals(user)) {
                return true;
            }
        }

        // 2. 토큰 추출 및 검증 (서버 재시작 후 세션 복구)
        String token = extractToken(request);
        if (token != null && validateToken(token, adminUsername)) {
            HttpSession newSession = request.getSession(true);
            newSession.setAttribute(AuthController.SESSION_USER_KEY, adminUsername);
            newSession.setAttribute(AuthController.SESSION_LOGIN_TIME_KEY, System.currentTimeMillis());
            newSession.setMaxInactiveInterval((int) (TOKEN_VALIDITY_MILLIS / 1000L));
            
            // 쿠키 만료시간 갱신 (Sliding Expiration)
            if (response != null) {
                addTokenCookie(response, token);
            }
            log.info("서버 재시작 후 영구 토큰으로 관리자 세션이 자동 복구되었습니다: {}", adminUsername);
            return true;
        }

        return false;
    }

    public void addTokenCookie(HttpServletResponse response, String token) {
        Cookie cookie = new Cookie(TOKEN_COOKIE_NAME, token);
        cookie.setPath("/");
        cookie.setHttpOnly(true);
        cookie.setMaxAge((int) (TOKEN_VALIDITY_MILLIS / 1000L)); // 30일
        response.addCookie(cookie);
    }

    public void removeTokenCookie(HttpServletResponse response) {
        Cookie cookie = new Cookie(TOKEN_COOKIE_NAME, "");
        cookie.setPath("/");
        cookie.setHttpOnly(true);
        cookie.setMaxAge(0);
        response.addCookie(cookie);
    }

    private String sign(String data) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(getSecretKey().getBytes(StandardCharsets.UTF_8), HMAC_ALGORITHM));
            byte[] rawHmac = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(rawHmac);
        } catch (Exception e) {
            throw new RuntimeException("토큰 서명 실패", e);
        }
    }
}
