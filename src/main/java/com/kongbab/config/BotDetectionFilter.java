package com.kongbab.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kongbab.controller.AuthController;
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import com.kongbab.service.AdminTokenService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 무단 크롤러 및 스크래핑 봇 탐지/차단 필터
 * 자동화된 파이썬 스크립트(requests, scrapy, curl 등)를 통한 데이터 대량 탈취를 차단합니다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class BotDetectionFilter implements Filter {

    private final AdminTokenService adminTokenService;

    @Value("${kongbab.security.bot-protection.enabled:true}")
    private boolean enabled;

    private static final List<String> BLOCKED_USER_AGENTS = List.of(
            "python-requests",
            "python-urllib",
            "aiohttp",
            "scrapy",
            "curl/",
            "wget/",
            "httpclient",
            "java/",
            "go-http-client",
            "postmanruntime",
            "insomnia"
    );

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        if (!enabled || !(request instanceof HttpServletRequest httpRequest) || !(response instanceof HttpServletResponse httpResponse)) {
            chain.doFilter(request, response);
            return;
        }

        String uri = httpRequest.getRequestURI();

        // 오직 /api 엔드포인트에 대해서만 봇 검사 수행
        if (!uri.startsWith("/api/")) {
            chain.doFilter(request, response);
            return;
        }

        // 로그인한 관리자는 통과 (세션 및 영구 토큰 동시 지원)
        if (isAdminRequest(httpRequest)) {
            chain.doFilter(request, response);
            return;
        }

        String userAgent = httpRequest.getHeader("User-Agent");

        // 1. User-Agent 가 완전히 비어있는 경우 (대부분 자동화 스크립트)
        if (userAgent == null || userAgent.isBlank()) {
            blockBotRequest(httpResponse, "User-Agent 헤더가 누락된 비정상 요청입니다.", httpRequest.getRemoteAddr(), uri);
            return;
        }

        // 2. 알려진 크롤링/스크래핑 라이브러리 검사
        String lowerUa = userAgent.toLowerCase(Locale.ROOT);
        for (String blocked : BLOCKED_USER_AGENTS) {
            if (lowerUa.contains(blocked)) {
                blockBotRequest(httpResponse, "자동화 도구 및 스크래핑 봇을 통한 접근이 제한되어 있습니다.", httpRequest.getRemoteAddr(), uri);
                return;
            }
        }

        chain.doFilter(request, response);
    }

    private boolean isAdminRequest(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            Object user = session.getAttribute(AuthController.SESSION_USER_KEY);
            if (user != null && (adminTokenService.getAdminUsername().equals(user) || "admin".equals(user))) {
                return true;
            }
        }
        String token = adminTokenService.extractToken(request);
        return token != null && adminTokenService.validateToken(token, adminTokenService.getAdminUsername());
    }

    private void blockBotRequest(HttpServletResponse response, String message, String ip, String uri) throws IOException {
        log.warn("자동화 스크래핑 봇 접근 차단: IP={}, URI={}", ip, uri);
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/json;charset=UTF-8");

        Map<String, Object> errorRes = new HashMap<>();
        errorRes.put("success", false);
        errorRes.put("message", message);
        response.getWriter().write(objectMapper.writeValueAsString(errorRes));
    }
}
