package com.kongbap.dto;

import com.kongbap.domain.UserWatchRecord;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WatchRecordDto {
    private Long id;
    private String streamerId;
    private String streamerName;
    private String category;
    private String videoType;
    private Boolean watched;
    private Long watchedSeconds;
    private Integer videoCount;
    private LocalDateTime updatedAt;

    public static WatchRecordDto fromEntity(UserWatchRecord entity) {
        if (entity == null) return null;
        return WatchRecordDto.builder()
                .id(entity.getId())
                .streamerId(entity.getStreamerId())
                .streamerName(entity.getStreamerName())
                .category(entity.getCategory())
                .videoType(entity.getVideoType())
                .watched(entity.getWatched())
                .watchedSeconds(entity.getWatchedSeconds())
                .videoCount(entity.getVideoCount())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}
