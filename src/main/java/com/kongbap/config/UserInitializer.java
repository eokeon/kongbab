package com.kongbap.config;

import com.kongbap.domain.AppUser;
import com.kongbap.repository.AppUserRepository;
import com.kongbap.service.PasswordEncoderService;
import com.kongbap.service.UserWatchService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Slf4j
@Component
@RequiredArgsConstructor
public class UserInitializer implements ApplicationRunner {

    private final AppUserRepository appUserRepository;
    private final PasswordEncoderService passwordEncoderService;
    private final UserWatchService userWatchService;

    @Override
    public void run(ApplicationArguments args) {
        ensureUser("user1", "1234", "user");
        try {
            appUserRepository.findByUsername("user2").ifPresent(appUserRepository::delete);
        } catch (Exception ignored) {}
        userWatchService.exportUser1WatchDataToJson();
    }

    private void ensureUser(String username, String rawPassword, String role) {
        try {
            appUserRepository.findByUsername(username).ifPresentOrElse(user -> {
                if (!passwordEncoderService.matches(rawPassword, user.getPassword())) {
                    user.setPassword(passwordEncoderService.encode(rawPassword));
                    user.setRole(role);
                    appUserRepository.save(user);
                    log.info("사용자 계정 비밀번호 동기화 완료: {}", username);
                }
            }, () -> {
                AppUser newUser = AppUser.builder()
                        .username(username)
                        .password(passwordEncoderService.encode(rawPassword))
                        .role(role)
                        .createdAt(LocalDateTime.now())
                        .build();
                appUserRepository.save(newUser);
                log.info("기본 사용자 계정({} / {}) 자동 생성 완료", username, rawPassword);
            });
        } catch (Exception e) {
            log.error("사용자 계정({}) 초기화 중 오류 발생: {}", username, e.getMessage());
        }
    }
}
