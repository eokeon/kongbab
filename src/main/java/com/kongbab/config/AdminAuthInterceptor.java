package com.kongbab.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kongbab.controller.AuthController;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.HashMap;
import java.util.Map;

@Component
public class AdminAuthInterceptor implements HandlerInterceptor {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        String method = request.getMethod();

        // GET, OPTIONS 요청은 누구나 허용 (시청/조회)
        if ("GET".equalsIgnoreCase(method) || "OPTIONS".equalsIgnoreCase(method)) {
            return true;
        }

        String uri = request.getRequestURI();
        // 로그인/로그아웃 엔드포인트는 허용
        if (uri.startsWith("/api/auth/")) {
            return true;
        }

        // 그 외 POST, DELETE 등 데이터 변경 API는 관리자 세션 필수
        HttpSession session = request.getSession(false);
        if (session != null) {
            Object user = session.getAttribute(AuthController.SESSION_USER_KEY);
            if ("admin".equals(user)) {
                return true;
            }
        }

        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json;charset=UTF-8");
        Map<String, Object> errorRes = new HashMap<>();
        errorRes.put("success", false);
        errorRes.put("message", "관리자 로그인이 필요한 작업입니다.");
        response.getWriter().write(objectMapper.writeValueAsString(errorRes));
        return false;
    }
}
