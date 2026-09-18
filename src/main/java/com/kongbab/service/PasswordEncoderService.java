package com.kongbab.service;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * 비밀번호 암호화 및 검증 서비스
 * BCrypt 해시와 하위 호환을 위한 안전한 평문 비교(타이밍 공격 방지)를 모두 지원합니다.
 */
@Service
public class PasswordEncoderService {

    private final BCryptPasswordEncoder bCryptPasswordEncoder = new BCryptPasswordEncoder();

    /**
     * 비밀번호를 BCrypt 해시 문자열로 암호화합니다.
     */
    public String encode(String rawPassword) {
        if (rawPassword == null) return null;
        return bCryptPasswordEncoder.encode(rawPassword);
    }

    /**
     * 입력된 평문 비밀번호가 저장된 비밀번호(BCrypt 해시 또는 평문)와 일치하는지 안전하게 검증합니다.
     * 타이밍 공격(Timing Attack) 방지를 위해 상수 시간 비교를 수행합니다.
     */
    public boolean matches(String rawPassword, String storedPassword) {
        if (rawPassword == null || storedPassword == null) {
            return false;
        }

        // 저장된 비밀번호가 BCrypt 해시인 경우 ($2a$, $2b$, $2y$ 형식)
        if (isBCryptHash(storedPassword)) {
            try {
                return bCryptPasswordEncoder.matches(rawPassword, storedPassword);
            } catch (Exception e) {
                return false;
            }
        }

        // 평문 설정과의 하위 호환성 유지: 타이밍 공격을 방어하기 위해 MessageDigest.isEqual(상수 시간) 사용
        byte[] rawBytes = rawPassword.getBytes(StandardCharsets.UTF_8);
        byte[] storedBytes = storedPassword.getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(rawBytes, storedBytes);
    }

    /**
     * 문자열이 BCrypt 해시 형식인지 확인합니다.
     */
    public boolean isBCryptHash(String password) {
        if (password == null || password.length() < 60) {
            return false;
        }
        return password.startsWith("$2a$") || password.startsWith("$2b$") || password.startsWith("$2y$");
    }
}
