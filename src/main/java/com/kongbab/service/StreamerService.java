package com.kongbab.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.kongbab.domain.Streamer;
import com.kongbab.domain.Video;
import com.kongbab.dto.StreamerDto;
import com.kongbab.dto.VideoDto;
import com.kongbab.repository.StreamerRepository;
import com.kongbab.repository.VideoRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class StreamerService {

    private final StreamerRepository streamerRepository;
    private final VideoRepository videoRepository;

    public List<StreamerDto> getAllStreamers() {
        return streamerRepository.findAllByOrderByDisplayOrderAscIdAsc().stream()
                .map(StreamerDto::fromEntity)
                .collect(Collectors.toList());
    }

    public List<StreamerDto> getStreamersByCategory(String category) {
        return streamerRepository.findByCategoryOrderByDisplayOrderAscIdAsc(category).stream()
                .map(StreamerDto::fromEntity)
                .collect(Collectors.toList());
    }

    public Optional<StreamerDto> getStreamer(String idOrCustomId) {
        return findStreamerEntity(idOrCustomId).map(StreamerDto::fromEntity);
    }

    @Transactional
    public StreamerDto saveStreamer(StreamerDto dto) {
        Streamer streamer = null;
        if (dto.getId() != null && !dto.getId().isBlank()) {
            streamer = findStreamerEntity(dto.getId()).orElse(null);
        }

        if (streamer == null) {
            String customId = (dto.getId() != null && !dto.getId().isBlank())
                    ? dto.getId()
                    : "m-" + System.currentTimeMillis();
            streamer = Streamer.builder()
                    .customId(customId)
                    .build();
        }

        streamer.setName(dto.getName());
        streamer.setStreamer(dto.getStreamer());
        streamer.setCategory(dto.getCategory());
        streamer.setSubgroup(dto.getSubgroup());
        streamer.setRole(dto.getRole());
        streamer.setBadgeColor(dto.getBadgeColor());
        streamer.setAvatar(dto.getAvatar());
        streamer.setAffiliations(dto.getAffiliations());
        if (dto.getDisplayOrder() != null) {
            streamer.setDisplayOrder(dto.getDisplayOrder());
        }

        Streamer saved = streamerRepository.save(streamer);
        StreamerDto result = StreamerDto.fromEntity(saved);
        exportStaticJson();
        return result;
    }

    @Transactional
    public boolean deleteStreamer(String idOrCustomId) {
        Optional<Streamer> opt = findStreamerEntity(idOrCustomId);
        if (opt.isPresent()) {
            streamerRepository.delete(opt.get());
            exportStaticJson();
            return true;
        }
        return false;
    }

    @Transactional
    public VideoDto saveVideo(String streamerIdOrCustomId, VideoDto dto) {
        Streamer streamer = findStreamerEntity(streamerIdOrCustomId)
                .orElseThrow(() -> new IllegalArgumentException("해당 스트리머를 찾을 수 없습니다: " + streamerIdOrCustomId));

        Video video = null;
        if (dto.getId() != null && !dto.getId().isBlank()) {
            video = findVideoEntity(dto.getId()).orElse(null);
        }

        if (video == null) {
            String customId = (dto.getId() != null && !dto.getId().isBlank())
                    ? dto.getId()
                    : "v-" + System.currentTimeMillis();
            video = Video.builder()
                    .customId(customId)
                    .streamer(streamer)
                    .build();
        }

        video.setTitle(dto.getTitle());
        video.setUrl(dto.getUrl());
        video.setVideoType(dto.getVideoType() != null ? dto.getVideoType() : "clip");
        video.setDate(dto.getDate());
        video.setDescription(dto.getDescription());
        if (dto.getDisplayOrder() != null) {
            video.setDisplayOrder(dto.getDisplayOrder());
        }

        Video saved = videoRepository.save(video);
        VideoDto result = VideoDto.fromEntity(saved);
        exportStaticJson();
        return result;
    }

    @Transactional
    public boolean deleteVideo(String videoIdOrCustomId) {
        Optional<Video> opt = findVideoEntity(videoIdOrCustomId);
        if (opt.isPresent()) {
            Video video = opt.get();
            Streamer streamer = video.getStreamer();
            if (streamer != null && streamer.getVideos() != null) {
                streamer.getVideos().remove(video);
            }
            videoRepository.delete(video);
            exportStaticJson();
            return true;
        }
        return false;
    }

    @Transactional
    public List<StreamerDto> syncStreamers(List<StreamerDto> dtoList) {
        if (dtoList == null || dtoList.isEmpty()) {
            return Collections.emptyList();
        }

        List<StreamerDto> results = new ArrayList<>();
        int order = 0;
        for (StreamerDto dto : dtoList) {
            if (dto.getDisplayOrder() == null) {
                dto.setDisplayOrder(order++);
            }
            Streamer streamer = null;
            if (dto.getId() != null && !dto.getId().isBlank()) {
                streamer = findStreamerEntity(dto.getId()).orElse(null);
            }

            if (streamer == null) {
                String customId = (dto.getId() != null && !dto.getId().isBlank())
                        ? dto.getId()
                        : "m-" + System.currentTimeMillis();
                streamer = Streamer.builder()
                        .customId(customId)
                        .build();
            }

            streamer.setName(dto.getName());
            streamer.setStreamer(dto.getStreamer());
            streamer.setCategory(dto.getCategory());
            streamer.setSubgroup(dto.getSubgroup());
            streamer.setRole(dto.getRole());
            streamer.setBadgeColor(dto.getBadgeColor());
            streamer.setAvatar(dto.getAvatar());
            streamer.setAffiliations(dto.getAffiliations());
            streamer.setDisplayOrder(dto.getDisplayOrder());

            if (dto.getVideos() != null) {
                List<Video> currentVideos = streamer.getVideos();
                if (currentVideos == null) {
                    currentVideos = new ArrayList<>();
                    streamer.setVideos(currentVideos);
                }

                Map<String, Video> existingVideosMap = new HashMap<>();
                for (Video v : currentVideos) {
                    if (v.getCustomId() != null) {
                        existingVideosMap.put(v.getCustomId(), v);
                    }
                }

                Set<Video> keptVideos = new HashSet<>();
                int vOrder = 0;
                for (VideoDto vDto : dto.getVideos()) {
                    Video v = (vDto.getId() != null) ? existingVideosMap.get(vDto.getId()) : null;
                    if (v == null) {
                        String vCustomId = (vDto.getId() != null && !vDto.getId().isBlank())
                                ? vDto.getId()
                                : "v-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 6);
                        v = Video.builder()
                                .customId(vCustomId)
                                .streamer(streamer)
                                .build();
                        currentVideos.add(v);
                    }
                    v.setTitle(vDto.getTitle());
                    v.setUrl(vDto.getUrl());
                    v.setVideoType(vDto.getVideoType() != null ? vDto.getVideoType() : "clip");
                    v.setDate(vDto.getDate());
                    v.setDescription(vDto.getDescription());
                    v.setDisplayOrder(vDto.getDisplayOrder() != null ? vDto.getDisplayOrder() : vOrder++);
                    v.setStreamer(streamer);
                    keptVideos.add(v);
                }

                // DTO에 없는 기존 영상은 orphanRemoval로 자동 삭제되도록 컬렉션에서 제거
                currentVideos.removeIf(v -> !keptVideos.contains(v));
            }

            Streamer savedStreamer = streamerRepository.save(streamer);
            results.add(StreamerDto.fromEntity(savedStreamer));
        }

        exportStaticJson();
        return results;
    }

    public void exportStaticJson() {
        try {
            List<StreamerDto> all = getAllStreamers();
            ObjectMapper mapper = new ObjectMapper();
            mapper.enable(SerializationFeature.INDENT_OUTPUT);
            String json = mapper.writeValueAsString(all);

            // static 및 docs, build 폴더의 streamers.json 동시 갱신
            List<Path> targets = List.of(
                    Paths.get("src", "main", "resources", "static", "streamers.json"),
                    Paths.get("build", "resources", "main", "static", "streamers.json"),
                    Paths.get("docs", "streamers.json")
            );
            for (Path p : targets) {
                try {
                    if (Files.exists(p.getParent())) {
                        Files.writeString(p, json, StandardCharsets.UTF_8);
                    }
                } catch (Exception ignored) {}
            }

            log.info("정적 streamers.json 자동 갱신 완료 (총 {}명)", all.size());
        } catch (Exception e) {
            log.error("streamers.json 저장 실패", e);
        }
    }

    public long countStreamers() {
        return streamerRepository.count();
    }

    private Optional<Streamer> findStreamerEntity(String idOrCustomId) {
        if (idOrCustomId == null || idOrCustomId.isBlank()) return Optional.empty();
        Optional<Streamer> opt = streamerRepository.findByCustomId(idOrCustomId);
        if (opt.isPresent()) return opt;
        try {
            Long numId = Long.parseLong(idOrCustomId);
            return streamerRepository.findById(numId);
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }

    private Optional<Video> findVideoEntity(String idOrCustomId) {
        if (idOrCustomId == null || idOrCustomId.isBlank()) return Optional.empty();
        Optional<Video> opt = videoRepository.findByCustomId(idOrCustomId);
        if (opt.isPresent()) return opt;
        try {
            Long numId = Long.parseLong(idOrCustomId);
            return videoRepository.findById(numId);
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }
}
