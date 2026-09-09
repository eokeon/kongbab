package com.kongbab.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kongbab.dto.YouTubeInfoDto;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
public class YouTubeService {

    @Value("${youtube.api.key:}")
    private String apiKey;

    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    private static final Pattern YOUTUBE_ID_PATTERN = Pattern.compile(
            "(?:youtu\\.be\\/|v\\/|u\\/\\w\\/|embed\\/|watch\\?v=|&v=|shorts\\/)([a-zA-Z0-9_-]{11})"
    );

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy.MM.dd");

    public YouTubeService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.restClient = RestClient.builder()
                .defaultHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                .build();
    }

    public String extractVideoId(String urlOrId) {
        if (urlOrId == null || urlOrId.isBlank()) {
            return null;
        }
        String trimmed = urlOrId.trim();
        if (trimmed.length() == 11 && trimmed.matches("^[a-zA-Z0-9_-]{11}$")) {
            return trimmed;
        }
        Matcher matcher = YOUTUBE_ID_PATTERN.matcher(trimmed);
        if (matcher.find()) {
            return matcher.group(1);
        }
        return null;
    }

    public YouTubeInfoDto getVideoInfo(String urlOrId) {
        String videoId = extractVideoId(urlOrId);
        if (videoId == null) {
            return YouTubeInfoDto.builder()
                    .success(false)
                    .message("유효한 유튜브 영상 링크 또는 ID를 찾을 수 없습니다.")
                    .build();
        }

        String defaultThumb = "https://img.youtube.com/vi/" + videoId + "/hqdefault.jpg";

        // 1. YouTube Data API v3 시도 (API 키가 등록되어 있는 경우)
        if (apiKey != null && !apiKey.isBlank() && !apiKey.equalsIgnoreCase("YOUR_API_KEY")) {
            try {
                String apiUrl = "https://www.googleapis.com/youtube/v3/videos?part=snippet&id=" + videoId + "&key=" + apiKey.trim();
                String responseBody = restClient.get()
                        .uri(apiUrl)
                        .retrieve()
                        .body(String.class);

                JsonNode root = objectMapper.readTree(responseBody);
                JsonNode items = root.path("items");
                if (items.isArray() && items.size() > 0) {
                    JsonNode snippet = items.get(0).path("snippet");
                    String title = snippet.path("title").asText("");
                    String channelTitle = snippet.path("channelTitle").asText("");
                    String publishedAtRaw = snippet.path("publishedAt").asText("");

                    String publishedDate = "";
                    if (!publishedAtRaw.isBlank()) {
                        try {
                            ZonedDateTime zdt = ZonedDateTime.parse(publishedAtRaw);
                            publishedDate = zdt.format(DATE_FORMATTER);
                        } catch (Exception e) {
                            if (publishedAtRaw.length() >= 10) {
                                publishedDate = publishedAtRaw.substring(0, 10).replace("-", ".");
                            }
                        }
                    }

                    return YouTubeInfoDto.builder()
                            .success(true)
                            .videoId(videoId)
                            .title(title)
                            .publishedDate(publishedDate)
                            .channelTitle(channelTitle)
                            .thumbnailUrl(defaultThumb)
                            .source("api")
                            .message("YouTube Data API로 정보를 성공적으로 가져왔습니다.")
                            .build();
                }
            } catch (Exception e) {
                log.warn("YouTube Data API v3 호출 실패 (videoId: {}): {}", videoId, e.getMessage());
            }
        }

        // 2. oEmbed 대체 호출 (API 키 미등록 또는 API 호출 실패 시)
        try {
            String oembedUrl = "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=" + videoId + "&format=json";
            String oembedBody = restClient.get()
                    .uri(oembedUrl)
                    .retrieve()
                    .body(String.class);

            JsonNode oembedJson = objectMapper.readTree(oembedBody);
            String title = oembedJson.path("title").asText("");
            String authorName = oembedJson.path("author_name").asText("");

            // 업로드 날짜 스크래핑 시도
            String publishedDate = fetchPublishedDateFromHtml(videoId);
            if (publishedDate == null || publishedDate.isBlank()) {
                publishedDate = java.time.LocalDate.now().format(DATE_FORMATTER);
            }

            return YouTubeInfoDto.builder()
                    .success(true)
                    .videoId(videoId)
                    .title(title)
                    .publishedDate(publishedDate)
                    .channelTitle(authorName)
                    .thumbnailUrl(defaultThumb)
                    .source("oembed")
                    .message(apiKey == null || apiKey.isBlank()
                            ? "oEmbed 방식으로 정보를 가져왔습니다."
                            : "YouTube Data API 조회 실패 후 대체 방식으로 정보를 가져왔습니다.")
                    .build();
        } catch (Exception e) {
            log.error("유튜브 정보 조회 실패 (videoId: {}): {}", videoId, e.getMessage());
        }

        return YouTubeInfoDto.builder()
                .success(false)
                .videoId(videoId)
                .thumbnailUrl(defaultThumb)
                .message("유튜브 영상 정보를 불러올 수 없습니다.")
                .build();
    }

    private String fetchPublishedDateFromHtml(String videoId) {
        try {
            String watchUrl = "https://www.youtube.com/watch?v=" + videoId;
            String html = restClient.get()
                    .uri(watchUrl)
                    .retrieve()
                    .body(String.class);

            if (html != null) {
                Pattern datePattern = Pattern.compile("(?:datePublished|uploadDate)\"\\s*:\\s*\"(\\d{4}-\\d{2}-\\d{2})");
                Matcher matcher = datePattern.matcher(html);
                if (matcher.find()) {
                    return matcher.group(1).replace("-", ".");
                }

                Pattern metaPattern = Pattern.compile("itemprop=\"(?:datePublished|uploadDate)\"\\s+content=\"(\\d{4}-\\d{2}-\\d{2})");
                Matcher metaMatcher = metaPattern.matcher(html);
                if (metaMatcher.find()) {
                    return metaMatcher.group(1).replace("-", ".");
                }
            }
        } catch (Exception e) {
            log.debug("HTML에서 날짜 파싱 실패: {}", e.getMessage());
        }
        return null;
    }
}
