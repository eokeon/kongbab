# 콩밥특별시 GTA RP 유튜브 영상 아카이브 & 백업 시스템

콩밥특별시 GTA 스트리머 서버의 다양한 세력(경찰, EMS, 갱단, 사업체, 기자, 시민)과 소속 스트리머/캐릭터별 유튜브 영상 및 클립을 관리하고, **히오스(HOS) 프로그램과 동일한 Spring Boot 백엔드 및 20개 롤링 자동 백업 시스템**을 제공하는 웹 애플리케이션입니다.

---

## 🚀 실행 방법 (인텔리제이에서 바로 실행)

### 방법 1: IntelliJ IDEA (권장 - 히오스와 동일)
1. IntelliJ IDEA에서 `C:\IntellijCode\kongbab` 프로젝트를 엽니다.
2. `src/main/java/com/example/kongbab/KongbabApplication.java` 파일을 엽니다.
3. 초록색 **Run ▶ (`실행`)** 버튼을 클릭합니다.
4. 브라우저에서 **`http://localhost:8080/`** 에 접속합니다.

### 방법 2: 배치 파일로 간편 실행
* 프로젝트 폴더의 **`start_backup_server.bat`** 을 더블 클릭하면 Spring Boot 서버가 구동됩니다.

---

## 💾 백업 & 복원 시스템 (히오스 HOS 방식 완전 준용)

* **백업 저장 기본 경로**: `D:\백업 파일\KONGBAB_BACKUPS_JSON`
* **백업 파일 구성**:
  * `backup.json`: 항상 최신 상태를 유지하는 최신 백업 파일
  * `kongbab_backup_YYYYMMDD_HHmmss.json`: 데이터 변경 시점마다 누적되는 타임스탬프 백업 파일
* **20개 롤링 보관 (FIFO)**: 폴더 내 백업 파일이 20개를 초과하면 가장 오래된 파일부터 1개씩 자동 삭제되어 항상 최신 20개만 유지됩니다.
* **자동 백업 트리거**: 관리자 모드에서 인원 또는 영상을 추가/수정/삭제할 때마다 D드라이브 외부 폴더에 실시간 백업 파일을 기록합니다.
* **백업 관리자 UI 기능** (우측 상단 `[📦 백업/복구]`):
  1. **📁 백업 저장 폴더 경로 지정**: 원하는 폴더 경로를 직접 입력하거나 `[📂 탐색기]` 버튼으로 윈도우 폴더 선택 창을 띄워 변경 및 디스크 저장.
  2. **⚡ 수동 백업**: `[📂 지정된 폴더로 지금 백업 수행]` 버튼 클릭 시 현재 전체 데이터를 지정 폴더에 즉시 백업.
  3. **📥 백업 파일 다운로드**: 브라우저를 통해 JSON 백업 파일을 직접 다운로드.
  4. **📤 백업 데이터 파일 복원**: 보유 중인 JSON 백업 파일을 선택하여 전체 데이터 원클릭 복구.
  5. **📋 폴더 내 백업 파일 목록**: D드라이브에 저장된 백업 파일 목록(최신 20개)을 확인하고, 원하는 시점의 파일에서 `[🔄 복구]` 버튼 클릭 시 1초 만에 복원.

---

## 📂 프로젝트 구조

```text
C:\IntellijCode\kongbab\
├── build.gradle                               # Gradle 빌드 스크립트 (Spring Boot 3.4.2, Java 21/22)
├── settings.gradle
├── gradlew / gradlew.bat                      # Gradle Wrapper
├── start_backup_server.bat                    # 원클릭 서버 실행기
├── config\
│   └── backup_path.txt                        # 영구 저장된 외부 백업 경로 설정
├── data\
│   ├── kongbab_data.json                      # 서버 기본 데이터 스토리지
│   └── kongbabdb.mv.db                        # H2 파일 데이터베이스
└── src\main\
    ├── java\com\example\kongbab\
    │   ├── KongbabApplication.java            # Spring Boot 메인 애플리케이션
    │   ├── controller\
    │   │   └── WebViewController.java         # 메인 웹 뷰 컨트롤러 (루트 매핑)
    │   └── domain\
    │       ├── backup\
    │       │   ├── controller\BackupApiController.java   # /api/backup/* API (HOS와 동일)
    │       │   └── service\BackupService.java           # D:\ 백업 저장, 20개 롤링 관리
    │       └── member\
    │           ├── controller\DataApiController.java     # /api/data 데이터 API
    │           └── service\KongbabDataService.java       # 데이터 영구 저장 및 자동 백업 연동
    └── resources\
        ├── application.properties             # 포트 8080 및 백업 기본 경로 설정
        ├── templates\
        │   └── index.html                     # 웹 템플릿 메인 화면
        └── static\
            ├── css\style.css                  # 디자인 스타일시트
            └── js\app.js                      # 화면 렌더링 및 백엔드 REST API 연동
```

---

## 🔑 로그인 안내
* **어드민 계정**: 관리자 전용 (인원/영상 추가/수정/삭제, 백업 및 복원 기능 전체 접근 가능)
* **게스트 모드**: 영상 시청 전용
