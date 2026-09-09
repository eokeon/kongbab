package com.kongbab.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kongbab.dto.YouTubeInfoDto;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
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

    private static final java.time.ZoneId KST_ZONE = java.time.ZoneId.of("Asia/Seoul");
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy.MM.dd").withZone(KST_ZONE);

    public static String formatToKstDate(String isoDateStr) {
        if (isoDateStr == null || isoDateStr.isBlank()) return "";
        try {
            ZonedDateTime zdt = ZonedDateTime.parse(isoDateStr).withZoneSameInstant(KST_ZONE);
            return zdt.format(DATE_FORMATTER);
        } catch (Exception e) {
            try {
                java.time.Instant inst = java.time.Instant.parse(isoDateStr);
                return DATE_FORMATTER.format(inst);
            } catch (Exception ignored) {}
            if (isoDateStr.length() >= 10) {
                return isoDateStr.substring(0, 10).replace("-", ".");
            }
            return "";
        }
    }

    public static String extractDateFromTitle(String title) {
        if (title == null || title.isBlank()) return null;
        String t = title.trim();

        // 1. [24.05.01], 2024-05-01, 24/05/01, 24.5.1
        Matcher m1 = Pattern.compile("(?:[\\[\\(\\s]|^)(?:20)?(2[3-9])[.\\-\\/](0?[1-9]|1[0-2])[.\\-\\/](0?[1-9]|[12][0-9]|3[01])(?:[\\]\\)\\s]|$)").matcher(t);
        if (m1.find()) {
            return String.format("20%s.%02d.%02d", m1.group(1), Integer.parseInt(m1.group(2)), Integer.parseInt(m1.group(3)));
        }

        // 2. [240501], (240501), 240501, 20240501
        Matcher m2 = Pattern.compile("(?:[\\[\\(\\s]|^)(?:20)?(2[3-9])(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])(?:[\\]\\)\\s]|$)").matcher(t);
        if (m2.find()) {
            return String.format("20%s.%s.%s", m2.group(1), m2.group(2), m2.group(3));
        }

        // 3. 24년 5월 1일, 2024년 05월 01일
        Matcher m3 = Pattern.compile("(?:20)?(2[3-9])년\\s*(0?[1-9]|1[0-2])월\\s*(0?[1-9]|[12][0-9]|3[01])일").matcher(t);
        if (m3.find()) {
            return String.format("20%s.%02d.%02d", m3.group(1), Integer.parseInt(m3.group(2)), Integer.parseInt(m3.group(3)));
        }

        return null;
    }

    public static String formatDuration(String isoDuration) {
        if (isoDuration == null || isoDuration.isBlank()) return "";
        try {
            Duration d = Duration.parse(isoDuration);
            long hours = d.toHours();
            int minutes = d.toMinutesPart();
            int seconds = d.toSecondsPart();
            if (hours > 0) {
                return String.format("%d:%02d:%02d", hours, minutes, seconds);
            } else {
                return String.format("%d:%02d", minutes, seconds);
            }
        } catch (Exception e) {
            return "";
        }
    }

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
                String apiUrl = "https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=" + videoId + "&key=" + apiKey.trim();
                String responseBody = restClient.get()
                        .uri(apiUrl)
                        .retrieve()
                        .body(String.class);

                JsonNode root = objectMapper.readTree(responseBody);
                JsonNode items = root.path("items");
                if (items.isArray() && items.size() > 0) {
                    JsonNode item = items.get(0);
                    JsonNode snippet = item.path("snippet");
                    JsonNode contentDetails = item.path("contentDetails");

                    String title = snippet.path("title").asText("");
                    String channelTitle = snippet.path("channelTitle").asText("");
                    String publishedAtRaw = snippet.path("publishedAt").asText("");
                    String durationRaw = contentDetails.path("duration").asText("");
                    String duration = formatDuration(durationRaw);

                    String publishedDate = formatToKstDate(publishedAtRaw);

                    YouTubeInfoDto info = YouTubeInfoDto.builder()
                            .success(true)
                            .videoId(videoId)
                            .url("https://www.youtube.com/watch?v=" + videoId)
                            .title(title)
                            .publishedDate(publishedDate)
                            .channelTitle(channelTitle)
                            .thumbnailUrl(defaultThumb)
                            .source("api")
                            .message("YouTube Data API로 정보를 성공적으로 가져왔습니다.")
                            .build();
                    try {
                        info.setDuration(duration);
                    } catch (Throwable ignored) {}
                    return info;
                }
            } catch (Throwable e) {
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
                    .url("https://www.youtube.com/watch?v=" + videoId)
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
                Pattern datePattern = Pattern.compile("\"uploadDate\"\\s*:\\s*\"(\\d{4}-\\d{2}-\\d{2})");
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

    public String extractPlaylistId(String urlOrId) {
        if (urlOrId == null || urlOrId.isBlank()) return null;
        String trimmed = urlOrId.trim();
        Matcher matcher = Pattern.compile("[?&]list=([a-zA-Z0-9_-]+)").matcher(trimmed);
        if (matcher.find()) {
            return matcher.group(1);
        }
        if (trimmed.matches("^[a-zA-Z0-9_-]{12,}$")) {
            return trimmed;
        }
        return null;
    }

    public List<YouTubeInfoDto> getPlaylistVideos(String urlOrId) {
        String playlistId = extractPlaylistId(urlOrId);
        if (playlistId == null) {
            return Collections.emptyList();
        }

        List<YouTubeInfoDto> results = new ArrayList<>();
        if (apiKey != null && !apiKey.isBlank() && !apiKey.equalsIgnoreCase("YOUR_API_KEY")) {
            try {
                String pageToken = "";
                int pageCount = 0;
                while (pageCount < 6) { // 최대 300개 영상까지
                    String apiUrl = "https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=50&playlistId="
                            + playlistId + "&key=" + apiKey.trim();
                    if (!pageToken.isBlank()) {
                        apiUrl += "&pageToken=" + pageToken;
                    }

                    String responseBody = restClient.get().uri(apiUrl).retrieve().body(String.class);
                    JsonNode root = objectMapper.readTree(responseBody);
                    JsonNode items = root.path("items");
                    if (!items.isArray() || items.isEmpty()) break;

                    List<String> videoIds = new ArrayList<>();
                    List<YouTubeInfoDto> pageDtos = new ArrayList<>();

                    for (JsonNode item : items) {
                        JsonNode snippet = item.path("snippet");
                        String vId = snippet.path("resourceId").path("videoId").asText("");
                        if (vId.isBlank()) {
                            vId = item.path("contentDetails").path("videoId").asText("");
                        }
                        if (vId.isBlank()) continue;

                        String title = snippet.path("title").asText("");
                        if ("Private video".equalsIgnoreCase(title) || "Deleted video".equalsIgnoreCase(title)) {
                            continue;
                        }

                        // contentDetails.videoPublishedAt가 영상의 실제 업로드일
                        String videoPublishedAtRaw = item.path("contentDetails").path("videoPublishedAt").asText("");
                        if (videoPublishedAtRaw.isBlank()) {
                            videoPublishedAtRaw = snippet.path("publishedAt").asText("");
                        }
                        String publishedDate = formatToKstDate(videoPublishedAtRaw);

                        YouTubeInfoDto dto = YouTubeInfoDto.builder()
                                .success(true)
                                .videoId(vId)
                                .url("https://www.youtube.com/watch?v=" + vId + "&list=" + playlistId)
                                .title(title)
                                .publishedDate(publishedDate)
                                .channelTitle(snippet.path("channelTitle").asText(""))
                                .thumbnailUrl("https://img.youtube.com/vi/" + vId + "/hqdefault.jpg")
                                .source("api-playlist")
                                .build();

                        videoIds.add(vId);
                        pageDtos.add(dto);
                    }

                    // videoIds로 영상 길이 및 실제 snippet.publishedAt 조회 (50개 단위)
                    if (!videoIds.isEmpty()) {
                        try {
                            String vApiUrl = "https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id="
                                    + String.join(",", videoIds) + "&key=" + apiKey.trim();
                            String vResponseBody = restClient.get().uri(vApiUrl).retrieve().body(String.class);
                            JsonNode vRoot = objectMapper.readTree(vResponseBody);
                            Map<String, String> durationMap = new HashMap<>();
                            Map<String, String> realPubDateMap = new HashMap<>();

                            for (JsonNode vItem : vRoot.path("items")) {
                                String id = vItem.path("id").asText();
                                String durRaw = vItem.path("contentDetails").path("duration").asText("");
                                durationMap.put(id, formatDuration(durRaw));

                                String vPubRaw = vItem.path("snippet").path("publishedAt").asText("");
                                if (!vPubRaw.isBlank()) {
                                    realPubDateMap.put(id, formatToKstDate(vPubRaw));
                                }
                            }
                            for (YouTubeInfoDto dto : pageDtos) {
                                if (durationMap.containsKey(dto.getVideoId())) {
                                    dto.setDuration(durationMap.get(dto.getVideoId()));
                                }
                                // 실제 동영상 발행일(KST)로 정확히 업데이트
                                if (realPubDateMap.containsKey(dto.getVideoId())) {
                                    dto.setPublishedDate(realPubDateMap.get(dto.getVideoId()));
                                }
                            }
                        } catch (Exception e) {
                            log.warn("영상 상세 정보(길이, 발행일) 일괄 조회 실패: {}", e.getMessage());
                        }
                    }

                    results.addAll(pageDtos);
                    pageToken = root.path("nextPageToken").asText("");
                    if (pageToken.isBlank()) break;
                    pageCount++;
                }
                if (!results.isEmpty()) {
                    return results;
                }
            } catch (Exception e) {
                log.warn("YouTube Data API 재생목록 조회 실패: {}", e.getMessage());
            }
        }

        return results;
    }
}
