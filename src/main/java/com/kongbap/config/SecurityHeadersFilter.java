package com.kongbap.config;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * 웹 보안 응답 헤더 필터
 * 클릭재킹, MIME 스니핑, XSS 등 다양한 웹 공격을 브라우저 수준에서 방어하기 위해 필수 보안 헤더를 설정합니다.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class SecurityHeadersFilter implements Filter {

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        if (response instanceof HttpServletResponse httpResponse) {
            // MIME 타입 스니핑 방지
            httpResponse.setHeader("X-Content-Type-Options", "nosniff");
            // 클릭재킹(Clickjacking) 방지 - 동일 출처(iframe)만 허용
            httpResponse.setHeader("X-Frame-Options", "SAMEORIGIN");
            // 브라우저 내장 XSS 필터 강제 활성화
            httpResponse.setHeader("X-XSS-Protection", "1; mode=block");
            // Referrer 정책 설정 (보안 강화)
            httpResponse.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
            // 불필요한 브라우저 기능 권한 제한
            httpResponse.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
        }
        chain.doFilter(request, response);
    }
}
