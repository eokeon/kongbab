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

    @OneToMany(mappedBy = "streamer", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonManagedReference
    @Builder.Default
    private List<Video> videos = new ArrayList<>();
}
