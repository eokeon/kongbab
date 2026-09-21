package com.kongbap.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MyPageSummaryDto {
    private String username;
    private Long totalWatchedSeconds;
    private Double totalWatchedHours;
    private String totalWatchedDurationFormatted; // e.g. "35시간 20분"
    private Integer totalWatchedMembers;
    private Integer totalWatchedSections;
    private Integer totalWatchedVideos;
    private List<WatchedMemberDto> members;
}
