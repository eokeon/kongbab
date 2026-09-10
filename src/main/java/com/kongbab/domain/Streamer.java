package com.kongbab.domain;

import com.fasterxml.jackson.annotation.JsonManagedReference;
import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "streamers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Streamer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true)
    private String customId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String streamer;

    @Column(nullable = false)
    private String category;

    private String subgroup;

    private String role;

    private String badgeColor;

    @Column(length = 1000)
    private String avatar;

    private Integer displayOrder;

    private String subscriberCount;

    @Column(length = 500)
    private String youtubeUrl;

    @Column(columnDefinition = "TEXT")
    private String affiliations;

    @Setter(AccessLevel.NONE)
    @OneToMany(mappedBy = "streamer", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("displayOrder ASC, id ASC")
    @JsonManagedReference
    @Builder.Default
    private List<Video> videos = new ArrayList<>();

    public void setVideos(List<Video> newVideos) {
        if (this.videos == null) {
            this.videos = new ArrayList<>();
        }
        if (this.videos != newVideos) {
            this.videos.clear();
            if (newVideos != null) {
                this.videos.addAll(newVideos);
            }
        }
    }
}
