package com.kongbab.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kongbab.dto.ChzzkInfoDto;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
public class ChzzkService {

    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    private static final Pattern CHZZK_VIDEO_NO_PATTERN = Pattern.compile(
            "(?:chzzk\\.naver\\.com\\/video\\/)(\\d+)",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern DIGITS_PATTERN = Pattern.compile("^\\d+$");
    private static final Pattern HEX32_CHANNEL_PATTERN = Pattern.compile("^[a-fA-F0-9]{32}$");
    private static final Pattern CHZZK_CHANNEL_URL_PATTERN = Pattern.compile(
            "(?:chzzk\\.naver\\.com\\/(?:live\\/)?)([a-f0-9]{32})",
            Pattern.CASE_INSENSITIVE
    );

    public ChzzkService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        var factory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(java.time.Duration.ofSeconds(3));
        factory.setReadTimeout(java.time.Duration.ofSeconds(4));
        this.restClient = RestClient.builder()
                .requestFactory(factory)
                .defaultHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                .build();
    }

    public static String formatDuration(long totalSeconds) {
        if (totalSeconds <= 0) return "";
        long hours = totalSeconds / 3600;
        long minutes = (totalSeconds % 3600) / 60;
        long seconds = totalSeconds % 60;
        if (hours > 0) {
            return String.format("%d:%02d:%02d", hours, minutes, seconds);
        } else {
            return String.format("%d:%02d", minutes, seconds);
        }
    }

    public static String formatPublishDate(String publishDateStr) {
        if (publishDateStr == null || publishDateStr.isBlank()) return "";
        String trimmed = publishDateStr.trim();
        if (trimmed.length() >= 10) {
            return trimmed.substring(0, 10).replace("-", ".");
        }
        return trimmed;
    }

    public Long extractVideoNo(String urlOrId) {
        if (urlOrId == null || urlOrId.isBlank()) return null;
        String trimmed = urlOrId.trim();
        if (DIGITS_PATTERN.matcher(trimmed).matches()) {
            try {
                return Long.parseLong(trimmed);
            } catch (NumberFormatException ignored) {}
        }
        Matcher matcher = CHZZK_VIDEO_NO_PATTERN.matcher(trimmed);
        if (matcher.find()) {
            try {
                return Long.parseLong(matcher.group(1));
            } catch (NumberFormatException ignored) {}
        }
        return null;
    }

    public ChzzkInfoDto getVideoInfo(String urlOrId) {
        Long videoNo = extractVideoNo(urlOrId);
        if (videoNo == null) {
            return ChzzkInfoDto.builder()
                    .success(false)
                    .message("유효한 치지직 영상 링크 또는 번호가 아닙니다.")
                    .build();
        }

        String fullUrl = "https://chzzk.naver.com/video/" + videoNo;

        // 1. 치지직 v2 API 호출 시도
        ChzzkInfoDto info = fetchFromChzzkApi("https://api.chzzk.naver.com/service/v2/videos/" + videoNo, videoNo, fullUrl);
        if (info != null && info.isSuccess()) {
            return info;
        }

        // 2. 실패 시 v1 API 시도
        info = fetchFromChzzkApi("https://api.chzzk.naver.com/service/v1/videos/" + videoNo, videoNo, fullUrl);
        if (info != null && info.isSuccess()) {
            return info;
        }

        return ChzzkInfoDto.builder()
                .success(false)
                .videoNo(videoNo)
                .url(fullUrl)
                .message("치지직 영상 정보를 가져올 수 없습니다. 비공개 또는 삭제된 영상인지 확인해주세요.")
                .build();
    }

    private ChzzkInfoDto fetchFromChzzkApi(String apiUrl, Long videoNo, String fullUrl) {
        try {
            String responseBody = restClient.get()
                    .uri(apiUrl)
                    .retrieve()
                    .body(String.class);

            if (responseBody == null || responseBody.isBlank()) return null;

            JsonNode root = objectMapper.readTree(responseBody);
            int code = root.path("code").asInt(0);
            if (code != 200) {
                log.warn("치지직 API 응답 오류 (videoNo: {}, code: {}, msg: {})", videoNo, code, root.path("message").asText(""));
                return null;
            }

            JsonNode content = root.path("content");
            if (content.isMissingNode() || content.isNull()) return null;

            String videoId = content.path("videoId").asText("");
            String videoTitle = content.path("videoTitle").asText("");
            String publishDateRaw = content.path("publishDate").asText("");
            String videoType = content.path("videoType").asText("clip");
            long durationSec = content.path("duration").asLong(0);
            String formattedDuration = formatDuration(durationSec);
            long viewCount = content.path("readCount").asLong(0);

            String dateFromTitle = YouTubeService.extractDateFromTitle(videoTitle);
            String publishedDate = (dateFromTitle != null && !dateFromTitle.isBlank())
                    ? dateFromTitle
                    : formatPublishDate(publishDateRaw);

            // 채널 정보
            JsonNode channel = content.path("channel");
            String channelId = channel.path("channelId").asText("");
            String channelName = channel.path("channelName").asText("");

            // 썸네일
            String thumbnail = content.path("trailerUrl").asText("");
            if (thumbnail == null || thumbnail.isBlank()) {
                thumbnail = content.path("liveSnapshotPath").asText("");
            }
            if (thumbnail == null || thumbnail.isBlank()) {
                thumbnail = content.path("thumbnailImageUrl").asText("");
            }

            return ChzzkInfoDto.builder()
                    .success(true)
                    .videoNo(videoNo)
                    .videoId(videoId)
                    .url(fullUrl)
                    .title(videoTitle)
                    .publishedDate(publishedDate)
                    .duration(formattedDuration)
                    .durationSeconds(durationSec)
                    .channelTitle(channelName)
                    .channelId(channelId)
                    .thumbnailUrl(thumbnail)
                    .videoType(videoType)
                    .viewCount(viewCount)
                    .source("chzzk_api")
                    .message("치지직 정보를 성공적으로 가져왔습니다.")
                    .build();

        } catch (Exception e) {
            log.warn("치지직 API 호출 실패 (videoNo: {}, apiUrl: {}): {}", videoNo, apiUrl, e.getMessage());
            return null;
        }
    }

