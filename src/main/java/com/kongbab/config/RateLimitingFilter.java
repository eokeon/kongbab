package com.kongbab.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kongbab.controller.AuthController;
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * API 요청 속도 제한(Rate Limiting) 필터
 * 비인가 사용자의 무차별 API 호출, 스크래핑 봇, DoS 공격을 방어하기 위해 IP당 분당 요청 수를 제한합니다.
 */
@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
public class RateLimitingFilter implements Filter {

    @Value("${kongbab.security.rate-limit.enabled:true}")
    private boolean enabled;

    @Value("${kongbab.security.rate-limit.requests-per-minute:120}")
    private int maxRequestsPerMinute;

    private static class RequestCounter {
        long windowStartTime;
        int count;

        RequestCounter(long now) {
            this.windowStartTime = now;
            this.count = 1;
        }
    }

    private final Map<String, RequestCounter> requestCounts = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        if (!enabled || !(request instanceof HttpServletRequest httpRequest) || !(response instanceof HttpServletResponse httpResponse)) {
            chain.doFilter(request, response);
            return;
        }

        String uri = httpRequest.getRequestURI();

        // 정적 리소스(HTML, CSS, JS, 이미지)는 속도 제한 제외, 오직 /api 엔드포인트에만 적용
        if (!uri.startsWith("/api/")) {
            chain.doFilter(request, response);
            return;
        }

        // 로그인한 관리자는 속도 제한 제외
        HttpSession session = httpRequest.getSession(false);
        if (session != null && "admin".equals(session.getAttribute(AuthController.SESSION_USER_KEY))) {
            chain.doFilter(request, response);
            return;
        }

        String clientIp = getClientIp(httpRequest);
        long now = System.currentTimeMillis();

        cleanUpExpiredEntries(now);

        RequestCounter counter = requestCounts.compute(clientIp, (ip, c) -> {
            if (c == null || (now - c.windowStartTime) > 60_000L) {
                return new RequestCounter(now);
            }
            c.count++;
            return c;
        });

        if (counter.count > maxRequestsPerMinute) {
            log.warn("API 요청 한도 초과 차단: IP={} ({} requests in current minute, uri={})", clientIp, counter.count, uri);
            httpResponse.setStatus(429); // 429 Too Many Requests
            httpResponse.setContentType("application/json;charset=UTF-8");
            httpResponse.setHeader("Retry-After", "60");

            Map<String, Object> errorRes = new HashMap<>();
            errorRes.put("success", false);
            errorRes.put("message", "요청 횟수가 너무 많습니다. 잠시 후(1분 뒤) 다시 시도해주세요. (스크래핑/과도한 요청 방지)");
            httpResponse.getWriter().write(objectMapper.writeValueAsString(errorRes));
            return;
        }

        chain.doFilter(request, response);
    }

    private String getClientIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip != null && !ip.isEmpty() && !"unknown".equalsIgnoreCase(ip)) {
            if (ip.contains(",")) {
                ip = ip.split(",")[0].trim();
            }
            return ip;
        }
        ip = request.getHeader("Proxy-Client-IP");
        if (ip != null && !ip.isEmpty() && !"unknown".equalsIgnoreCase(ip)) {
            return ip;
        }
        return request.getRemoteAddr();
    }

    private void cleanUpExpiredEntries(long now) {
        if (requestCounts.size() > 1000) {
            requestCounts.entrySet().removeIf(entry -> (now - entry.getValue().windowStartTime) > 120_000L);
        }
    }
}
