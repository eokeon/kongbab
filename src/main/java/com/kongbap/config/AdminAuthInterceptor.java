package com.kongbap.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kongbap.controller.AuthController;
import com.kongbap.service.AdminTokenService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class AdminAuthInterceptor implements HandlerInterceptor {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final AdminTokenService adminTokenService;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        String method = request.getMethod();
        String uri = request.getRequestURI();

        // 보안 응답 헤더 기본 적용 (Clickjacking 및 MIME 스니핑 방어)
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("X-Frame-Options", "SAMEORIGIN");

        // 1. CORS Preflight(OPTIONS) 요청 허용
        if ("OPTIONS".equalsIgnoreCase(method)) {
            return true;
        }

        // 2. 인증 관련 공개 엔드포인트 허용 (/api/auth/login, /api/auth/logout, /api/auth/me)
        // (단, /api/auth/logs 는 관리자 전용이므로 제외)
        if (uri.equals("/api/auth/login") || uri.equals("/api/auth/logout") || uri.equals("/api/auth/me")) {
            return true;
        }

        // 3. 일반 사용자 공개 조회(GET) 엔드포인트 화이트리스트
        // (/api/backup/**, /api/status, /api/auth/logs 등 민감한 관리자 기능은 GET이어도 차단)
        if ("GET".equalsIgnoreCase(method)) {
            if (isPublicGetEndpoint(uri)) {
                return true;
            }
        }

        // 4. 관리자 세션 검증
        HttpSession session = request.getSession(false);
        if (session != null) {
            Object user = session.getAttribute(AuthController.SESSION_USER_KEY);
            if (adminTokenService.getAdminUsername().equals(user) || "admin".equals(user)) {
                return true;
            }
        }

        // 5. 서버 재시작 후 세션 복구: 영구 토큰(쿠키 또는 Authorization 헤더) 검증
        if (adminTokenService.validateAndRestoreSession(request, response)) {
            return true;
        }

        log.warn("비인가 접근 차단: [{} {}] IP: {}", method, uri, request.getRemoteAddr());

        // 6. 비인가 접근 401 응답 반환
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json;charset=UTF-8");
        Map<String, Object> errorRes = new HashMap<>();
        errorRes.put("success", false);
        errorRes.put("message", "관리자 로그인이 필요한 작업입니다.");
        response.getWriter().write(objectMapper.writeValueAsString(errorRes));
        return false;
    }

    /**
     * 비로그인 일반 시청자도 조회 가능한 공개 GET 엔드포인트 화이트리스트 검사
     */
    private boolean isPublicGetEndpoint(String uri) {
        // 스트리머 목록 및 개별 스트리머 조회
        if (uri.equals("/api/streamers") || uri.startsWith("/api/streamers/")) {
            return true;
        }
        // 외부 API 조회 (치지직 / 유튜브 정보)
        if (uri.startsWith("/api/chzzk/") || uri.startsWith("/api/youtube/")) {
            return true;
        }
        // 카테고리/조직 구조 조회
        if (uri.equals("/api/config/structure")) {
            return true;
        }
        // 서버 헬스체크
        if (uri.equals("/api/health")) {
            return true;
        }
        return false;
    }
}
