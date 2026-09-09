package com.kongbab.config;

import com.kongbab.domain.Streamer;
import com.kongbab.repository.StreamerRepository;
import com.kongbab.service.StreamerService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final StreamerRepository streamerRepository;
    private final StreamerService streamerService;

    @Override
    public void run(String... args) {
        if (streamerRepository.count() == 0) {
            log.info("Streamer 테이블이 비어 있어 초기 경찰 35명 데이터를 등록합니다.");

            String[][] policeList = {
                    {"pol-1", "김윤성", "김뿡", "경찰청장", "bg-blue-600"},
                    {"pol-2", "강 / 강반장 / 강전규 / 김사복", "사모장", "부청장", "bg-indigo-600"},
                    {"pol-3", "꽃거지", "꽃빈", "", "bg-zinc-800"},
                    {"pol-4", "나비리", "나나양", "", "bg-zinc-800"},
                    {"pol-5", "김폭설 / 김폭염", "눈꽃", "", "bg-zinc-800"},
                    {"pol-6", "김맹군", "단군", "", "bg-zinc-800"},
                    {"pol-7", "담유잉", "담유이", "", "bg-zinc-800"},
                    {"pol-8", "김영균 / 김동균", "댕균", "", "bg-zinc-800"},
                    {"pol-9", "악당", "델로략국", "", "bg-zinc-800"},
                    {"pol-10", "성말순", "둥그레", "", "bg-zinc-800"},
                    {"pol-11", "로보캅", "로보 문릿", "", "bg-zinc-800"},
                    {"pol-12", "맹숙희", "맹숙", "", "bg-zinc-800"},
                    {"pol-13", "미도바", "미도미도 마요", "", "bg-zinc-800"},
                    {"pol-14", "미채린", "미치르 메르헨", "", "bg-zinc-800"},
                    {"pol-15", "박기인", "바뀐", "", "bg-zinc-800"},
                    {"pol-16", "배준식", "뱅", "", "bg-zinc-800"},
                    {"pol-17", "뵤순경", "뵤오", "", "bg-zinc-800"},
                    {"pol-18", "엄충수 / 계충식 / 엄엄엄", "씨랙", "", "bg-zinc-800"},
                    {"pol-19", "김우유", "아야 AYA", "", "bg-zinc-800"},
                    {"pol-20", "어왜요", "오화요", "", "bg-zinc-800"},
                    {"pol-21", "유연희", "연리", "", "bg-zinc-800"},
                    {"pol-22", "김세빈", "연비니", "", "bg-zinc-800"},
                    {"pol-23", "필석호", "인간젤리", "", "bg-zinc-800"},
                    {"pol-24", "한예린", "채현찌", "", "bg-zinc-800"},
                    {"pol-25", "차수현", "초승달", "", "bg-zinc-800"},
                    {"pol-26", "나견차", "쿠레나이 나츠키", "", "bg-zinc-800"},
                    {"pol-27", "박정의 / 밥좀우 / 피닉스박", "피닉스박", "", "bg-zinc-800"},
                    {"pol-28", "햄재민", "햄쿠비", "", "bg-zinc-800"},
                    {"pol-29", "강레나", "달콤레나", "", "bg-zinc-800"},
                    {"pol-30", "정상화", "명예훈장", "", "bg-zinc-800"},
                    {"pol-31", "메네라", "키리키리꼬키리", "", "bg-zinc-800"},
                    {"pol-32", "시고르자브냥이", "진덕춘", "", "bg-zinc-800"},
                    {"pol-33", "김다미", "새담", "", "bg-zinc-800"},
                    {"pol-34", "엄현자", "콩천", "", "bg-zinc-800"},
                    {"pol-35", "단백질소나타", "연주하는곰탱", "", "bg-zinc-800"}
            };

            List<Streamer> streamers = new ArrayList<>();
            for (int i = 0; i < policeList.length; i++) {
                String[] item = policeList[i];
                streamers.add(Streamer.builder()
                        .customId(item[0])
                        .name(item[1])
                        .streamer(item[2])
                        .category("police")
                        .subgroup(null)
                        .role(item[3])
                        .badgeColor(item[4])
                        .avatar("assets/default-avatar.svg")
                        .displayOrder(i)
                        .build());
            }

            streamerRepository.saveAll(streamers);
            log.info("기본 경찰 35명 등록 완료 (총 {}건)", streamers.size());
        }

        // 항상 최신 streamers.json 정적 파일 내보내기 보장
        streamerService.exportStaticJson();
    }
}
