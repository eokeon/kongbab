package com.kongbap.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.DefaultResourceLoader;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class AnalyticsOptimizationTest {

    private GoogleAnalyticsService googleAnalyticsService;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        googleAnalyticsService = new GoogleAnalyticsService(new DefaultResourceLoader(), objectMapper);
    }

    @Test
    @DisplayName("GoogleAnalyticsService: 속성 ID 미설정 시 안전한 에러 응답 반환 및 예외 미발생")
    void testUnconfiguredPropertyHandling() {
        ReflectionTestUtils.setField(googleAnalyticsService, "propertyId", "");

        Map<String, Object> realtimeRes = googleAnalyticsService.getRealtimeUsers();
        assertThat(realtimeRes).isNotNull();
        assertThat(realtimeRes.get("success")).isEqualTo(false);
        assertThat(realtimeRes.get("message")).asString().contains("속성 ID");

        Map<String, Object> summaryRes = googleAnalyticsService.getAnalyticsSummary(false);
        assertThat(summaryRes).isNotNull();
        assertThat(summaryRes.get("success")).isEqualTo(false);
        assertThat(summaryRes.get("message")).asString().contains("속성 ID");
    }

    @Test
    @DisplayName("GoogleAnalyticsService: 실시간 사용자 캐시 즉시 반환 (0ms 락 프리 동작)")
    void testRealtimeCacheLockFree() {
        ReflectionTestUtils.setField(googleAnalyticsService, "propertyId", "12345678");
        ReflectionTestUtils.setField(googleAnalyticsService, "cachedRealtimeUsers", 77L);
        // 캐시 만료 시간을 미래로 설정
        ReflectionTestUtils.setField(googleAnalyticsService, "realtimeCacheExpiry", System.currentTimeMillis() + 60_000L);

        Map<String, Object> res = googleAnalyticsService.getRealtimeUsers();
        assertThat(res).isNotNull();
        assertThat(res.get("success")).isEqualTo(true);
        assertThat(res.get("realtimeUsers")).isEqualTo(77L);
    }

    @Test
    @DisplayName("GoogleAnalyticsService: 대시보드 요약 캐시 및 강제 새로고침 쿨다운 검증")
    void testSummaryCacheAndCooldown() {
        ReflectionTestUtils.setField(googleAnalyticsService, "propertyId", "12345678");

        Map<String, Object> mockCache = Map.of("success", true, "testKey", "testValue");
        ReflectionTestUtils.setField(googleAnalyticsService, "cachedSummary", mockCache);
        ReflectionTestUtils.setField(googleAnalyticsService, "cacheExpiryTime", System.currentTimeMillis() + 180_000L);
        ReflectionTestUtils.setField(googleAnalyticsService, "lastFetchTime", System.currentTimeMillis() - 2_000L); // 2초 전 호출

        // 1. 일반 조회 시 캐시 즉시 반환
        Map<String, Object> cachedRes = googleAnalyticsService.getAnalyticsSummary(false);
        assertThat(cachedRes).isSameAs(mockCache);

        // 2. 10초 이내 강제 새로고침 시 쿨다운으로 기존 캐시 반환
        Map<String, Object> cooldownRes = googleAnalyticsService.getAnalyticsSummary(true);
        assertThat(cooldownRes).isSameAs(mockCache);
    }

    @Test
    @DisplayName("GoogleAnalyticsService: 세부 영상 탭(&tab=full 등)을 인원(member) 단위로 정상 정규화 및 합산 검증")
    void testParseTopPagesNormalizeToMember() throws Exception {
        String json = """
        {
          "rows": [
            {
              "dimensionValues": [{"value": "/kongbap/?category=police&member=pol-14&tab=full"}],
              "metricValues": [{"value": "10"}, {"value": "3"}]
            },
            {
              "dimensionValues": [{"value": "/kongbap/?category=police&member=pol-14&tab=binge"}],
              "metricValues": [{"value": "5"}, {"value": "2"}]
            },
            {
              "dimensionValues": [{"value": "/kongbap/?category=police"}],
              "metricValues": [{"value": "20"}, {"value": "8"}]
            },
            {
              "dimensionValues": [{"value": "/kongbap/"}],
              "metricValues": [{"value": "50"}, {"value": "10"}]
            }
          ]
        }
        """;

        com.fasterxml.jackson.databind.JsonNode reportNode = objectMapper.readTree(json);
        java.util.List<Map<String, Object>> topPages = ReflectionTestUtils.invokeMethod(
                googleAnalyticsService, "parseTopPages", reportNode);

        assertThat(topPages).isNotNull();
        assertThat(topPages).hasSize(3); // /kongbap/, /kongbap/?category=police, /kongbap/?category=police&member=pol-14

        // 1순위: /kongbap/ (50 views)
        assertThat(topPages.get(0).get("path")).isEqualTo("/kongbap/");
        assertThat(topPages.get(0).get("views")).isEqualTo(50L);

        // 2순위: /kongbap/?category=police (20 views)
        assertThat(topPages.get(1).get("path")).isEqualTo("/kongbap/?category=police");
        assertThat(topPages.get(1).get("views")).isEqualTo(20L);

        // 3순위: /kongbap/?category=police&member=pol-14 (10 + 5 = 15 views 합산됨!)
        Map<String, Object> memberItem = topPages.get(2);
        assertThat(memberItem.get("path")).isEqualTo("/kongbap/?category=police&member=pol-14");
        assertThat(memberItem.get("views")).isEqualTo(15L);
        assertThat(memberItem.get("users")).isEqualTo(3L);
        assertThat(memberItem.get("category")).isEqualTo("police");
        assertThat(memberItem.get("member")).isEqualTo("pol-14");
    }
}
