package com.kongbab.domain;

import com.fasterxml.jackson.annotation.JsonBackReference;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "videos")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Video {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true)
    private String customId;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false, length = 1000)
    private String url;

    private String videoType;

    private String date;

    private String duration;

    @Column(length = 1000)
    private String description;

    @Column(length = 1000)
    private String thumbnailUrl;

    private Integer displayOrder;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "streamer_id", nullable = false)
    @JsonBackReference
    private Streamer streamer;
}
