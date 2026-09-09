package com.kongbab.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "admin_login_logs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AdminLoginLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String username;

    private String ipAddress;

    @Column(nullable = false)
    private LocalDateTime loginTime;

    @Column(nullable = false)
    private String status; // SUCCESS, FAILED

    @Column(length = 500)
    private String userAgent;
}
