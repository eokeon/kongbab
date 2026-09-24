package com.kongbap.service;

import com.kongbap.domain.Streamer;
import com.kongbap.domain.UserWatchRecord;
import com.kongbap.domain.Video;
import com.kongbap.dto.MyPageSummaryDto;
import com.kongbap.dto.WatchRecordDto;
import com.kongbap.dto.WatchToggleRequest;
import com.kongbap.dto.WatchedMemberDto;
import com.kongbap.repository.StreamerRepository;
import com.kongbap.repository.UserWatchRecordRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
public class UserWatchService {

    private final UserWatchRecordRepository watchRecordRepository;
    private final ObjectMapper objectMapper;
    private final StreamerRepository streamerRepository;

    public UserWatchService(UserWatchRecordRepository watchRecordRepository) {
        this(watchRecordRepository, new ObjectMapper().findAndRegisterModules(), null);
    }

    public UserWatchService(UserWatchRecordRepository watchRecordRepository, ObjectMapper objectMapper) {
        this(watchRecordRepository, objectMapper, null);
    }

    public UserWatchService(UserWatchRecordRepository watchRecordRepository, StreamerRepository streamerRepository) {
        this(watchRecordRepository, null, streamerRepository);
    }

    @Autowired
    public UserWatchService(UserWatchRecordRepository watchRecordRepository, 
                            ObjectMapper objectMapper,
                            @Autowired(required = false) StreamerRepository streamerRepository) {
        this.watchRecordRepository = watchRecordRepository;
        this.objectMapper = (objectMapper != null) ? objectMapper : new ObjectMapper().findAndRegisterModules();
        this.streamerRepository = streamerRepository;
    }

    /**
     * 어드민 계정(admin)은 상시 영상 관리/수정 목적으로 로그인 상태를 유지하므로,
     * 어드민 계정의 시청 체크 및 마이페이지 정보는 개인 계정인 'user1'과 100% 상호 연동합니다.
     */
    public String resolveEffectiveUsername(String username) {
        if (username == null || username.isBlank()) {
            return username;
        }
        String trimmed = username.trim();
        if ("admin".equalsIgnoreCase(trimmed)) {
            return "user1";
        }
        return trimmed;
    }

    public long[] computeSectionStats(String streamerId, String videoType) {
        if (streamerRepository == null || streamerId == null || videoType == null) {
            return new long[]{0L, 0L};
        }
        try {
            Optional<Streamer> opt = streamerRepository.findByCustomId(streamerId);
            if (opt.isPresent()) {
                Streamer s = opt.get();
                long totalSec = 0L;
                long count = 0L;
                if (s.getVideos() != null) {
                    for (Video v : s.getVideos()) {
                        String vType = (v.getVideoType() != null) ? v.getVideoType().trim() : "clip";
                        if (vType.equalsIgnoreCase(videoType.trim())) {
                            count++;
                            totalSec += parseDurationToSeconds(v.getDuration());
                        }
                    }
                }
                return new long[]{totalSec, count};
            }
        } catch (Exception e) {
            log.debug("스트리머 영상 시간 계산 중 오류: {}", e.getMessage());
        }
        return new long[]{0L, 0L};
    }

    public static long parseDurationToSeconds(String durationStr) {
        if (durationStr == null || durationStr.isBlank()) {
            return 0L;
        }
        String str = durationStr.trim();
        if (str.startsWith("P") || str.startsWith("p")) {
            try {
                return java.time.Duration.parse(str.toUpperCase()).getSeconds();
            } catch (Exception e) {
                return 0L;
            }
        }
        String[] parts = str.split(":");
        try {
            if (parts.length == 3) {
                long h = Long.parseLong(parts[0].trim());
                long m = Long.parseLong(parts[1].trim());
                long s = Long.parseLong(parts[2].trim());
                return h * 3600 + m * 60 + s;
            } else if (parts.length == 2) {
                long m = Long.parseLong(parts[0].trim());
                long s = Long.parseLong(parts[1].trim());
                return m * 60 + s;
            } else if (parts.length == 1) {
                return Long.parseLong(parts[0].trim());
            }
        } catch (Exception e) {
            return 0L;
        }
        return 0L;
    }

