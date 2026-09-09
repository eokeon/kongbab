package com.kongbab.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class YouTubeInfoDto {
    private boolean success;
    private String videoId;
    private String url;
    private String title;
    private String publishedDate;
    private String duration;
    private String channelTitle;
    private String thumbnailUrl;
    private String source;
    private String message;
}