    public static String formatFollowerCount(long followerCount) {
        if (followerCount <= 0) return "0명";
        if (followerCount >= 100_000_000) {
            double eok = followerCount / 100_000_000.0;
            return String.format("%.1f억 명", eok).replace(".0억", "억");
        }
        if (followerCount >= 10_000) {
            double man = followerCount / 10_000.0;
            return String.format("%.1f만 명", man).replace(".0만", "만");
        }
        return String.format("%,d명", followerCount);
    }

    public String extractChannelId(String urlOrId) {
        if (urlOrId == null || urlOrId.isBlank()) return null;
        String trimmed = urlOrId.trim();
        if (HEX32_CHANNEL_PATTERN.matcher(trimmed).matches()) {
            return trimmed.toLowerCase();
        }
        Matcher matcher = CHZZK_CHANNEL_URL_PATTERN.matcher(trimmed);
        if (matcher.find()) {
            return matcher.group(1).toLowerCase();
        }
        return null;
    }

    public ChzzkInfoDto getChannelInfo(String urlOrId) {
        String channelId = extractChannelId(urlOrId);
        // 혹시 영상 링크가 들어온 경우 영상 조회 후 해당 영상의 channelId 추출
        if (channelId == null) {
            Long videoNo = extractVideoNo(urlOrId);
            if (videoNo != null) {
                ChzzkInfoDto videoInfo = getVideoInfo(urlOrId);
                if (videoInfo != null && videoInfo.isSuccess() && videoInfo.getChannelId() != null) {
                    channelId = videoInfo.getChannelId();
                }
            }
        }

        if (channelId == null) {
            return ChzzkInfoDto.builder()
                    .success(false)
                    .message("유효한 치지직 채널 링크 또는 채널 ID가 아닙니다.")
                    .build();
        }

        String apiUrl = "https://api.chzzk.naver.com/service/v1/channels/" + channelId;
        try {
            String responseBody = restClient.get()
                    .uri(apiUrl)
                    .retrieve()
                    .body(String.class);

            if (responseBody == null || responseBody.isBlank()) {
                return ChzzkInfoDto.builder()
                        .success(false)
                        .channelId(channelId)
                        .message("치지직 응답이 비어 있습니다.")
                        .build();
            }

            JsonNode root = objectMapper.readTree(responseBody);
            int code = root.path("code").asInt(0);
            if (code != 200) {
                return ChzzkInfoDto.builder()
                        .success(false)
                        .channelId(channelId)
                        .message("치지직 채널 조회 실패: " + root.path("message").asText())
                        .build();
            }

            JsonNode content = root.path("content");
            String chId = content.path("channelId").asText(channelId);
            String channelName = content.path("channelName").asText("");
            String channelImageUrl = content.path("channelImageUrl").asText("");
            long followerCount = content.path("followerCount").asLong(0);
            String formatted = formatFollowerCount(followerCount);

            return ChzzkInfoDto.builder()
                    .success(true)
                    .channelId(chId)
                    .channelTitle(channelName)
                    .url("https://chzzk.naver.com/" + chId)
                    .thumbnailUrl(channelImageUrl)
                    .followerCount(followerCount)
                    .followerCountFormatted(formatted)
                    .source("chzzk_api")
                    .message("치지직 채널 정보를 성공적으로 가져왔습니다.")
                    .build();

        } catch (Exception e) {
            log.warn("치지직 채널 API 호출 실패: {}", e.getMessage());
            return ChzzkInfoDto.builder()
                    .success(false)
                    .channelId(channelId)
                    .message("치지직 채널 API 호출 중 오류 발생: " + e.getMessage())
                    .build();
        }
    }
}