    @Transactional
    public WatchRecordDto toggleWatchRecord(String username, WatchToggleRequest request) {
        if (username == null || username.isBlank()) {
            throw new IllegalArgumentException("사용자 정보가 필요합니다.");
        }
        if (request.getStreamerId() == null || request.getVideoType() == null) {
            throw new IllegalArgumentException("스트리머 ID와 영상 타입이 필요합니다.");
        }

        String effectiveUsername = resolveEffectiveUsername(username);
        String streamerId = request.getStreamerId().trim();
        String videoType = request.getVideoType().trim();

        long watchedSec = (request.getWatchedSeconds() != null && request.getWatchedSeconds() > 0)
                ? request.getWatchedSeconds() : 0L;
        int videoCount = (request.getVideoCount() != null && request.getVideoCount() > 0)
                ? request.getVideoCount() : 0;

        if (watchedSec <= 0 || videoCount <= 0) {
            long[] stats = computeSectionStats(streamerId, videoType);
            if (watchedSec <= 0) watchedSec = stats[0];
            if (videoCount <= 0) videoCount = (int) stats[1];
        }

        Optional<UserWatchRecord> opt = watchRecordRepository
                .findByUsernameAndStreamerIdAndVideoType(effectiveUsername, streamerId, videoType);

        UserWatchRecord record;
        if (opt.isPresent()) {
            record = opt.get();
            boolean newWatched = (request.getWatched() != null) ? request.getWatched() : !Boolean.TRUE.equals(record.getWatched());
            record.setWatched(newWatched);
            if (watchedSec > 0 || record.getWatchedSeconds() == null || record.getWatchedSeconds() <= 0) {
                record.setWatchedSeconds(watchedSec);
            }
            if (videoCount > 0 || record.getVideoCount() == null || record.getVideoCount() <= 0) {
                record.setVideoCount(videoCount);
            }
            if (request.getStreamerName() != null && !request.getStreamerName().isBlank()) {
                record.setStreamerName(request.getStreamerName());
            }
            if (request.getCategory() != null && !request.getCategory().isBlank()) {
                record.setCategory(request.getCategory());
            }
            record.setUpdatedAt(LocalDateTime.now());
        } else {
            boolean watched = (request.getWatched() != null) ? request.getWatched() : true;
            record = UserWatchRecord.builder()
                    .username(effectiveUsername)
                    .streamerId(streamerId)
                    .streamerName(request.getStreamerName() != null ? request.getStreamerName() : streamerId)
                    .category(request.getCategory())
                    .videoType(videoType)
                    .watched(watched)
                    .watchedSeconds(watchedSec)
                    .videoCount(videoCount)
                    .updatedAt(LocalDateTime.now())
                    .build();
        }

        UserWatchRecord saved = watchRecordRepository.save(record);
        log.info("시청 상태 업데이트: user={} (effective={}), streamer={}, type={}, watched={}, seconds={}", 
                username, effectiveUsername, streamerId, videoType, saved.getWatched(), saved.getWatchedSeconds());

        if ("user1".equalsIgnoreCase(effectiveUsername)) {
            exportUser1WatchDataToJson();
        }

        return WatchRecordDto.fromEntity(saved);
    }

    @Transactional(readOnly = true)
    public List<WatchRecordDto> getWatchRecords(String username) {
        if (username == null || username.isBlank()) {
            return Collections.emptyList();
        }
        String effectiveUsername = resolveEffectiveUsername(username);
        return watchRecordRepository.findByUsernameAndWatchedTrue(effectiveUsername).stream()
                .map(WatchRecordDto::fromEntity)
                .toList();
    }

