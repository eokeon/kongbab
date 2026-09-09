package com.kongbab.dto;

import com.kongbab.domain.Video;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VideoDto {
    private String id;
    private String title;
    private String url;
    private String videoType;
    private String date;
    private String description;
    private Integer displayOrder;

    public static VideoDto fromEntity(Video entity) {
        if (entity == null) return null;
        return VideoDto.builder()
                .id(entity.getCustomId() != null ? entity.getCustomId() : String.valueOf(entity.getId()))
                .title(entity.getTitle())
                .url(entity.getUrl())
                .videoType(entity.getVideoType())
                .date(entity.getDate())
                .description(entity.getDescription())
                .displayOrder(entity.getDisplayOrder())
                .build();
    }
}
