package com.kongbab.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuthResponse {
    private boolean success;
    private String role;
    private String username;
    private String message;
    private Long loginTime;
    private Long expiresInSeconds;
    private String token;
}