    @Transactional
    public MyPageSummaryDto getMyPageSummary(String username) {
        if (username == null || username.isBlank()) {
            return buildEmptySummary("게스트");
        }

        String effectiveUsername = resolveEffectiveUsername(username);
        List<UserWatchRecord> watchedList = watchRecordRepository.findByUsernameAndWatchedTrue(effectiveUsername);
        return buildSummaryFromRecords(username, effectiveUsername, watchedList);
    }

    private MyPageSummaryDto buildEmptySummary(String username) {
        return MyPageSummaryDto.builder()
                .username(username)
                .totalWatchedSeconds(0L)
                .totalWatchedHours(0.0)
                .totalWatchedDurationFormatted("0시간 0분")
                .totalWatchedMembers(0)
                .totalWatchedSections(0)
                .totalWatchedVideos(0)
                .members(Collections.emptyList())
                .build();
    }

    private MyPageSummaryDto buildSummaryFromRecords(String originalUsername, String effectiveUsername, List<UserWatchRecord> watchedList) {
        if (watchedList == null || watchedList.isEmpty()) {
            return buildEmptySummary("admin".equalsIgnoreCase(originalUsername.trim()) ? "user1 (관리자 연동)" : effectiveUsername);
        }

        long totalSeconds = 0L;
        int totalVideos = 0;

        Map<String, List<UserWatchRecord>> byStreamer = new LinkedHashMap<>();
        for (UserWatchRecord r : watchedList) {
            if (r.getWatchedSeconds() == null || r.getWatchedSeconds() <= 0) {
                long[] stats = computeSectionStats(r.getStreamerId(), r.getVideoType());
                if (stats[0] > 0) {
                    r.setWatchedSeconds(stats[0]);
                    if (r.getVideoCount() == null || r.getVideoCount() <= 0) {
                        r.setVideoCount((int) stats[1]);
                    }
                    try {
                        watchRecordRepository.save(r);
                    } catch (Exception e) {
                        log.warn("기존 시청 기록 재생시간 자동 보정 저장 실패: {}", e.getMessage());
                    }
                }
            }
            totalSeconds += (r.getWatchedSeconds() != null ? r.getWatchedSeconds() : 0L);
            totalVideos += (r.getVideoCount() != null ? r.getVideoCount() : 0);
            byStreamer.computeIfAbsent(r.getStreamerId(), k -> new ArrayList<>()).add(r);
        }

        List<WatchedMemberDto> memberDtos = new ArrayList<>(byStreamer.size());
        for (Map.Entry<String, List<UserWatchRecord>> entry : byStreamer.entrySet()) {
            String streamerId = entry.getKey();
            List<UserWatchRecord> records = entry.getValue();

            String streamerName = null;
            String category = null;
            Set<String> watchedSections = new LinkedHashSet<>();
            long memberSeconds = 0L;
            int memberVideos = 0;
            LocalDateTime latestUpdate = null;

            for (UserWatchRecord r : records) {
                if (streamerName == null && r.getStreamerName() != null && !r.getStreamerName().isBlank()) {
                    streamerName = r.getStreamerName();
                }
                if (category == null && r.getCategory() != null && !r.getCategory().isBlank()) {
                    category = r.getCategory();
                }
                if (r.getVideoType() != null && !r.getVideoType().isBlank()) {
                    watchedSections.add(r.getVideoType());
                }
                if (r.getWatchedSeconds() != null) {
                    memberSeconds += r.getWatchedSeconds();
                }
                if (r.getVideoCount() != null) {
                    memberVideos += r.getVideoCount();
                }
                if (r.getUpdatedAt() != null) {
                    if (latestUpdate == null || r.getUpdatedAt().isAfter(latestUpdate)) {
                        latestUpdate = r.getUpdatedAt();
                    }
                }
            }

            if (streamerName == null) streamerName = streamerId;
            if (latestUpdate == null) latestUpdate = LocalDateTime.now();

            memberDtos.add(WatchedMemberDto.builder()
                    .streamerId(streamerId)
                    .streamerName(streamerName)
                    .category(category)
                    .watchedSections(new ArrayList<>(watchedSections))
                    .totalSeconds(memberSeconds)
                    .durationFormatted(formatDuration(memberSeconds))
                    .totalVideos(memberVideos)
                    .lastUpdatedAt(latestUpdate)
                    .build());
        }

        // 최근 갱신순으로 정렬
        memberDtos.sort((a, b) -> {
            if (a.getLastUpdatedAt() == null && b.getLastUpdatedAt() == null) return 0;
            if (a.getLastUpdatedAt() == null) return 1;
            if (b.getLastUpdatedAt() == null) return -1;
            return b.getLastUpdatedAt().compareTo(a.getLastUpdatedAt());
        });

        double totalHours = Math.round((totalSeconds / 3600.0) * 10.0) / 10.0;
        String displayUsername = "admin".equalsIgnoreCase(originalUsername.trim()) ? "user1 (관리자 연동)" : effectiveUsername;

        return MyPageSummaryDto.builder()
                .username(displayUsername)
                .totalWatchedSeconds(totalSeconds)
                .totalWatchedHours(totalHours)
                .totalWatchedDurationFormatted(formatDuration(totalSeconds))
                .totalWatchedMembers(memberDtos.size())
                .totalWatchedSections(watchedList.size())
                .totalWatchedVideos(totalVideos)
                .members(memberDtos)
                .build();
    }

