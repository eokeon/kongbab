package com.kongbab.service;

import com.kongbab.config.AdminAuthInterceptor;
import com.kongbab.controller.AuthController;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;

class SecurityServiceTest {

    private PasswordEncoderService passwordEncoderService;
    private LoginAttemptService loginAttemptService;
    private AdminTokenService adminTokenService;
    private AdminAuthInterceptor adminAuthInterceptor;

    @BeforeEach
    void setUp() {
        passwordEncoderService = new PasswordEncoderService();

        loginAttemptService = new LoginAttemptService();
        ReflectionTestUtils.setField(loginAttemptService, "maxAttempts", 5);
        ReflectionTestUtils.setField(loginAttemptService, "lockoutDurationMinutes", 15);

        adminTokenService = new AdminTokenService(passwordEncoderService);
        ReflectionTestUtils.setField(adminTokenService, "adminUsername", "admin");
        ReflectionTestUtils.setField(adminTokenService, "adminPassword", "secret1234");
        ReflectionTestUtils.setField(adminTokenService, "customTokenSecret", "test-secret-key-12345");

        adminAuthInterceptor = new AdminAuthInterceptor(adminTokenService);
    }

    @Test
    @DisplayName("PasswordEncoderService: 평문 비밀번호 및 BCrypt 해시 안전 비교")
    void testPasswordEncoderService() {
        // 1. 평문 호환성
        assertThat(passwordEncoderService.matches("secret1234", "secret1234")).isTrue();
        assertThat(passwordEncoderService.matches("wrongpassword", "secret1234")).isFalse();

        // 2. BCrypt 해시 지원
        String bCryptHash = passwordEncoderService.encode("myStrongPassword!@#");
        assertThat(passwordEncoderService.isBCryptHash(bCryptHash)).isTrue();
        assertThat(passwordEncoderService.matches("myStrongPassword!@#", bCryptHash)).isTrue();
        assertThat(passwordEncoderService.matches("wrongPassword", bCryptHash)).isFalse();
    }

    @Test
    @DisplayName("LoginAttemptService: 5회 실패 시 계정 잠금 및 성공 시 리셋")
    void testLoginAttemptService() {
        String testIp = "192.168.1.100";

        assertThat(loginAttemptService.isBlocked(testIp)).isFalse();

        // 4회 실패: 아직 잠기지 않음
        for (int i = 0; i < 4; i++) {
            loginAttemptService.loginFailed(testIp);
            assertThat(loginAttemptService.isBlocked(testIp)).isFalse();
        }

        // 5회째 실패: 잠금 활성화
        loginAttemptService.loginFailed(testIp);
        assertThat(loginAttemptService.isBlocked(testIp)).isTrue();
        assertThat(loginAttemptService.getRemainingLockTimeSeconds(testIp)).isGreaterThan(0);

        // 성공 시 즉시 잠금 및 카운트 해제
        loginAttemptService.loginSucceeded(testIp);
        assertThat(loginAttemptService.isBlocked(testIp)).isFalse();
        assertThat(loginAttemptService.getAttempts(testIp)).isEqualTo(0);
    }

    @Test
    @DisplayName("AdminTokenService: 토큰 생성, 서명 검증 및 비밀번호 대조")
    void testAdminTokenService() {
        // 비밀번호 대조
        assertThat(adminTokenService.matchesAdminPassword("secret1234")).isTrue();
        assertThat(adminTokenService.matchesAdminPassword("wrong")).isFalse();

        // 토큰 발급 및 검증
        String token = adminTokenService.generateToken("admin");
        assertThat(token).isNotBlank();
        assertThat(adminTokenService.validateToken(token, "admin")).isTrue();
        assertThat(adminTokenService.validateToken(token, "otherUser")).isFalse();

        // 토큰 위조 검증
        String tamperedToken = token + "bad";
        assertThat(adminTokenService.validateToken(tamperedToken, "admin")).isFalse();
    }

    @Test
    @DisplayName("AdminAuthInterceptor: 공개 GET은 허용, 민감 GET 및 CUD는 비인증 차단")
    void testAdminAuthInterceptor() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();

        // 1. 공개 GET 요청 (/api/streamers) -> 허용
        MockHttpServletRequest publicGetReq = new MockHttpServletRequest("GET", "/api/streamers");
        boolean publicGetResult = adminAuthInterceptor.preHandle(publicGetReq, response, new Object());
        assertThat(publicGetResult).isTrue();

