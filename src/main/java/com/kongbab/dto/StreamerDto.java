package com.kongbab.dto;

import com.kongbab.domain.Streamer;
import lombok.*;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StreamerDto {
    private String id;
    private String name;
    private String streamer;
    private String category;
    private String subgroup;
    private String role;
    private String swatRole;
    private String badgeColor;
    private String status;
    private String avatar;
    private Integer displayOrder;
    private String subscriberCount;
    private String youtubeUrl;
    private String affiliations;
    @Builder.Default
    private List<VideoDto> videos = new ArrayList<>();

    public static StreamerDto fromEntity(Streamer entity) {
        if (entity == null) return null;
        return StreamerDto.builder()
                .id(entity.getCustomId() != null ? entity.getCustomId() : String.valueOf(entity.getId()))
                .name(entity.getName())
                .streamer(entity.getStreamer())
                .category(entity.getCategory())
                .subgroup(entity.getSubgroup())
                .role(entity.getRole())
                .swatRole(entity.getSwatRole())
                .badgeColor(entity.getBadgeColor())
                .status(entity.getStatus())
                .avatar(entity.getAvatar())
                .displayOrder(entity.getDisplayOrder())
                .subscriberCount(entity.getSubscriberCount())
                .youtubeUrl(entity.getYoutubeUrl())
                .affiliations(entity.getAffiliations())
                .videos(entity.getVideos() != null 
                        ? entity.getVideos().stream().map(VideoDto::fromEntity).collect(Collectors.toList())
                        : new ArrayList<>())
                .build();
    }
}