    public static String formatDuration(long totalSeconds) {
        if (totalSeconds <= 0) {
            return "0시간 0분";
        }
        long hours = totalSeconds / 3600;
        long minutes = (totalSeconds % 3600) / 60;
        if (hours > 0 && minutes > 0) {
            return hours + "시간 " + minutes + "분";
        } else if (hours > 0) {
            return hours + "시간";
        } else {
            return minutes + "분";
        }
    }

    /**
     * user1의 시청 완료 기록 및 마이페이지 요약 데이터를 정적 JSON 파일(user1-watch.json)로 내보냅니다.
     * 단일 DB 조회로 요약과 목록을 모두 생성하여 중복 DB 쿼리를 제거합니다.
     */
    public synchronized void exportUser1WatchDataToJson() {
        try {
            String effectiveUsername = resolveEffectiveUsername("user1");
            List<UserWatchRecord> watchedList = watchRecordRepository.findByUsernameAndWatchedTrue(effectiveUsername);
            MyPageSummaryDto summary = buildSummaryFromRecords("user1", effectiveUsername, watchedList);
            List<WatchRecordDto> records = watchedList.stream().map(WatchRecordDto::fromEntity).toList();

            Map<String, Object> exportMap = new LinkedHashMap<>();
            exportMap.put("exportedAt", LocalDateTime.now().toString());
            exportMap.put("username", "user1");
            exportMap.put("summary", summary);
            exportMap.put("records", records);

            String jsonContent = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(exportMap);

            List<Path> targets = List.of(
                    Paths.get("src", "main", "resources", "static", "user1-watch.json"),
                    Paths.get("build", "resources", "main", "static", "user1-watch.json"),
                    Paths.get("docs", "user1-watch.json")
            );

            for (Path p : targets) {
                try {
                    if (p.getParent() != null && Files.exists(p.getParent())) {
                        Files.writeString(p, jsonContent, StandardCharsets.UTF_8);
                    }
                } catch (Exception e) {
                    log.warn("user1-watch.json 파일 동기화 실패 (경로: {}): {}", p, e.getMessage());
                }
            }
            log.info("user1 시청 기록 및 마이페이지 정적 JSON 파일(user1-watch.json) 내보내기 완료 (인원: {}명, 탭: {}개)",
                    summary.getTotalWatchedMembers(), summary.getTotalWatchedSections());
        } catch (Exception e) {
            log.error("user1 시청 기록 내보내기 중 오류 발생", e);
        }
    }
}
