/**
 * 콩밥특별시 GTA 스트리머 서버 데이터베이스
 * 
 * [카테고리 6대 분류]
 * 1. 👮‍♂️ 경찰 (hasSubgroups: false -> 클릭 시 바로 인원 목록)
 * 2. 🚑 EMS (중증외상센터) (hasSubgroups: false -> 클릭 시 바로 인원 목록)
 * 3. 💀 갱단 (hasSubgroups: true -> 12개 갱단 목록 -> 인원 목록)
 * 4. 🏢 사업체 (hasSubgroups: true -> 4개 사업체 목록 -> 인원 목록)
 * 5. 📰 기자 (KBTBS) (hasSubgroups: false -> 클릭 시 바로 인원 목록)
 * 6. 👥 시민 (hasSubgroups: false -> 클릭 시 바로 인원 목록)
 */

const KONGBAB_DATA = {
  serverName: "콩밥특별시 GTA RP",
  description: "콩밥특별시 스트리머들의 명장면과 다시보기를 정리한 아카이브",
  categories: [
    {
      id: "police",
      name: "경찰",
      emoji: "👮‍♂️",
      badge: "POLICE",
      icon: "shield",
      color: "blue",
      hasSubgroups: false, // 갱단/사업체처럼 하위 조직 고를 필요 없이 바로 인원 표시
      description: "콩밥특별시의 법과 질서를 수호하는 경찰관들",
      members: [
        {
          id: "pol-1",
          name: "김윤성",
          streamer: "김뿡",
          role: "경찰청장",
          badgeColor: "bg-blue-600",
          avatar: "assets/default-avatar.svg",
          videos: []
        },
        {
          id: "pol-2",
          name: "강 / 강반장 / 강전규 / 김사복",
          streamer: "사모장",
          role: "부청장",
          badgeColor: "bg-indigo-600",
          avatar: "assets/default-avatar.svg",
          videos: []
        },
        {
          id: "pol-3",
          name: "꽃거지",
          streamer: "꽃빈",
          role: "",
          badgeColor: "bg-zinc-800",
          avatar: "assets/default-avatar.svg",
          videos: []
        },
        {
          id: "pol-4",
          name: "나비리",
          streamer: "나나양",
          role: "",
          badgeColor: "bg-zinc-800",
          avatar: "assets/default-avatar.svg",
          videos: []
        },
        {
          id: "pol-5",
          name: "김폭설 / 김폭염",
          streamer: "눈꽃",
          role: "",
          badgeColor: "bg-zinc-800",
          avatar: "assets/default-avatar.svg",
          videos: []
        },
        {
          id: "pol-6",
          name: "김맹군",
          streamer: "단군",
          role: "",
          badgeColor: "bg-zinc-800",
          avatar: "assets/default-avatar.svg",
          videos: []
        },
        {
          id: "pol-7",
          name: "담유잉",
          streamer: "담유이",
          role: "",
          badgeColor: "bg-zinc-800",
          avatar: "assets/default-avatar.svg",
          videos: []
        },
        {
          id: "pol-8",
          name: "김영균 / 김동균",
          streamer: "댕균",
          role: "",
          badgeColor: "bg-zinc-800",
          avatar: "assets/default-avatar.svg",
          videos: []
        },
        {
          id: "pol-9",
          name: "악당",
          streamer: "델로략국",
          role: "",
          badgeColor: "bg-zinc-800",
          avatar: "assets/default-avatar.svg",
          videos: []
        },
        {
          id: "pol-10",
          name: "성말순",
          streamer: "둥그레",
          role: "",
          badgeColor: "bg-zinc-800",
          avatar: "assets/default-avatar.svg",
          videos: []
        },
        {
          id: "pol-11",
          name: "로보캅",
          streamer: "로보 문릿",
          role: "",
          badgeColor: "bg-zinc-800",
          avatar: "assets/default-avatar.svg",
          videos: []
        },
        {
          id: "pol-12",
          name: "맹숙희",
          streamer: "맹숙",
          role: "",
          badgeColor: "bg-zinc-800",
          avatar: "assets/default-avatar.svg",
          videos: []
        },
        {
          id: "pol-13",
          name: "미도바",
          streamer: "미도미도 마요",
          role: "",
          badgeColor: "bg-zinc-800",
          avatar: "assets/default-avatar.svg",
          videos: []
        },
        {
          id: "pol-14",
          name: "미채린",
          streamer: "미치르 메르헨",
          role: "",
          badgeColor: "bg-zinc-800",
          avatar: "assets/default-avatar.svg",
          videos: []
        },
        {
          id: "pol-15",
          name: "박기인",
          streamer: "바뀐",
          role: "",
          badgeColor: "bg-zinc-800",
          avatar: "assets/default-avatar.svg",
          videos: []
        },
        {
          id: "pol-16",
          name: "배준식",
          streamer: "뱅",
          role: "",
          badgeColor: "bg-zinc-800",
          avatar: "assets/default-avatar.svg",
          videos: []
        },
        {
          id: "pol-17",
          name: "뵤순경",
          streamer: "뵤오",
          role: "",
          badgeColor: "bg-zinc-800",
          avatar: "assets/default-avatar.svg",
          videos: []
        },
        {
          id: "pol-18",
          name: "엄충수 / 계충식 / 엄엄엄",
          streamer: "씨랙",
          role: "",
          badgeColor: "bg-zinc-800",
          avatar: "assets/default-avatar.svg",
          videos: []
        },
        {
          id: "pol-19",
          name: "김우유",
          streamer: "아야 AYA",
          role: "",
          badgeColor: "bg-zinc-800",
          avatar: "assets/default-avatar.svg",
          videos: []
        },
        {
          id: "pol-20",
          name: "어왜요",
          streamer: "오화요",
          role: "",
          badgeColor: "bg-zinc-800",
          avatar: "assets/default-avatar.svg",
          videos: []
        },
        {
          id: "pol-21",
          name: "유연희",
          streamer: "연리",
          role: "",
          badgeColor: "bg-zinc-800",
          avatar: "assets/default-avatar.svg",
          videos: []
        },
        {
          id: "pol-22",
          name: "김세빈",
          streamer: "연비니",
          role: "",
          badgeColor: "bg-zinc-800",
          avatar: "assets/default-avatar.svg",
          videos: []
        },
        {
          id: "pol-23",
          name: "필석호",
          streamer: "인간젤리",
          role: "",
          badgeColor: "bg-zinc-800",
          avatar: "assets/default-avatar.svg",
          videos: []
        },
        {
          id: "pol-24",
          name: "한예린",
          streamer: "채현찌",
          role: "",
          badgeColor: "bg-zinc-800",
          avatar: "assets/default-avatar.svg",
          videos: []
        },
        {
          id: "pol-25",
          name: "차수현",
          streamer: "초승달",
          role: "",
          badgeColor: "bg-zinc-800",
          avatar: "assets/default-avatar.svg",
          videos: []
        },
        {
          id: "pol-26",
          name: "나견차",
          streamer: "쿠레나이 나츠키",
          role: "",
          badgeColor: "bg-zinc-800",
          avatar: "assets/default-avatar.svg",
          videos: []
        },
        {
          id: "pol-27",
          name: "박정의 / 밥좀우 / 피닉스박",
          streamer: "피닉스박",
          role: "",
          badgeColor: "bg-zinc-800",
          avatar: "assets/default-avatar.svg",
          videos: []
        },
        {
          id: "pol-28",
          name: "햄재민",
          streamer: "햄쿠비",
          role: "",
          badgeColor: "bg-zinc-800",
          avatar: "assets/default-avatar.svg",
          videos: []
        },
        {
          id: "pol-29",
          name: "강레나",
          streamer: "달콤레나",
          role: "",
          badgeColor: "bg-zinc-800",
          avatar: "assets/default-avatar.svg",
          videos: []
        },
        {
          id: "pol-30",
          name: "정상화",
          streamer: "명예훈장",
          role: "",
          badgeColor: "bg-zinc-800",
          avatar: "assets/default-avatar.svg",
          videos: []
        },
        {
          id: "pol-31",
          name: "메네라",
          streamer: "키리키리꼬키리",
          role: "",
          badgeColor: "bg-zinc-800",
          avatar: "assets/default-avatar.svg",
          videos: []
        },
        {
          id: "pol-32",
          name: "시고르자브냥이",
          streamer: "진덕춘",
          role: "",
          badgeColor: "bg-zinc-800",
          avatar: "assets/default-avatar.svg",
          videos: []
        },
        {
          id: "pol-33",
          name: "김다미",
          streamer: "새담",
          role: "",
          badgeColor: "bg-zinc-800",
          avatar: "assets/default-avatar.svg",
          videos: []
        },
        {
          id: "pol-34",
          name: "엄현자",
          streamer: "콩천",
          role: "",
          badgeColor: "bg-zinc-800",
          avatar: "assets/default-avatar.svg",
          videos: []
        },
        {
          id: "pol-35",
          name: "단백질소나타",
          streamer: "연주하는곰탱",
          role: "",
          badgeColor: "bg-zinc-800",
          avatar: "assets/default-avatar.svg",
          videos: []
        }
      ]
    },
    {
      id: "ems",
      name: "EMS",
      emoji: "🚑",
      badge: "중증외상센터",
      icon: "cross",
      color: "teal",
      hasSubgroups: false, // 바로 인원 표시
      description: "사건 현장에 가장 먼저 달려가는 중증외상센터 의료진 및 구조대",
      members: []
    },
    {
      id: "gang",
      name: "갱단",
      emoji: "💀",
      badge: "GANG",
      icon: "skull",
      color: "red",
      hasSubgroups: true, // 12개 갱단 목록 거쳐서 인원으로 이동
      description: "콩밥특별시를 움직이는 12대 갱단 세력",
      groups: [
        {
          id: "gang-nonghyup",
          name: "농협",
          emoji: "🌾",
          description: "겉은 평범한 농협, 속은 거대 범죄 카르텔",
          tag: "카르텔",
          members: []
        },
        {
          id: "gang-goldmoon",
          name: "골드문",
          emoji: "🌙",
          description: "화려하고 거대한 자금력을 자랑하는 기업형 조직",
          tag: "기업형",
          members: []
        },
        {
          id: "gang-blackrose",
          name: "흑장미",
          emoji: "🌹",
          description: "어둠 속에서 조용하고 치명적으로 움직이는 조직",
          tag: "암살/정보",
          members: []
        },
        {
          id: "gang-oompa",
          name: "움파룸파",
          emoji: "😜",
          description: "예측 불가능한 광기와 유쾌함을 지닌 트릭스터 집단",
          tag: "광기/유쾌",
          members: []
        },
        {
          id: "gang-sangryeon",
          name: "상련",
          emoji: "👠",
          description: "도도하고 날카로운 카리스마의 강한 조직",
          tag: "카리스마",
          members: []
        },
        {
          id: "gang-bigdick",
          name: "빅딕",
          emoji: "🍌",
          description: "화끈하고 거친 화력과 파괴력을 자랑하는 돌격파",
          tag: "화력전",
          members: []
        },
        {
          id: "gang-doremifa",
          name: "도레미파",
          emoji: "🎹",
          description: "음악처럼 리드미컬하게 도시를 뒤흔드는 개성파 조직",
          tag: "예술/리듬",
          members: []
        },
        {
          id: "gang-adventure",
          name: "어드벤처",
          emoji: "🐯",
          description: "산악, 오지, 공중 어디든 질주하는 모험가형 갱단",
          tag: "모험/특공",
          members: []
        },
        {
          id: "gang-kgaeng",
          name: "깨갱",
          emoji: "🐶",
          description: "물면 절대 놓지 않는 끈질긴 악바리 갱단",
          tag: "끈질김",
          members: []
        },
        {
          id: "gang-metalunion",
          name: "금속노조",
          emoji: "⛏️",
          description: "육중한 장비와 철통같은 단결력으로 무장한 노동자 갱단",
          tag: "철통단결",
          members: []
        },
        {
          id: "gang-girlbang",
          name: "GIRL BANG",
          emoji: "🐷",
          description: "통통 튀는 반전 매력과 막강한 화력의 걸스 갱단",
          tag: "걸크러쉬",
          members: []
        },
        {
          id: "gang-streetcat",
          name: "길고양이 연합",
          emoji: "😺",
          description: "도시의 골목길을 쥐락펴락하는 민첩한 게릴라 조직",
          tag: "게릴라",
          members: []
        }
      ]
    },
    {
      id: "business",
      name: "사업체",
      emoji: "🏢",
      badge: "BUSINESS",
      icon: "building",
      color: "amber",
      hasSubgroups: true, // 4개 사업체 목록 거쳐서 인원으로 이동
      description: "콩밥특별시 경제와 유흥을 이끄는 주요 사업장",
      groups: [
        {
          id: "biz-yastation",
          name: "야스테이션",
          emoji: "🔧",
          description: "슈퍼카 튜닝 및 차량 정비 명가",
          tag: "정비소",
          members: []
        },
        {
          id: "biz-lux",
          name: "LUX 클럽",
          emoji: "🎭",
          description: "콩밥특별시 최고의 핫플레이스 나이트클럽",
          tag: "클럽/파티",
          members: []
        },
        {
          id: "biz-young31",
          name: "영써티원",
          emoji: "🍔",
          description: "입소문 난 맛있는 수제버거 & 디저트 프랜차이즈",
          tag: "요식업",
          members: []
        },
        {
          id: "biz-koi",
          name: "KOI 레스토랑",
          emoji: "💌",
          description: "고급스럽고 로맨틱한 분위기의 프리미엄 다이닝",
          tag: "파인다이닝",
          members: []
        }
      ]
    },
    {
      id: "press",
      name: "기자",
      emoji: "📰",
      badge: "KBTBS",
      icon: "camera",
      color: "sky",
      hasSubgroups: false, // 바로 인원 표시
      description: "도시의 모든 사건 사고를 가장 빠르게 보도하는 KBTBS 기자단",
      members: []
    },
    {
      id: "citizen",
      name: "시민",
      emoji: "👥",
      badge: "CITIZEN",
      icon: "users",
      color: "purple",
      hasSubgroups: false, // 바로 인원 표시
      description: "택시기사, 배달원, 낚시꾼, 자유로운 소시민들",
      members: []
    }
  ]
};
