package com.kongbab.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChzzkInfoDto {
    private boolean success;
    private Long videoNo;
    private String videoId;
    private String url;
    private String title;
    private String publishedDate;
    private String duration;
    private Long durationSeconds;
    private String channelTitle;
    private String channelId;
    private String thumbnailUrl;
    private String videoType;
    private String source;
    private String message;
}
