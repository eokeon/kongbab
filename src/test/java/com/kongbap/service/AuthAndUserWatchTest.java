package com.kongbap.service;

import com.kongbap.config.AdminAuthInterceptor;
import com.kongbap.config.UserInitializer;
import com.kongbap.controller.AuthController;
import com.kongbap.controller.UserWatchController;
import com.kongbap.domain.AdminLoginLog;
import com.kongbap.domain.AppUser;
import com.kongbap.domain.UserWatchRecord;
import com.kongbap.dto.AuthResponse;
import com.kongbap.dto.LoginRequest;
import com.kongbap.dto.MyPageSummaryDto;
import com.kongbap.dto.WatchRecordDto;
import com.kongbap.dto.WatchToggleRequest;
import com.kongbap.repository.AdminLoginLogRepository;
import com.kongbap.repository.AppUserRepository;
import com.kongbap.repository.UserWatchRecordRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class AuthAndUserWatchTest {

    private PasswordEncoderService passwordEncoderService;
    private AdminTokenService adminTokenService;
    private LoginAttemptService loginAttemptService;
    private AdminLoginLogRepository adminLoginLogRepository;
    private AppUserRepository appUserRepository;
    private UserWatchRecordRepository watchRecordRepository;

    private AuthController authController;
    private UserWatchService userWatchService;
    private UserWatchController userWatchController;
    private UserInitializer userInitializer;
    private AdminAuthInterceptor adminAuthInterceptor;

    @BeforeEach
    void setUp() {
        passwordEncoderService = new PasswordEncoderService();

        adminTokenService = new AdminTokenService(passwordEncoderService);
        ReflectionTestUtils.setField(adminTokenService, "adminUsername", "admin");
        ReflectionTestUtils.setField(adminTokenService, "adminPassword", "kongbap1234");
        ReflectionTestUtils.setField(adminTokenService, "customTokenSecret", "test-secret-salt-2026");

        loginAttemptService = new LoginAttemptService();
        ReflectionTestUtils.setField(loginAttemptService, "maxAttempts", 5);
        ReflectionTestUtils.setField(loginAttemptService, "lockoutDurationMinutes", 15);

        adminLoginLogRepository = mock(AdminLoginLogRepository.class);
        appUserRepository = mock(AppUserRepository.class);
        watchRecordRepository = mock(UserWatchRecordRepository.class);

        authController = new AuthController(
                adminLoginLogRepository,
                adminTokenService,
                loginAttemptService,
                appUserRepository,
                passwordEncoderService
        );
        ReflectionTestUtils.setField(authController, "adminUsername", "admin");

        userWatchService = new UserWatchService(watchRecordRepository);
        userWatchController = new UserWatchController(userWatchService, adminTokenService);

        userInitializer = new UserInitializer(appUserRepository, passwordEncoderService, userWatchService);
        adminAuthInterceptor = new AdminAuthInterceptor(adminTokenService);
    }

    @Test
    @DisplayName("UserInitializer: user1이 없으면 1234 비밀번호로 자동 생성 및 user2 정리")
    void testUserInitializer_CreatesUser1AndCleansUser2() {
        when(appUserRepository.findByUsername("user1")).thenReturn(Optional.empty());
        AppUser oldUser2 = AppUser.builder().id(2L).username("user2").build();
        when(appUserRepository.findByUsername("user2")).thenReturn(Optional.of(oldUser2));

        userInitializer.run(null);

        ArgumentCaptor<AppUser> captor = ArgumentCaptor.forClass(AppUser.class);
        verify(appUserRepository, times(1)).save(captor.capture());
        List<AppUser> createdList = captor.getAllValues();

        assertThat(createdList).hasSize(1);
        assertThat(createdList.get(0).getUsername()).isEqualTo("user1");
        assertThat(passwordEncoderService.matches("1234", createdList.get(0).getPassword())).isTrue();
        verify(appUserRepository, times(1)).delete(oldUser2);
    }

    @Test
    @DisplayName("AuthController: user1 외 일반 사용자(user2) 로그인 차단 검증")
    void testLogin_User2_Unauthorized() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockHttpSession session = new MockHttpSession();

        LoginRequest loginReq = LoginRequest.builder()
                .username("user2")
                .password("1234")
                .build();

        ResponseEntity<AuthResponse> res = authController.login(loginReq, request, response, session);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(res.getBody()).isNotNull();
        assertThat(res.getBody().isSuccess()).isFalse();
        assertThat(res.getBody().getMessage()).contains("아이디 또는 비밀번호가 일치하지 않습니다");
    }

    @Test
    @DisplayName("AuthController: user1 / 1234 로그인 성공 및 일반 사용자 역할 부여")
    void testLogin_User1_Success() {
        AppUser user1 = AppUser.builder()
                .id(10L)
                .username("user1")
                .password(passwordEncoderService.encode("1234"))
                .role("user")
                .build();

        when(appUserRepository.findByUsername("user1")).thenReturn(Optional.of(user1));

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockHttpSession session = new MockHttpSession();

        LoginRequest loginReq = LoginRequest.builder()
                .username("user1")
                .password("1234")
                .build();

        ResponseEntity<AuthResponse> res = authController.login(loginReq, request, response, session);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(res.getBody()).isNotNull();
        assertThat(res.getBody().isSuccess()).isTrue();
        assertThat(res.getBody().getRole()).isEqualTo("user");
        assertThat(res.getBody().getUsername()).isEqualTo("user1");
        assertThat(res.getBody().getToken()).isNotBlank();

        // 세션에 저장 확인
        assertThat(session.getAttribute(AuthController.SESSION_USER_KEY)).isEqualTo("user1");
        assertThat(session.getAttribute("KONGBAP_USER_ROLE")).isEqualTo("user");
    }

    @Test
    @DisplayName("AuthController: admin / kongbap1234 기존 어드민 로그인 100% 보존")
    void testLogin_Admin_Preserved() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockHttpSession session = new MockHttpSession();

        LoginRequest loginReq = LoginRequest.builder()
                .username("admin")
                .password("kongbap1234")
                .build();

        ResponseEntity<AuthResponse> res = authController.login(loginReq, request, response, session);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(res.getBody()).isNotNull();
        assertThat(res.getBody().isSuccess()).isTrue();
        assertThat(res.getBody().getRole()).isEqualTo("admin");
        assertThat(res.getBody().getUsername()).isEqualTo("admin");
    }

    @Test
    @DisplayName("AuthController: 잘못된 비밀번호 시 로그인 실패(401)")
    void testLogin_WrongPassword_Fail() {
        AppUser user1 = AppUser.builder()
                .id(10L)
                .username("user1")
                .password(passwordEncoderService.encode("1234"))
                .role("user")
                .build();

        when(appUserRepository.findByUsername("user1")).thenReturn(Optional.of(user1));

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockHttpSession session = new MockHttpSession();

        LoginRequest loginReq = LoginRequest.builder()
                .username("user1")
                .password("wrongpassword")
                .build();

        ResponseEntity<AuthResponse> res = authController.login(loginReq, request, response, session);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(res.getBody()).isNotNull();
        assertThat(res.getBody().isSuccess()).isFalse();
        assertThat(res.getBody().getRole()).isEqualTo("guest");
    }

    @Test
    @DisplayName("AuthController: /api/auth/me 세션 기반 user1 상태 확인")
    void testGetCurrentUser_User1() {
        AppUser user1 = AppUser.builder()
                .username("user1")
                .role("user")
                .build();
        when(appUserRepository.findByUsername("user1")).thenReturn(Optional.of(user1));

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockHttpSession session = new MockHttpSession();
        session.setAttribute(AuthController.SESSION_USER_KEY, "user1");
        request.setSession(session);

        ResponseEntity<AuthResponse> res = authController.getCurrentUser(request, response, session);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(res.getBody().getRole()).isEqualTo("user");
        assertThat(res.getBody().getUsername()).isEqualTo("user1");
    }

    @Test
    @DisplayName("AdminAuthInterceptor: /api/user/** 경로는 로그인한 일반 사용자에게 접근 허용")
    void testInterceptor_AllowsUserEndpointsForLoggedInUser() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/user/mypage");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockHttpSession session = new MockHttpSession();
        session.setAttribute(AuthController.SESSION_USER_KEY, "user1");
        request.setSession(session);

        boolean allowed = adminAuthInterceptor.preHandle(request, response, new Object());
        assertThat(allowed).isTrue();
    }

    @Test
    @DisplayName("AdminAuthInterceptor: /api/user/** 경로는 미로그인 게스트 접근 차단(401)")
    void testInterceptor_BlocksUserEndpointsForGuest() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/user/mypage");
        MockHttpServletResponse response = new MockHttpServletResponse();

        boolean allowed = adminAuthInterceptor.preHandle(request, response, new Object());
        assertThat(allowed).isFalse();
        assertThat(response.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED.value());
    }

    @Test
    @DisplayName("UserWatchController: 마이페이지 조회 엔드포인트 정상 작동")
    void testUserWatchController_GetMyPage() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockHttpSession session = new MockHttpSession();
        session.setAttribute(AuthController.SESSION_USER_KEY, "user1");
        request.setSession(session);

        UserWatchRecord record = UserWatchRecord.builder()
                .id(1L)
                .username("user1")
                .streamerId("pol-14")
                .streamerName("강새봄")
                .category("police")
                .videoType("clip")
                .watched(true)
                .watchedSeconds(7200L) // 2시간
                .videoCount(5)
                .updatedAt(LocalDateTime.now())
                .build();

        when(watchRecordRepository.findByUsernameAndWatchedTrue("user1"))
                .thenReturn(List.of(record));

        ResponseEntity<MyPageSummaryDto> mypageRes = userWatchController.getMyPage(request, response);

        assertThat(mypageRes.getStatusCode()).isEqualTo(HttpStatus.OK);
        MyPageSummaryDto body = mypageRes.getBody();
        assertThat(body).isNotNull();
        assertThat(body.getUsername()).isEqualTo("user1");
        assertThat(body.getTotalWatchedSeconds()).isEqualTo(7200L);
        assertThat(body.getTotalWatchedHours()).isEqualTo(2.0);
        assertThat(body.getTotalWatchedDurationFormatted()).isEqualTo("2시간");
        assertThat(body.getTotalWatchedMembers()).isEqualTo(1);
        assertThat(body.getMembers().get(0).getStreamerName()).isEqualTo("강새봄");
        assertThat(body.getMembers().get(0).getWatchedSections()).containsExactly("clip");
    }
}
