package com.kongbab.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 로그인 실패 횟수 추적 및 Brute-Force 공격 방어 서비스
 * 지정된 횟수 이상 로그인 실패 시 일정 시간 동안 해당 IP/계정을 잠금 처리합니다.
 */
@Slf4j
@Service
public class LoginAttemptService {

    @Value("${kongbab.security.max-login-attempts:5}")
    private int maxAttempts;

    @Value("${kongbab.security.lockout-duration-minutes:15}")
    private int lockoutDurationMinutes;

    private static class AttemptInfo {
        int attempts;
        long lastAttemptTime;
        long lockedUntil;

        AttemptInfo() {
            this.attempts = 1;
            this.lastAttemptTime = System.currentTimeMillis();
            this.lockedUntil = 0L;
        }
    }

    private final Map<String, AttemptInfo> attemptsCache = new ConcurrentHashMap<>();

    /**
     * 해당 키(IP 또는 사용자명)가 현재 잠금 상태인지 확인합니다.
     */
    public boolean isBlocked(String key) {
        if (key == null || key.isBlank()) return false;
        AttemptInfo info = attemptsCache.get(key);
        if (info == null) return false;

        long now = System.currentTimeMillis();
        if (info.lockedUntil > now) {
            return true;
        }

        // 잠금 시간이 만료된 경우 초기화
        if (info.lockedUntil > 0 && info.lockedUntil <= now) {
            attemptsCache.remove(key);
            return false;
        }

        // 마지막 시도 후 30분 이상 경과한 경우 자동 정리
        if (now - info.lastAttemptTime > 30L * 60 * 1000) {
            attemptsCache.remove(key);
            return false;
        }

        return false;
    }

    /**
     * 잠금 상태인 경우 남은 잠금 시간(초)을 반환합니다.
     */
    public long getRemainingLockTimeSeconds(String key) {
        if (key == null) return 0;
        AttemptInfo info = attemptsCache.get(key);
        if (info == null || info.lockedUntil <= System.currentTimeMillis()) {
            return 0;
        }
        return (info.lockedUntil - System.currentTimeMillis()) / 1000;
    }

    /**
     * 현재 실패 횟수를 반환합니다.
     */
    public int getAttempts(String key) {
        AttemptInfo info = attemptsCache.get(key);
        return info != null ? info.attempts : 0;
    }

    /**
     * 로그인 실패를 기록합니다.
     * 최대 시도 횟수에 도달하면 계정을 잠금 처리합니다.
     */
    public void loginFailed(String key) {
        if (key == null || key.isBlank()) return;

        cleanUpExpiredEntries();

        long now = System.currentTimeMillis();
        attemptsCache.compute(key, (k, info) -> {
            if (info == null) {
                return new AttemptInfo();
            }
            info.attempts++;
            info.lastAttemptTime = now;
            if (info.attempts >= maxAttempts) {
                info.lockedUntil = now + (lockoutDurationMinutes * 60L * 1000L);
                log.warn("로그인 실패 한도 초과로 차단됨: [{}] ({}분 동안 잠금)", key, lockoutDurationMinutes);
            }
            return info;
        });
    }

    /**
     * 로그인 성공 시 실패 기록 및 잠금을 초기화합니다.
     */
    public void loginSucceeded(String key) {
        if (key == null || key.isBlank()) return;
        attemptsCache.remove(key);
    }

    /**
     * 메모리 누수를 방지하기 위해 오래된 항목들을 주기적으로 정리합니다.
     */
    private void cleanUpExpiredEntries() {
        if (attemptsCache.size() > 500) {
            long now = System.currentTimeMillis();
            attemptsCache.entrySet().removeIf(entry -> {
                AttemptInfo info = entry.getValue();
                return (info.lockedUntil > 0 && info.lockedUntil < now) 
                        || (now - info.lastAttemptTime > 60L * 60 * 1000);
            });
        }
    }
}
