package com.kongbap.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WatchedMemberDto {
    private String streamerId;
    private String streamerName;
    private String category;
    private List<String> watchedSections; // ["clip", "full", "binge"]
    private Long totalSeconds;
    private String durationFormatted;
    private Integer totalVideos;
    private LocalDateTime lastUpdatedAt;
}
