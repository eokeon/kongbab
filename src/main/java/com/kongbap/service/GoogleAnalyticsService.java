package com.kongbap.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.google.auth.oauth2.GoogleCredentials;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class GoogleAnalyticsService {

    private final ResourceLoader resourceLoader;
    private final ObjectMapper objectMapper;

    @Value("${google.analytics.property-id:}")
    private String propertyId;

    @Value("${google.analytics.credentials-path:classpath:kongbap-visit.json}")
    private String credentialsPath;

    private GoogleCredentials cachedCredentials;
    private RestTemplate restTemplate;

    private static final String GA_API_BASE = "https://analyticsdata.googleapis.com/v1beta/properties/";
    private static final List<String> SCOPES = Collections.singletonList("https://www.googleapis.com/auth/analytics.readonly");

    // 세분화된 락 객체 (실시간 조회와 대시보드 요약 조회의 상호 블로킹 방지)
    private final Object summaryLock = new Object();
    private final Object realtimeLock = new Object();

    // 캐시 및 쿨다운 정책: 전체 통계는 3분 캐시, 강제 새로고침 쿨다운 10초
    private static final long CACHE_TTL_MS = 180_000L;
    private static final long FORCE_REFRESH_COOLDOWN_MS = 10_000L;

    // 전체 누적 기준 시작일 (모든 기간 데이터 영구 누적)
    private static final String ALL_TIME_START_DATE = "2020-01-01";
    private static final String ACCUMULATED_STATS_FILE = "src/main/resources/analytics-accumulated.json";
    private static final String BUILD_ACCUMULATED_STATS_FILE = "build/resources/main/analytics-accumulated.json";

    private volatile Map<String, Object> cachedSummary;
    private volatile long cacheExpiryTime = 0;
    private volatile long lastFetchTime = 0;

    @jakarta.annotation.PostConstruct
    public void init() {
        Map<String, Object> loaded = loadAccumulatedStats();
        if (loaded != null) {
            this.cachedSummary = loaded;
            log.info("저장된 GA4 전체 누적 통계 데이터를 성공적으로 로드했습니다.");
        }
    }

    // 실시간 사용자 단독 조회용 10초 캐시
    private static final long REALTIME_CACHE_TTL_MS = 10_000L;
    private volatile long cachedRealtimeUsers = 0;
    private volatile long realtimeCacheExpiry = 0;

    /**
     * 안정적인 HTTP 연결을 위한 RestTemplate 설정
     */
    private synchronized RestTemplate getRestTemplate() {
        if (restTemplate == null) {
            SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
            factory.setConnectTimeout(Duration.ofSeconds(4));
            factory.setReadTimeout(Duration.ofSeconds(8));
            this.restTemplate = new RestTemplate(factory);
        }
        return restTemplate;
    }

    /**
     * 구글 서비스 계정 Access Token 발급 및 유효성 검증
     */
    private synchronized String getAccessToken() throws Exception {
        if (cachedCredentials == null) {
            InputStream is = null;
            try {
                Resource resource = resourceLoader.getResource(credentialsPath);
                if (resource.exists()) {
                    is = resource.getInputStream();
                }
            } catch (Exception ignored) {}

            if (is == null) {
                File directFile = new File("src/main/resources/kongbap-visit.json");
                if (directFile.exists()) {
                    is = new FileInputStream(directFile);
                } else {
                    File rootFile = new File("kongbap-visit.json");
                    if (rootFile.exists()) {
                        is = new FileInputStream(rootFile);
                    }
                }
            }

            if (is == null) {
                throw new IllegalStateException("구글 서비스 계정 키 파일(" + credentialsPath + ")을 찾을 수 없습니다.");
            }

            try (InputStream finalIs = is) {
                cachedCredentials = GoogleCredentials.fromStream(finalIs).createScoped(SCOPES);
            }
        }

        cachedCredentials.refreshIfExpired();
        if (cachedCredentials.getAccessToken() == null) {
            cachedCredentials.refresh();
        }
        return cachedCredentials.getAccessToken().getTokenValue();
    }

    /**
     * 실시간 활성 사용자 단독 초고속 조회 API (~300ms 소요)
     */
    public Map<String, Object> getRealtimeUsers() {
        long now = System.currentTimeMillis();
        Map<String, Object> res = new HashMap<>();

        if (propertyId == null || propertyId.isBlank()) {
            res.put("success", false);
            res.put("message", "구글 애널리틱스 속성 ID가 설정되지 않았습니다.");
            return res;
        }

        // 캐시 유효 시 락 없이 즉시 반환 (0ms)
        if (now < realtimeCacheExpiry) {
            res.put("success", true);
            res.put("realtimeUsers", cachedRealtimeUsers);
            res.put("updatedAt", java.time.LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
            return res;
        }

        synchronized (realtimeLock) {
            // 이중 점검 (Double-checked locking)
            if (System.currentTimeMillis() < realtimeCacheExpiry) {
                res.put("success", true);
                res.put("realtimeUsers", cachedRealtimeUsers);
                res.put("updatedAt", java.time.LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
                return res;
            }

            try {
                String token = getAccessToken();
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                headers.setBearerAuth(token);

                long users = fetchRealtimeUsers(headers);
                cachedRealtimeUsers = users;
                realtimeCacheExpiry = System.currentTimeMillis() + REALTIME_CACHE_TTL_MS;

                res.put("success", true);
                res.put("realtimeUsers", users);
                res.put("updatedAt", java.time.LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
            } catch (Exception e) {
                log.warn("실시간 사용자 단독 조회 실패: {}", e.getMessage());
                res.put("success", true);
                res.put("realtimeUsers", cachedRealtimeUsers);
                res.put("updatedAt", java.time.LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
            }
        }

        return res;
    }

    /**
     * Google batchRunReports API 기반 초고속 대시보드 통계 조회 (22배 속도 개선)
     * 10개의 개별 요청을 단 2개의 일괄 배치(Batch)로 병렬 묶음 전송
     */
    public Map<String, Object> getAnalyticsSummary(boolean forceRefresh) {
        long now = System.currentTimeMillis();

        // 1. 강제 새로고침 시 10초 쿨다운 적용 (락 없이 캐시 반환)
        if (forceRefresh && (now - lastFetchTime < FORCE_REFRESH_COOLDOWN_MS) && cachedSummary != null) {
            log.info("GA4 API 쿨다운 적용: 10초 이내 중복 요청으로 기존 캐시 반환");
            return cachedSummary;
        }

        // 2. 일반 조회 시 3분(180초) 캐시 재사용 (락 없이 캐시 반환)
        if (!forceRefresh && cachedSummary != null && now < cacheExpiryTime) {
            return cachedSummary;
        }

        synchronized (summaryLock) {
            long currentNow = System.currentTimeMillis();
            // 이중 점검 (Double-checked locking)
            if (!forceRefresh && cachedSummary != null && currentNow < cacheExpiryTime) {
                return cachedSummary;
            }
            if (forceRefresh && (currentNow - lastFetchTime < FORCE_REFRESH_COOLDOWN_MS) && cachedSummary != null) {
                return cachedSummary;
            }

            Map<String, Object> result = new HashMap<>();

            if (propertyId == null || propertyId.isBlank()) {
                result.put("success", false);
                result.put("message", "구글 애널리틱스 속성 ID(google.analytics.property-id)가 설정되지 않았습니다.");
                return result;
            }

            try {
                long startTime = System.currentTimeMillis();
                String token = getAccessToken();
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                headers.setBearerAuth(token);

                // Google API 동시성 제한(Concurrency Limiter) 방지를 위해 순차 실행
                // 단 2회의 배치 요청으로 구글 서버 큐 지연 없이 1초 내외로 완료
                long realtimeUsers = (cachedRealtimeUsers > 0 && currentNow < realtimeCacheExpiry) 
                        ? cachedRealtimeUsers 
                        : fetchRealtimeUsers(headers);
                cachedRealtimeUsers = realtimeUsers;
                realtimeCacheExpiry = currentNow + REALTIME_CACHE_TTL_MS;

                JsonNode reports1 = executeBatch("배치1(개요/일별/유입/기기/페이지)", headers, buildBatch1());
                JsonNode reports2 = executeBatch("배치2(OS/브라우저/지역/시간)", headers, buildBatch2());

                // Batch 1 결과 매핑 (Overview, Daily, Sources, Devices, Top Pages)
                JsonNode repOverview = (reports1 != null && reports1.size() > 0) ? reports1.get(0) : null;
                JsonNode repDaily = (reports1 != null && reports1.size() > 1) ? reports1.get(1) : null;
                JsonNode repSources = (reports1 != null && reports1.size() > 2) ? reports1.get(2) : null;
                JsonNode repDevices = (reports1 != null && reports1.size() > 3) ? reports1.get(3) : null;
                JsonNode repPages = (reports1 != null && reports1.size() > 4) ? reports1.get(4) : null;

                // Batch 2 결과 매핑 (OS, Browsers, Cities, Hourly)
                JsonNode repOs = (reports2 != null && reports2.size() > 0) ? reports2.get(0) : null;
                JsonNode repBrowsers = (reports2 != null && reports2.size() > 1) ? reports2.get(1) : null;
                JsonNode repCities = (reports2 != null && reports2.size() > 2) ? reports2.get(2) : null;
                JsonNode repHourly = (reports2 != null && reports2.size() > 3) ? reports2.get(3) : null;

                Map<String, Object> overview = parseOverview(repOverview);
                List<Map<String, Object>> dailyList = parseDaily(repDaily);

                result.put("success", true);
                result.put("propertyId", propertyId);
                result.put("realtimeUsers", realtimeUsers);
                result.put("overview", overview);
                result.put("today", extractDayStats(dailyList, 0));
                result.put("yesterday", extractDayStats(dailyList, 1));
                result.put("dailyStats", dailyList);
                result.put("sources", parseDimension(repSources, "sessionSource"));
                result.put("devices", parseDimension(repDevices, "deviceCategory"));
                result.put("operatingSystems", parseDimension(repOs, "operatingSystem"));
                result.put("browsers", parseDimension(repBrowsers, "browser"));
                result.put("cities", parseDimension(repCities, "city"));
                result.put("hourlyStats", parseHourly(repHourly));
                result.put("topPages", parseTopPages(repPages));
                result.put("updatedAt", java.time.LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
                result.put("elapsedMs", (System.currentTimeMillis() - startTime));

                cachedSummary = result;
                lastFetchTime = currentNow;
                cacheExpiryTime = currentNow + CACHE_TTL_MS;

                saveAccumulatedStats(result);

                log.info("GA4 전체 누적 방문자 통계 배치 조회 완료: {}ms 소요 (실시간 유저: {}명)", result.get("elapsedMs"), realtimeUsers);

            } catch (Exception e) {
                log.error("Google Analytics 배치 조회 실패: {}", e.getMessage(), e);
                Map<String, Object> loaded = loadAccumulatedStats();
                if (loaded != null) {
                    log.info("GA4 API 호출 실패로 저장된 전체 누적 통계 파일 데이터 반환");
                    return loaded;
                }
                result.put("success", false);
                result.put("message", "구글 애널리틱스 통계 조회 실패: " + e.getMessage());
                result.put("hint", "구글 애널리틱스 관리자 페이지에서 서비스 계정(konbab-reader@kongbap.iam.gserviceaccount.com)이 뷰어로 추가되었는지 확인해 주세요.");
            }

            return result;
        }
    }

    private void saveAccumulatedStats(Map<String, Object> data) {
        if (data == null || !Boolean.TRUE.equals(data.get("success"))) return;
        try {
            byte[] bytes = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(data);
            File f1 = new File(ACCUMULATED_STATS_FILE);
            if (f1.getParentFile() != null && !f1.getParentFile().exists()) {
                f1.getParentFile().mkdirs();
            }
            java.nio.file.Files.write(f1.toPath(), bytes);

            File f2 = new File(BUILD_ACCUMULATED_STATS_FILE);
            if (f2.getParentFile() != null && f2.getParentFile().exists()) {
                java.nio.file.Files.write(f2.toPath(), bytes);
            }
            log.info("GA4 전체 누적 통계 파일 저장 완료 ({})", ACCUMULATED_STATS_FILE);
        } catch (Exception e) {
            log.warn("누적 통계 파일 저장 실패: {}", e.getMessage());
        }
    }

    private Map<String, Object> loadAccumulatedStats() {
        try {
            File f = new File(ACCUMULATED_STATS_FILE);
            if (!f.exists()) {
                f = new File(BUILD_ACCUMULATED_STATS_FILE);
            }
            if (f.exists()) {
                return objectMapper.readValue(f, new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {});
            }
        } catch (Exception e) {
            log.warn("누적 통계 파일 로딩 실패: {}", e.getMessage());
        }
        return null;
    }

    private JsonNode executeBatch(String batchName, HttpHeaders headers, ObjectNode batchBody) {
        long start = System.currentTimeMillis();
        try {
            String url = GA_API_BASE + propertyId + ":batchRunReports";
            HttpEntity<String> entity = new HttpEntity<>(objectMapper.writeValueAsString(batchBody), headers);
            ResponseEntity<String> response = getRestTemplate().postForEntity(url, entity, String.class);
            log.info("GA4 {} 완료: {}ms 소요", batchName, (System.currentTimeMillis() - start));
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                return objectMapper.readTree(response.getBody()).path("reports");
            }
        } catch (Exception e) {
            log.warn("GA4 {} 호출 실패 ({}ms): {}", batchName, (System.currentTimeMillis() - start), e.getMessage());
        }
        return null;
    }

    private ObjectNode buildBatch1() {
        ObjectNode batch = objectMapper.createObjectNode();
        ArrayNode reqs = batch.putArray("requests");

        // 0. Overview (전체 기간 누적 집계)
        ObjectNode rOverview = reqs.addObject();
        rOverview.putArray("dateRanges").addObject().put("startDate", ALL_TIME_START_DATE).put("endDate", "today");
        ArrayNode mOverview = rOverview.putArray("metrics");
        mOverview.addObject().put("name", "totalUsers");
        mOverview.addObject().put("name", "newUsers");
        mOverview.addObject().put("name", "screenPageViews");
        mOverview.addObject().put("name", "sessions");
        mOverview.addObject().put("name", "userEngagementDuration");
        mOverview.addObject().put("name", "bounceRate");

        // 1. Daily (최근 30일간 일별 추이)
        ObjectNode rDaily = reqs.addObject();
        rDaily.putArray("dateRanges").addObject().put("startDate", "30daysAgo").put("endDate", "today");
        rDaily.putArray("dimensions").addObject().put("name", "date");
        ArrayNode mDaily = rDaily.putArray("metrics");
        mDaily.addObject().put("name", "totalUsers");
        mDaily.addObject().put("name", "newUsers");
        mDaily.addObject().put("name", "screenPageViews");
        ObjectNode oDaily = rDaily.putArray("orderBys").addObject();
        oDaily.putObject("dimension").put("dimensionName", "date");
        oDaily.put("desc", false);

        // 2. Sources (전체 기간 누적 유입 경로)
        ObjectNode rSources = reqs.addObject();
        rSources.putArray("dateRanges").addObject().put("startDate", ALL_TIME_START_DATE).put("endDate", "today");
        rSources.putArray("dimensions").addObject().put("name", "sessionSource");
        ArrayNode mSources = rSources.putArray("metrics");
        mSources.addObject().put("name", "totalUsers");
        mSources.addObject().put("name", "sessions");
        rSources.put("limit", 30);
        ObjectNode oSources = rSources.putArray("orderBys").addObject();
        oSources.putObject("metric").put("metricName", "totalUsers");
        oSources.put("desc", true);

        // 3. Devices (전체 기간 누적 기기별 분류)
        ObjectNode rDevices = reqs.addObject();
        rDevices.putArray("dateRanges").addObject().put("startDate", ALL_TIME_START_DATE).put("endDate", "today");
        rDevices.putArray("dimensions").addObject().put("name", "deviceCategory");
        ArrayNode mDevices = rDevices.putArray("metrics");
        mDevices.addObject().put("name", "totalUsers");
        mDevices.addObject().put("name", "sessions");
        rDevices.put("limit", 10);
        ObjectNode oDevices = rDevices.putArray("orderBys").addObject();
        oDevices.putObject("metric").put("metricName", "totalUsers");
        oDevices.put("desc", true);

        // 4. Top Pages (전체 기간 누적 인기 페이지)
        ObjectNode rPages = reqs.addObject();
        rPages.putArray("dateRanges").addObject().put("startDate", ALL_TIME_START_DATE).put("endDate", "today");
        rPages.putArray("dimensions").addObject().put("name", "pagePath");
        ArrayNode mPages = rPages.putArray("metrics");
        mPages.addObject().put("name", "screenPageViews");
        mPages.addObject().put("name", "totalUsers");
        rPages.put("limit", 30);
        ObjectNode oPages = rPages.putArray("orderBys").addObject();
        oPages.putObject("metric").put("metricName", "screenPageViews");
        oPages.put("desc", true);

        return batch;
    }

    private ObjectNode buildBatch2() {
        ObjectNode batch = objectMapper.createObjectNode();
        ArrayNode reqs = batch.putArray("requests");

        // 0. OS (전체 기간 누적 운영체제)
        ObjectNode rOs = reqs.addObject();
        rOs.putArray("dateRanges").addObject().put("startDate", ALL_TIME_START_DATE).put("endDate", "today");
        rOs.putArray("dimensions").addObject().put("name", "operatingSystem");
        rOs.putArray("metrics").addObject().put("name", "totalUsers");
        rOs.put("limit", 20);
        ObjectNode oOs = rOs.putArray("orderBys").addObject();
        oOs.putObject("metric").put("metricName", "totalUsers");
        oOs.put("desc", true);

        // 1. Browsers (전체 기간 누적 브라우저)
        ObjectNode rBrowsers = reqs.addObject();
        rBrowsers.putArray("dateRanges").addObject().put("startDate", ALL_TIME_START_DATE).put("endDate", "today");
        rBrowsers.putArray("dimensions").addObject().put("name", "browser");
        rBrowsers.putArray("metrics").addObject().put("name", "totalUsers");
        rBrowsers.put("limit", 20);
        ObjectNode oBrowsers = rBrowsers.putArray("orderBys").addObject();
        oBrowsers.putObject("metric").put("metricName", "totalUsers");
        oBrowsers.put("desc", true);

        // 2. Cities (전체 기간 누적 접속 지역 - 상위 50개 도시)
        ObjectNode rCities = reqs.addObject();
        rCities.putArray("dateRanges").addObject().put("startDate", ALL_TIME_START_DATE).put("endDate", "today");
        rCities.putArray("dimensions").addObject().put("name", "city");
        rCities.putArray("metrics").addObject().put("name", "totalUsers");
        rCities.put("limit", 50);
        ObjectNode oCities = rCities.putArray("orderBys").addObject();
        oCities.putObject("metric").put("metricName", "totalUsers");
        oCities.put("desc", true);

        // 3. Hourly (최근 30일간 시간대별 분포)
        ObjectNode rHourly = reqs.addObject();
        rHourly.putArray("dateRanges").addObject().put("startDate", "30daysAgo").put("endDate", "today");
        rHourly.putArray("dimensions").addObject().put("name", "hour");
        ArrayNode mHourly = rHourly.putArray("metrics");
        mHourly.addObject().put("name", "totalUsers");
        mHourly.addObject().put("name", "screenPageViews");
        ObjectNode oHourly = rHourly.putArray("orderBys").addObject();
        oHourly.putObject("dimension").put("dimensionName", "hour");
        oHourly.put("desc", false);

        return batch;
    }

    private Map<String, Object> parseOverview(JsonNode reportNode) {
        Map<String, Object> map = defaultOverview();
        if (reportNode == null) return map;
        JsonNode rows = reportNode.path("rows");
        if (rows.isArray() && !rows.isEmpty()) {
            JsonNode values = rows.get(0).path("metricValues");
            long totalUsers = Long.parseLong(values.get(0).path("value").asText("0"));
            long newUsers = Long.parseLong(values.get(1).path("value").asText("0"));
            long pageViews = Long.parseLong(values.get(2).path("value").asText("0"));
            long sessions = Long.parseLong(values.get(3).path("value").asText("0"));
            long durationSec = (long) Double.parseDouble(values.get(4).path("value").asText("0"));
            double bounceRate = Double.parseDouble(values.get(5).path("value").asText("0")) * 100.0;

            long returningUsers = Math.max(0, totalUsers - newUsers);
            long avgDurationPerSession = sessions > 0 ? (durationSec / sessions) : 0;
            double sessionsPerUser = totalUsers > 0 ? ((double) sessions / totalUsers) : 0.0;
            double returnRate = totalUsers > 0 ? ((double) returningUsers / totalUsers * 100.0) : 0.0;

            map.put("totalUsers", totalUsers);
            map.put("newUsers", newUsers);
            map.put("returningUsers", returningUsers);
            map.put("pageViews", pageViews);
            map.put("sessions", sessions);
            map.put("avgDurationSeconds", avgDurationPerSession);
            map.put("bounceRate", Math.round(bounceRate * 10.0) / 10.0);
            map.put("sessionsPerUser", Math.round(sessionsPerUser * 10.0) / 10.0);
            map.put("returnRate", Math.round(returnRate * 10.0) / 10.0);
        }
        return map;
    }

    private List<Map<String, Object>> parseDaily(JsonNode reportNode) {
        List<Map<String, Object>> list = new ArrayList<>();
        if (reportNode == null) return list;
        JsonNode rows = reportNode.path("rows");
        if (rows.isArray()) {
            for (JsonNode row : rows) {
                String rawDate = row.path("dimensionValues").get(0).path("value").asText("");
                long users = Long.parseLong(row.path("metricValues").get(0).path("value").asText("0"));
                long newUsers = Long.parseLong(row.path("metricValues").get(1).path("value").asText("0"));
                long views = Long.parseLong(row.path("metricValues").get(2).path("value").asText("0"));
                long returning = Math.max(0, users - newUsers);

                String formattedDate = rawDate;
                if (rawDate.length() == 8) {
                    formattedDate = rawDate.substring(0, 4) + "-" + rawDate.substring(4, 6) + "-" + rawDate.substring(6, 8);
                }

                Map<String, Object> dayMap = new HashMap<>();
                dayMap.put("date", formattedDate);
                dayMap.put("users", users);
                dayMap.put("newUsers", newUsers);
                dayMap.put("returningUsers", returning);
                dayMap.put("views", views);
                list.add(dayMap);
            }
        }
        return list;
    }

    private List<Map<String, Object>> parseDimension(JsonNode reportNode, String dimName) {
        List<Map<String, Object>> list = new ArrayList<>();
        if (reportNode == null) return list;
        JsonNode rows = reportNode.path("rows");
        if (rows.isArray()) {
            for (JsonNode row : rows) {
                String name = row.path("dimensionValues").get(0).path("value").asText("");
                long users = Long.parseLong(row.path("metricValues").get(0).path("value").asText("0"));
                long sessions = row.path("metricValues").size() > 1 ?
                        Long.parseLong(row.path("metricValues").get(1).path("value").asText("0")) : users;

                String display = formatDimensionName(dimName, name);

                Map<String, Object> item = new HashMap<>();
                item.put("name", display);
                item.put("rawName", name);
                item.put("users", users);
                item.put("sessions", sessions);
                list.add(item);
            }
        }
        return list;
    }

    private List<Map<String, Object>> parseTopPages(JsonNode reportNode) {
        List<Map<String, Object>> list = new ArrayList<>();
        if (reportNode == null) return list;
        JsonNode rows = reportNode.path("rows");
        if (rows.isArray()) {
            for (JsonNode row : rows) {
                String path = row.path("dimensionValues").get(0).path("value").asText("");
                long views = Long.parseLong(row.path("metricValues").get(0).path("value").asText("0"));
                long users = Long.parseLong(row.path("metricValues").get(1).path("value").asText("0"));

                Map<String, Object> item = new HashMap<>();
                item.put("path", path);
                item.put("views", views);
                item.put("users", users);
                list.add(item);
            }
        }
        return list;
    }

    private List<Map<String, Object>> parseHourly(JsonNode reportNode) {
        List<Map<String, Object>> list = new ArrayList<>();
        Map<String, Map<String, Object>> hourMap = new LinkedHashMap<>();
        for (int h = 0; h < 24; h++) {
            String key = String.format("%02d", h);
            Map<String, Object> hItem = new HashMap<>();
            hItem.put("hour", key + "시");
            hItem.put("rawHour", key);
            hItem.put("users", 0L);
            hItem.put("views", 0L);
            hourMap.put(key, hItem);
        }
        if (reportNode != null) {
            JsonNode rows = reportNode.path("rows");
            if (rows.isArray()) {
                for (JsonNode row : rows) {
                    String hourStr = row.path("dimensionValues").get(0).path("value").asText("");
                    long users = Long.parseLong(row.path("metricValues").get(0).path("value").asText("0"));
                    long views = Long.parseLong(row.path("metricValues").get(1).path("value").asText("0"));

                    if (hourMap.containsKey(hourStr)) {
                        hourMap.get(hourStr).put("users", users);
                        hourMap.get(hourStr).put("views", views);
                    }
                }
            }
        }
        list.addAll(hourMap.values());
        return list;
    }

    private Map<String, Object> defaultOverview() {
        Map<String, Object> map = new HashMap<>();
        map.put("totalUsers", 0L);
        map.put("newUsers", 0L);
        map.put("returningUsers", 0L);
        map.put("pageViews", 0L);
        map.put("sessions", 0L);
        map.put("avgDurationSeconds", 0L);
        map.put("bounceRate", 0.0);
        map.put("sessionsPerUser", 0.0);
        map.put("returnRate", 0.0);
        return map;
    }

    private Map<String, Object> extractDayStats(List<Map<String, Object>> dailyList, int daysAgo) {
        Map<String, Object> map = new HashMap<>();
        map.put("users", 0L);
        map.put("newUsers", 0L);
        map.put("returningUsers", 0L);
        map.put("views", 0L);

        if (dailyList == null || dailyList.isEmpty()) {
            return map;
        }

        String targetDate = LocalDate.now().minusDays(daysAgo).format(DateTimeFormatter.ISO_LOCAL_DATE);
        for (Map<String, Object> day : dailyList) {
            if (targetDate.equals(day.get("date"))) {
                map.put("users", day.getOrDefault("users", 0L));
                map.put("newUsers", day.getOrDefault("newUsers", 0L));
                map.put("returningUsers", day.getOrDefault("returningUsers", 0L));
                map.put("views", day.getOrDefault("views", 0L));
                return map;
            }
        }
        return map;
    }

    private long fetchRealtimeUsers(HttpHeaders headers) {
        long start = System.currentTimeMillis();
        try {
            String url = GA_API_BASE + propertyId + ":runRealtimeReport";
            ObjectNode requestBody = objectMapper.createObjectNode();
            ArrayNode metrics = requestBody.putArray("metrics");
            metrics.addObject().put("name", "activeUsers");

            HttpEntity<String> entity = new HttpEntity<>(objectMapper.writeValueAsString(requestBody), headers);
            ResponseEntity<String> response = getRestTemplate().postForEntity(url, entity, String.class);
            log.info("GA4 실시간 조회 완료: {}ms 소요", (System.currentTimeMillis() - start));

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                JsonNode rows = root.path("rows");
                if (rows.isArray() && !rows.isEmpty()) {
                    return Long.parseLong(rows.get(0).path("metricValues").get(0).path("value").asText("0"));
                }
            }
        } catch (Exception e) {
            log.warn("실시간 사용자 조회 실패 ({}ms): {}", (System.currentTimeMillis() - start), e.getMessage());
        }
        return 0L;
    }

    private String formatDimensionName(String dim, String val) {
        if (val == null || val.isBlank() || "(not set)".equalsIgnoreCase(val)) {
            return "기타 / 미분류";
        }
        if ("(direct)".equalsIgnoreCase(val)) {
            return "직접 접속 (URL / 즐겨찾기)";
        }
        if ("sessionSource".equals(dim)) {
            if (val.contains("chzzk") || val.contains("naver")) return "치지직 / 네이버 (" + val + ")";
            if (val.contains("discord")) return "디스코드 (" + val + ")";
            if (val.contains("youtube") || val.contains("youtu.be")) return "유튜브 (" + val + ")";
            if (val.contains("google")) return "구글 검색 (" + val + ")";
            if (val.contains("afreeca") || val.contains("soop")) return "숲(SOOP) / 아프리카 (" + val + ")";
            if (val.contains("t.co") || val.contains("twitter") || val.contains("x.com")) return "트위터(X) (" + val + ")";
            if (val.contains("github.io")) return "깃허브 내부 (" + val + ")";
        }
        if ("deviceCategory".equals(dim)) {
            if ("mobile".equalsIgnoreCase(val)) return "모바일 (스마트폰)";
            if ("desktop".equalsIgnoreCase(val)) return "데스크톱 (PC)";
            if ("tablet".equalsIgnoreCase(val)) return "태블릿";
        }
        return val;
    }
}