        // 2. 비공개 민감 GET 요청 (/api/backup/list) -> 비인증 시 차단 (401)
        MockHttpServletRequest backupListReq = new MockHttpServletRequest("GET", "/api/backup/list");
        response = new MockHttpServletResponse();
        boolean backupListResult = adminAuthInterceptor.preHandle(backupListReq, response, new Object());
        assertThat(backupListResult).isFalse();
        assertThat(response.getStatus()).isEqualTo(401);

        // 3. 백업 파일 다운로드 GET 요청 (/api/backup/download/dump.json) -> 비인증 시 차단 (401)
        MockHttpServletRequest backupDownloadReq = new MockHttpServletRequest("GET", "/api/backup/download/dump.json");
        response = new MockHttpServletResponse();
        boolean backupDownloadResult = adminAuthInterceptor.preHandle(backupDownloadReq, response, new Object());
        assertThat(backupDownloadResult).isFalse();
        assertThat(response.getStatus()).isEqualTo(401);

        // 4. 데이터 등록 POST 요청 (/api/streamers) -> 비인증 시 차단 (401)
        MockHttpServletRequest postReq = new MockHttpServletRequest("POST", "/api/streamers");
        response = new MockHttpServletResponse();
        boolean postResult = adminAuthInterceptor.preHandle(postReq, response, new Object());
        assertThat(postResult).isFalse();
        assertThat(response.getStatus()).isEqualTo(401);

        // 5. 관리자 세션 보유 시 -> 모든 요청 허용
        MockHttpServletRequest authedPostReq = new MockHttpServletRequest("POST", "/api/streamers");
        MockHttpSession session = new MockHttpSession();
        session.setAttribute(AuthController.SESSION_USER_KEY, "admin");
        authedPostReq.setSession(session);
        response = new MockHttpServletResponse();
        boolean authedResult = adminAuthInterceptor.preHandle(authedPostReq, response, new Object());
        assertThat(authedResult).isTrue();
    }

    @Test
    @DisplayName("BotDetectionFilter: 크롤러 봇 차단 및 브라우저 요청 통과")
    void testBotDetectionFilter() throws Exception {
        com.kongbab.config.BotDetectionFilter filter = new com.kongbab.config.BotDetectionFilter();
        ReflectionTestUtils.setField(filter, "enabled", true);

        // 1. 파이썬 requests 봇 차단
        MockHttpServletRequest botReq = new MockHttpServletRequest("GET", "/api/streamers");
        botReq.addHeader("User-Agent", "python-requests/2.31.0");
        MockHttpServletResponse botRes = new MockHttpServletResponse();
        filter.doFilter(botReq, botRes, (req, res) -> {});
        assertThat(botRes.getStatus()).isEqualTo(403);

        // 2. curl 차단
        MockHttpServletRequest curlReq = new MockHttpServletRequest("GET", "/api/streamers");
        curlReq.addHeader("User-Agent", "curl/7.88.1");
        MockHttpServletResponse curlRes = new MockHttpServletResponse();
        filter.doFilter(curlReq, curlRes, (req, res) -> {});
        assertThat(curlRes.getStatus()).isEqualTo(403);

        // 3. 정상 브라우저 User-Agent 통과
        MockHttpServletRequest browserReq = new MockHttpServletRequest("GET", "/api/streamers");
        browserReq.addHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36");
        MockHttpServletResponse browserRes = new MockHttpServletResponse();
        boolean[] passed = {false};
        filter.doFilter(browserReq, browserRes, (req, res) -> passed[0] = true);
        assertThat(passed[0]).isTrue();
    }

    @Test
    @DisplayName("RateLimitingFilter: 분당 한도 초과 시 429 응답 차단")
    void testRateLimitingFilter() throws Exception {
        com.kongbab.config.RateLimitingFilter filter = new com.kongbab.config.RateLimitingFilter();
        ReflectionTestUtils.setField(filter, "enabled", true);
        ReflectionTestUtils.setField(filter, "maxRequestsPerMinute", 5);

        String ip = "10.0.0.99";
        for (int i = 0; i < 5; i++) {
            MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/streamers");
            req.setRemoteAddr(ip);
            MockHttpServletResponse res = new MockHttpServletResponse();
            filter.doFilter(req, res, (q, s) -> {});
            assertThat(res.getStatus()).isNotEqualTo(429);
        }

        // 6회째 요청: 429 차단
        MockHttpServletRequest overReq = new MockHttpServletRequest("GET", "/api/streamers");
        overReq.setRemoteAddr(ip);
        MockHttpServletResponse overRes = new MockHttpServletResponse();
        filter.doFilter(overReq, overRes, (q, s) -> {});
        assertThat(overRes.getStatus()).isEqualTo(429);
    }
}
