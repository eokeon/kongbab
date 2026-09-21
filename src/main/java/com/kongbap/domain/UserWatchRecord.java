package com.kongbap.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(
    name = "user_watch_records",
    uniqueConstraints = {
        @UniqueConstraint(name = "uk_user_streamer_type", columnNames = {"username", "streamer_id", "video_type"})
    },
    indexes = {
        @Index(name = "idx_user_watch", columnList = "username, watched")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserWatchRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String username;

    @Column(name = "streamer_id", nullable = false, length = 100)
    private String streamerId;

    @Column(name = "streamer_name", length = 100)
    private String streamerName;

    @Column(length = 50)
    private String category;

    @Column(name = "video_type", nullable = false, length = 20)
    private String videoType; // clip, full, binge

    @Column(nullable = false)
    @Builder.Default
    private Boolean watched = true;

    @Column(nullable = false)
    @Builder.Default
    private Long watchedSeconds = 0L;

    @Column(nullable = false)
    @Builder.Default
    private Integer videoCount = 0;

    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    public void onUpdate() {
        this.updatedAt = LocalDateTime.now();
        if (this.watched == null) {
            this.watched = true;
        }
        if (this.watchedSeconds == null) {
            this.watchedSeconds = 0L;
        }
        if (this.videoCount == null) {
            this.videoCount = 0;
        }
    }
}
