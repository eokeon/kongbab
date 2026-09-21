package com.kongbap.service;

import com.kongbap.domain.AppUser;
import com.kongbap.domain.Streamer;
import com.kongbap.domain.UserWatchRecord;
import com.kongbap.domain.Video;
import com.kongbap.dto.MyPageSummaryDto;
import com.kongbap.dto.WatchRecordDto;
import com.kongbap.dto.WatchToggleRequest;
import com.kongbap.dto.WatchedMemberDto;
import com.kongbap.repository.StreamerRepository;
import com.kongbap.repository.UserWatchRecordRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class UserWatchServiceTest {

    private UserWatchRecordRepository watchRecordRepository;
    private UserWatchService userWatchService;

    @BeforeEach
    void setUp() {
        watchRecordRepository = Mockito.mock(UserWatchRecordRepository.class);
        userWatchService = new UserWatchService(watchRecordRepository);
    }

    @Test
    @DisplayName("시청 완료 토글: 신규 기록 생성 및 시청 시간 저장")
    void testToggleWatchRecord_New() {
        when(watchRecordRepository.findByUsernameAndStreamerIdAndVideoType("user1", "pol-14", "clip"))
                .thenReturn(Optional.empty());

        when(watchRecordRepository.save(any(UserWatchRecord.class)))
                .thenAnswer(invocation -> {
                    UserWatchRecord r = invocation.getArgument(0);
                    r.setId(1L);
                    return r;
                });

        WatchToggleRequest request = WatchToggleRequest.builder()
                .streamerId("pol-14")
                .streamerName("강새봄")
                .category("police")
                .videoType("clip")
                .watchedSeconds(3600L)
                .videoCount(4)
                .build();

        WatchRecordDto dto = userWatchService.toggleWatchRecord("user1", request);

        assertThat(dto).isNotNull();
        assertThat(dto.getStreamerId()).isEqualTo("pol-14");
        assertThat(dto.getVideoType()).isEqualTo("clip");
        assertThat(dto.getWatched()).isTrue();
        assertThat(dto.getWatchedSeconds()).isEqualTo(3600L);
        assertThat(dto.getVideoCount()).isEqualTo(4);
    }

    @Test
    @DisplayName("시청 완료 토글: 기존 기록이 있을 때 상태 반전")
    void testToggleWatchRecord_ToggleExisting() {
        UserWatchRecord existing = UserWatchRecord.builder()
                .id(1L)
                .username("user1")
                .streamerId("pol-14")
                .streamerName("강새봄")
                .category("police")
                .videoType("clip")
                .watched(true)
                .watchedSeconds(3600L)
                .videoCount(4)
                .updatedAt(LocalDateTime.now())
                .build();

        when(watchRecordRepository.findByUsernameAndStreamerIdAndVideoType("user1", "pol-14", "clip"))
                .thenReturn(Optional.of(existing));

        when(watchRecordRepository.save(any(UserWatchRecord.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        WatchToggleRequest request = WatchToggleRequest.builder()
                .streamerId("pol-14")
                .videoType("clip")
                .build();

        WatchRecordDto dto = userWatchService.toggleWatchRecord("user1", request);

        assertThat(dto.getWatched()).isFalse();
    }

    @Test
    @DisplayName("마이페이지 요약 통계: 총 시청 시간(초/시간 포맷), 인원 수, 탭별 완료 현황 검증")
    void testGetMyPageSummary() {
        UserWatchRecord r1 = UserWatchRecord.builder()
                .id(1L)
                .username("user1")
                .streamerId("pol-14")
                .streamerName("강새봄")
                .category("police")
                .videoType("clip")
                .watched(true)
                .watchedSeconds(3600L) // 1시간
                .videoCount(2)
                .updatedAt(LocalDateTime.now().minusHours(2))
                .build();

        UserWatchRecord r2 = UserWatchRecord.builder()
                .id(2L)
                .username("user1")
                .streamerId("pol-14")
                .streamerName("강새봄")
                .category("police")
                .videoType("full")
                .watched(true)
                .watchedSeconds(7200L) // 2시간
                .videoCount(3)
                .updatedAt(LocalDateTime.now().minusHours(1))
                .build();

        UserWatchRecord r3 = UserWatchRecord.builder()
                .id(3L)
                .username("user1")
                .streamerId("gang-01")
                .streamerName("빅딕두목")
                .category("gang")
                .videoType("binge")
                .watched(true)
                .watchedSeconds(5400L) // 1시간 30분
                .videoCount(1)
                .updatedAt(LocalDateTime.now())
                .build();

        when(watchRecordRepository.findByUsernameAndWatchedTrue("user1"))
                .thenReturn(List.of(r1, r2, r3));

        MyPageSummaryDto summary = userWatchService.getMyPageSummary("user1");

        assertThat(summary.getUsername()).isEqualTo("user1");
        assertThat(summary.getTotalWatchedSeconds()).isEqualTo(16200L); // 4시간 30분
        assertThat(summary.getTotalWatchedHours()).isEqualTo(4.5);
        assertThat(summary.getTotalWatchedDurationFormatted()).isEqualTo("4시간 30분");
        assertThat(summary.getTotalWatchedMembers()).isEqualTo(2); // 강새봄, 빅딕두목
        assertThat(summary.getTotalWatchedSections()).isEqualTo(3);
        assertThat(summary.getTotalWatchedVideos()).isEqualTo(6); // 2 + 3 + 1

        assertThat(summary.getMembers()).hasSize(2);
        WatchedMemberDto m1 = summary.getMembers().get(0);
        assertThat(m1.getStreamerName()).isEqualTo("빅딕두목"); // 최신 업데이트가 먼저 옴
        assertThat(m1.getWatchedSections()).containsExactly("binge");

        WatchedMemberDto m2 = summary.getMembers().get(1);
        assertThat(m2.getStreamerName()).isEqualTo("강새봄");
        assertThat(m2.getWatchedSections()).containsExactlyInAnyOrder("clip", "full");
        assertThat(m2.getTotalSeconds()).isEqualTo(10800L); // 3시간
        assertThat(m2.getDurationFormatted()).isEqualTo("3시간");
    }

    @Test
    @DisplayName("어드민-유저1 연동 테스트: admin 계정의 시청 체크 및 마이페이지는 user1 데이터와 연동됨")
    void testAdminLinkageToUser1() {
        when(watchRecordRepository.findByUsernameAndStreamerIdAndVideoType("user1", "pol-14", "clip"))
                .thenReturn(Optional.empty());

        when(watchRecordRepository.save(any(UserWatchRecord.class)))
                .thenAnswer(invocation -> {
                    UserWatchRecord r = invocation.getArgument(0);
                    assertThat(r.getUsername()).isEqualTo("user1"); // admin으로 요청했으나 user1으로 저장됨
                    return r;
                });

        WatchToggleRequest request = WatchToggleRequest.builder()
                .streamerId("pol-14")
                .streamerName("강새봄")
                .category("police")
                .videoType("clip")
                .watchedSeconds(3600L)
                .videoCount(4)
                .build();

        WatchRecordDto dto = userWatchService.toggleWatchRecord("admin", request);
        assertThat(dto).isNotNull();

        // 마이페이지 조회 시에도 user1 데이터 반환 및 어드민 연동 표시
        UserWatchRecord r = UserWatchRecord.builder()
                .id(1L)
                .username("user1")
                .streamerId("pol-14")
                .streamerName("강새봄")
                .category("police")
                .videoType("clip")
                .watched(true)
                .watchedSeconds(3600L)
                .videoCount(4)
                .updatedAt(LocalDateTime.now())
                .build();

        when(watchRecordRepository.findByUsernameAndWatchedTrue("user1"))
                .thenReturn(List.of(r));

        MyPageSummaryDto summary = userWatchService.getMyPageSummary("admin");
        assertThat(summary.getUsername()).contains("user1");
        assertThat(summary.getTotalWatchedMembers()).isEqualTo(1);
    }

    @Test
    @DisplayName("시간 포맷 유틸 테스트: 시와 분 정상 노출")
    void testFormatDuration() {
        assertThat(UserWatchService.formatDuration(0)).isEqualTo("0시간 0분");
        assertThat(UserWatchService.formatDuration(1800)).isEqualTo("30분");
        assertThat(UserWatchService.formatDuration(3600)).isEqualTo("1시간");
        assertThat(UserWatchService.formatDuration(5400)).isEqualTo("1시간 30분");
    }

    @Test
    @DisplayName("시청 시간 포맷 파싱 테스트: HH:MM:SS, MM:SS, 초 단위, ISO-8601 지원")
    void testParseDurationToSeconds() {
        assertThat(UserWatchService.parseDurationToSeconds("01:30:15")).isEqualTo(5415L);
        assertThat(UserWatchService.parseDurationToSeconds("45:30")).isEqualTo(2730L);
        assertThat(UserWatchService.parseDurationToSeconds("120")).isEqualTo(120L);
        assertThat(UserWatchService.parseDurationToSeconds("PT1H30M15S")).isEqualTo(5415L);
        assertThat(UserWatchService.parseDurationToSeconds(null)).isEqualTo(0L);
    }

    @Test
    @DisplayName("시청 완료 토글 시 시간 정보 누락 시 StreamerRepository를 통해 자동 복원")
    void testToggleWatchRecord_AutoRecoverSeconds() {
        StreamerRepository streamerRepository = Mockito.mock(StreamerRepository.class);
        userWatchService = new UserWatchService(watchRecordRepository, streamerRepository);

        Streamer streamer = Streamer.builder()
                .customId("pol-14")
                .name("강새봄")
                .videos(List.of(
                        Video.builder().videoType("clip").duration("01:00:00").build(),
                        Video.builder().videoType("clip").duration("00:30:00").build(),
                        Video.builder().videoType("full").duration("02:00:00").build()
                ))
                .build();

        when(streamerRepository.findByCustomId("pol-14")).thenReturn(Optional.of(streamer));
        when(watchRecordRepository.findByUsernameAndStreamerIdAndVideoType("user1", "pol-14", "clip"))
                .thenReturn(Optional.empty());

        when(watchRecordRepository.save(any(UserWatchRecord.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        WatchToggleRequest request = WatchToggleRequest.builder()
                .streamerId("pol-14")
                .videoType("clip")
                .watchedSeconds(0L) // 0으로 들어온 경우
                .videoCount(0)
                .build();

        WatchRecordDto dto = userWatchService.toggleWatchRecord("user1", request);

        assertThat(dto.getWatchedSeconds()).isEqualTo(5400L); // 1시간 + 30분 = 5400초
        assertThat(dto.getVideoCount()).isEqualTo(2); // 2개 클립
    }
}


