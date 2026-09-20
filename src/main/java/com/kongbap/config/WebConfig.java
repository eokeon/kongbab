package com.kongbap.config;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Configuration
@RequiredArgsConstructor
public class WebConfig implements WebMvcConfigurer {

    private final AdminAuthInterceptor adminAuthInterceptor;

    @Value("${kongbap.cors.allowed-origins:}")
    private String customAllowedOrigins;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        List<String> origins = new ArrayList<>(List.of(
                "http://localhost:8080",
                "http://localhost:63342",
                "http://localhost:3000",
                "http://localhost:5173",
                "http://127.0.0.1:8080",
                "http://127.0.0.1:63342",
                "http://127.0.0.1:3000",
                "http://127.0.0.1:5173"
        ));

        if (customAllowedOrigins != null && !customAllowedOrigins.isBlank()) {
            Arrays.stream(customAllowedOrigins.split(","))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .forEach(origins::add);
        }

        registry.addMapping("/**")
                .allowedOriginPatterns(origins.toArray(new String[0]))
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH")
                .allowedHeaders("*")
                .allowCredentials(true)
                .maxAge(3600);
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // /api 하위 모든 경로에 대해 인터셉터를 적용하며, 세부 권한(화이트리스트 등)은 AdminAuthInterceptor 내에서 중앙 제어
        registry.addInterceptor(adminAuthInterceptor)
                .addPathPatterns("/api/**");
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // 이미지, 스타일시트, JS 등 정적 자원에 브라우저 캐싱 헤더 적용
        registry.addResourceHandler("/assets/**")
                .addResourceLocations("classpath:/static/assets/")
                .setCacheControl(CacheControl.maxAge(30, TimeUnit.DAYS).cachePublic());

        registry.addResourceHandler("/css/**")
                .addResourceLocations("classpath:/static/css/")
                .setCacheControl(CacheControl.maxAge(7, TimeUnit.DAYS).cachePublic());

        registry.addResourceHandler("/js/**")
                .addResourceLocations("classpath:/static/js/")
                .setCacheControl(CacheControl.maxAge(7, TimeUnit.DAYS).cachePublic());
    }
}
