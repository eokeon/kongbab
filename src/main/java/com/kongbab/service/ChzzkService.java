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

    public ChzzkService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.restClient = RestClient.builder()
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
        if (trimmed.matches("^\\d+$")) {
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
            String thumbnailImageUrl = content.path("thumbnailImageUrl").asText("");
            long durationSec = content.path("duration").asLong(0);
            String duration = formatDuration(durationSec);
            String publishDateRaw = content.path("publishDate").asText("");
            String videoType = content.path("videoType").asText("");

            // 날짜 포맷: 제목에서 날짜를 먼저 찾고, 없으면 publishDate 변환
            String dateFromTitle = YouTubeService.extractDateFromTitle(videoTitle);
            String publishedDate = (dateFromTitle != null && !dateFromTitle.isBlank())
                    ? dateFromTitle
                    : formatPublishDate(publishDateRaw);

            JsonNode channelNode = content.path("channel");
            String channelTitle = channelNode.path("channelName").asText("");
            String channelId = channelNode.path("channelId").asText("");

            return ChzzkInfoDto.builder()
                    .success(true)
                    .videoNo(videoNo)
                    .videoId(videoId)
                    .url(fullUrl)
                    .title(videoTitle)
                    .publishedDate(publishedDate)
                    .duration(duration)
                    .durationSeconds(durationSec)
                    .channelTitle(channelTitle)
                    .channelId(channelId)
                    .thumbnailUrl(thumbnailImageUrl)
                    .videoType(videoType)
                    .source("chzzk_api")
                    .message("치지직 정보를 성공적으로 가져왔습니다.")
                    .build();

        } catch (Exception e) {
            log.warn("치지직 API 호출 실패 (url: {}): {}", apiUrl, e.getMessage());
            return null;
        }
    }
}
