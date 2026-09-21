package com.kongbap.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WatchToggleRequest {
    private String streamerId;
    private String streamerName;
    private String category;
    private String videoType; // clip, full, binge
    private Boolean watched; // null이면 현재 상태를 반전(toggle)
    private Long watchedSeconds;
    private Integer videoCount;
}
