// 매우 단순한 프로토타입용 스크립트 (v1.5)
// - data/sentences_*.json 에서 카테고리별 Claim/Reason/Style 세트를 로드
// - (현재는 한식/김치찌개 세트를 기본으로 사용)
// - 버튼 3개로 각각 랜덤 선택
// - 선택한 결과를 한 문장으로 합쳐서 화면에 표시
//
// v1.6
// - faction(세부 메뉴)에 따라 문장 풀을 필터링하는 로직의 뼈대를 추가
// v1.7
// - 한 카테고리 안에서 메뉴 2개를 랜덤으로 보여주고, 그 중 하나를 선택하면
//   선택된 faction 기준으로 문장 풀을 필터링하도록 메뉴 선택 단계를 추가

const state = {
  menuCategory: null, // 예: "korean", "japanese"
  faction: null, // 예: "kimchi_stew", "ramen" 등
  menuOptions: [], // 현재 화면에 보여주는 메뉴 2개
  allClaims: [],
  allReasons: [],
  allStyles: [],
  claims: [],
  reasons: [],
  styles: [],
  selectedClaim: null,
  selectedReason: null,
  selectedStyle: null,
};

// TODO: 카테고리/메뉴 선택 UI가 추가되면 이 상수들을 동적으로 바꾸도록 확장
const CATEGORY_FILES = {
  japanese: "./data/sentences_japanese.json",
  korean: "./data/sentences_korean.json",
  chinese: "./data/sentences_chinese.json",
  western: "./data/sentences_western.json",
};

const DEFAULT_CATEGORY = "korean";
const DEFAULT_FACTION_BY_CATEGORY = {
  japanese: "ramen",
  korean: "kimchi_stew",
  chinese: "chinese",
  western: "western",
};

// 파일을 fetch 할 수 없는 환경(file:// 등)에서 사용할 폴백 데이터 (한식/김치찌개 간단 버전)
const FALLBACK_DATA_KOREAN = {
  menu_category: "korean",
  claims: [
    {
      id: "claim_korean_common_01",
      text: "오늘은 따뜻한 한식으로 속 좀 살리자.",
      faction: "korean",
      tone: "감성형",
      tags: [],
      base_power: 2,
    },
    {
      id: "claim_kimchi_stew_01",
      text: "김치찌개 한 그릇이면 스트레스 바로 증발이야.",
      faction: "kimchi_stew",
      tone: "감성형",
      tags: [],
      base_power: 3,
    },
    {
      id: "claim_kimchi_stew_02",
      text: "얼큰하게 땀 좀 빼고 오후 회의 준비하자.",
      faction: "kimchi_stew",
      tone: "논리형",
      tags: [],
      base_power: 2,
    },
  ],
  reasons: [
    {
      id: "reason_korean_01",
      text: "어제 야근에 컵라면으로 대충 때운 결과, 지금 몸이 한국식 가정식 같은 걸 절실히 요구하고 있기 때문입니다.",
      faction: "korean",
      tone: "감성형",
      tags: [],
      base_power: 3,
    },
    {
      id: "reason_korean_02",
      text: "외근도 많고 걸어 다닐 일도 많은 날이라, 밥이랑 국으로 탄수와 수분을 동시에 채워놔야 하기 때문입니다.",
      faction: "korean",
      tone: "논리형",
      tags: [],
      base_power: 2,
    },
    {
      id: "reason_korean_03",
      text: "월말 결산 지옥 들어가기 전에, 김치찌개 한 번으로 멘탈 방어막을 쳐둘 필요가 있기 때문입니다.",
      faction: "korean",
      tone: "논리형",
      tags: [],
      base_power: 2,
    },
  ],
  styles: [
    {
      id: "style_korean_01",
      text: "재무 보고서 설명하듯, 수치와 근거를 차분하게 들이밀면서.",
      faction: "korean",
      tone: "논리형",
      tags: ["요일_월"],
      base_power: 2,
    },
    {
      id: "style_korean_02",
      text: "어젯밤 야근 썰을 살짝 섞어서, 동료들의 동정심을 자극하는 톤으로.",
      faction: "korean",
      tone: "감성형",
      tags: [],
      base_power: 3,
    },
    {
      id: "style_korean_03",
      text: "단톡방 밈에 쓰일 법한 말투로, '이건 국밥각이다'를 반복하면서 농담 반 진담 반으로.",
      faction: "korean",
      tone: "유머형",
      tags: [],
      base_power: 1,
    },
  ],
};

// 한식 메뉴 (KOREAN_MENU) - 메뉴 2개를 랜덤으로 뽑기 위한 소스
const KOREAN_MENU = [
  { id: "kimchi_stew", label: "Kimchi Stew", labelKo: "김치찌개" },
  { id: "soybean_paste_stew", label: "Doenjang Stew", labelKo: "된장찌개" },
  { id: "soft_tofu_stew", label: "Sundubu Stew", labelKo: "순두부찌개" },
  { id: "spicy_pork", label: "Jeyuk Bokkeum", labelKo: "제육볶음" },
  { id: "bibimbap", label: "Bibimbap", labelKo: "비빔밥" },
  {
    id: "kimchi_fried_rice",
    label: "Kimchi Fried Rice",
    labelKo: "김치볶음밥",
  },
  { id: "yukgaejang", label: "Yukgaejang", labelKo: "육개장" },
  { id: "gamjatang", label: "Gamjatang", labelKo: "감자탕" },
  { id: "samgyeopsal", label: "Samgyeopsal", labelKo: "삼겹살" },
  { id: "galbijjim", label: "Galbijjim", labelKo: "갈비찜" },
];

// faction(세부 메뉴)에 따라 문장 풀을 필터링
function applyFactionFilter() {
  const { menuCategory, faction, allClaims, allReasons, allStyles } = state;

  // faction 이 아직 없으면 전체 사용
  if (!faction) {
    state.claims = allClaims.slice();
    state.reasons = allReasons.slice();
    state.styles = allStyles.slice();
    return;
  }

  const category = menuCategory;

  const matchesFaction = (item) => {
    if (!item || !item.faction) return false;
    // 우선순위:
    // 1) 선택된 세부 메뉴(faction) 전용
    // 2) 카테고리 공통 (예: "korean")
    // 3) 모든 진영 공통("neutral")
    return (
      item.faction === faction ||
      item.faction === category ||
      item.faction === "neutral"
    );
  };

  state.claims = allClaims.filter(matchesFaction);
  state.reasons = allReasons.filter(matchesFaction);
  state.styles = allStyles.filter(matchesFaction);
}

async function loadData() {
  try {
    const filePath = CATEGORY_FILES[DEFAULT_CATEGORY];
    if (!filePath) {
      throw new Error(`지원하지 않는 카테고리입니다: ${DEFAULT_CATEGORY}`);
    }

    let data;

    // file:// 로 열었을 가능성이 높으면 바로 폴백 사용
    const isFileProtocol = window.location.protocol === "file:";
    if (isFileProtocol) {
      data = FALLBACK_DATA_KOREAN;
    } else {
      const res = await fetch(filePath);
      if (!res.ok) {
        throw new Error(`JSON 로드 실패: ${filePath} (${res.status})`);
      }
      data = await res.json();
    }

    state.menuCategory = data.menu_category ?? DEFAULT_CATEGORY;
    state.faction =
      DEFAULT_FACTION_BY_CATEGORY[state.menuCategory] ??
      DEFAULT_FACTION_BY_CATEGORY[DEFAULT_CATEGORY];

    state.allClaims = Array.isArray(data.claims) ? data.claims : [];
    state.allReasons = Array.isArray(data.reasons) ? data.reasons : [];
    state.allStyles = Array.isArray(data.styles) ? data.styles : [];

    applyFactionFilter();
  } catch (error) {
    console.error("데이터 로드 실패, 폴백 데이터 사용:", error);
    // fetch 에 실패한 경우에도 폴백 데이터로 최소한 동작하도록 처리
    state.menuCategory = FALLBACK_DATA_KOREAN.menu_category;
    state.faction =
      DEFAULT_FACTION_BY_CATEGORY[state.menuCategory] ??
      DEFAULT_FACTION_BY_CATEGORY[DEFAULT_CATEGORY];

    state.allClaims = FALLBACK_DATA_KOREAN.claims;
    state.allReasons = FALLBACK_DATA_KOREAN.reasons;
    state.allStyles = FALLBACK_DATA_KOREAN.styles;

    applyFactionFilter();
  }
}

function pickRandom(list) {
  if (!Array.isArray(list) || list.length === 0) return null;
  const index = Math.floor(Math.random() * list.length);
  return list[index];
}

function updateLabels() {
  const claimEl = document.getElementById("selected-claim");
  const reasonEl = document.getElementById("selected-reason");
  const styleEl = document.getElementById("selected-style");

  claimEl.textContent = state.selectedClaim?.text ?? "아직 선택 안 됨";
  reasonEl.textContent = state.selectedReason?.text ?? "아직 선택 안 됨";
  styleEl.textContent = state.selectedStyle?.text ?? "아직 선택 안 됨";

  updateSentence();
}

function updateSentence() {
  const resultEl = document.getElementById("result-sentence");
  const { selectedClaim, selectedReason, selectedStyle } = state;

  if (!selectedClaim && !selectedReason && !selectedStyle) {
    resultEl.textContent =
      "아직 문장이 없습니다. 버튼을 눌러 조합을 시작해보세요.";
    return;
  }

  // 아주 단순한 한 문장 포맷 (추후 세계관 톤에 맞게 튜닝 예정)
  const parts = [];
  if (selectedReason) parts.push(selectedReason.text);
  if (selectedClaim) parts.push(selectedClaim.text);
  if (selectedStyle) parts.push(`(${selectedStyle.text})`); // 스타일은 괄호 처리

  resultEl.textContent = parts.join(" ");
}

function setupButtons() {
  const rowMenu = document.getElementById("row-menu");
  const rowClaim = document.getElementById("row-claim");
  const rowReason = document.getElementById("row-reason");
  const rowStyle = document.getElementById("row-style");

  const menuButtons = [
    document.getElementById("menu-option-0"),
    document.getElementById("menu-option-1"),
  ];
  const selectedMenuEl = document.getElementById("selected-menu");

  const claimButtons = [
    document.getElementById("claim-option-0"),
    document.getElementById("claim-option-1"),
    document.getElementById("claim-option-2"),
  ];
  const reasonButtons = [
    document.getElementById("reason-option-0"),
    document.getElementById("reason-option-1"),
    document.getElementById("reason-option-2"),
  ];
  const styleButtons = [
    document.getElementById("style-option-0"),
    document.getElementById("style-option-1"),
    document.getElementById("style-option-2"),
  ];
  const btnReset = document.getElementById("btn-reset");

  function applyTexts() {
    // 현재는 각 배열에 정확히 3개가 있다는 전제를 사용
    claimButtons.forEach((btn, index) => {
      const item = state.claims[index];
      btn.textContent = item ? item.text : "-";
      btn.disabled = !item;
    });
    reasonButtons.forEach((btn, index) => {
      const item = state.reasons[index];
      btn.textContent = item ? item.text : "-";
      btn.disabled = true; // Reason은 Claim 선택 후 활성화
    });
    styleButtons.forEach((btn, index) => {
      const item = state.styles[index];
      btn.textContent = item ? item.text : "-";
      btn.disabled = true; // Style은 Reason 선택 후 활성화
    });
  }

  function setStage(stage) {
    if (stage === "menu") {
      // 메뉴 선택 단계: 메뉴만 활성화, 나머지 행은 숨김
      menuButtons.forEach((btn) => (btn.disabled = false));
      claimButtons.forEach((btn) => (btn.disabled = true));
      reasonButtons.forEach((btn) => (btn.disabled = true));
      styleButtons.forEach((btn) => (btn.disabled = true));
      if (rowMenu) rowMenu.style.display = "block";
      if (rowClaim) rowClaim.style.display = "none";
      if (rowReason) rowReason.style.display = "none";
      if (rowStyle) rowStyle.style.display = "none";
    } else if (stage === "claim") {
      menuButtons.forEach((btn) => (btn.disabled = true));
      claimButtons.forEach((btn) => (btn.disabled = false));
      reasonButtons.forEach((btn) => (btn.disabled = true));
      styleButtons.forEach((btn) => (btn.disabled = true));
      if (rowMenu) rowMenu.style.display = "block";
      if (rowClaim) rowClaim.style.display = "block";
      if (rowReason) rowReason.style.display = "none";
      if (rowStyle) rowStyle.style.display = "none";
    } else if (stage === "reason") {
      menuButtons.forEach((btn) => (btn.disabled = true));
      claimButtons.forEach((btn) => (btn.disabled = true));
      reasonButtons.forEach((btn) => (btn.disabled = false));
      styleButtons.forEach((btn) => (btn.disabled = true));
      if (rowMenu) rowMenu.style.display = "block";
      if (rowClaim) rowClaim.style.display = "block";
      if (rowReason) rowReason.style.display = "block";
      if (rowStyle) rowStyle.style.display = "none";
    } else if (stage === "style") {
      menuButtons.forEach((btn) => (btn.disabled = true));
      claimButtons.forEach((btn) => (btn.disabled = true));
      reasonButtons.forEach((btn) => (btn.disabled = true));
      styleButtons.forEach((btn) => (btn.disabled = false));
      if (rowMenu) rowMenu.style.display = "block";
      if (rowClaim) rowClaim.style.display = "block";
      if (rowReason) rowReason.style.display = "block";
      if (rowStyle) rowStyle.style.display = "block";
    } else {
      // done
      menuButtons.forEach((btn) => (btn.disabled = true));
      claimButtons.forEach((btn) => (btn.disabled = true));
      reasonButtons.forEach((btn) => (btn.disabled = true));
      styleButtons.forEach((btn) => (btn.disabled = true));
      if (rowMenu) rowMenu.style.display = "block";
      if (rowClaim) rowClaim.style.display = "block";
      if (rowReason) rowReason.style.display = "block";
      if (rowStyle) rowStyle.style.display = "block";
    }
  }

  function resetSelection() {
    // 메뉴부터 다시 선택
    state.faction = null;
    state.menuOptions = [];
    state.selectedClaim = null;
    state.selectedReason = null;
    state.selectedStyle = null;
    applyTexts();
    setupMenuOptions();
    setStage("menu");
    updateLabels();
  }

  function setupMenuOptions() {
    // v1: 한식만 사용, 메뉴 2개 랜덤 선택
    const pool = KOREAN_MENU.slice();
    if (pool.length === 0) {
      state.menuOptions = [];
      menuButtons.forEach((btn) => {
        btn.textContent = "-";
        btn.disabled = true;
      });
      if (selectedMenuEl) selectedMenuEl.textContent = "메뉴 데이터 없음";
      return;
    }

    // 두 개 랜덤 뽑기 (중복 없이)
    const firstIndex = Math.floor(Math.random() * pool.length);
    const first = pool.splice(firstIndex, 1)[0];
    const second =
      pool.length > 0
        ? pool[Math.floor(Math.random() * pool.length)]
        : null;

    state.menuOptions = second ? [first, second] : [first];

    menuButtons.forEach((btn, index) => {
      const option = state.menuOptions[index];
      if (!option) {
        btn.textContent = "-";
        btn.disabled = true;
        return;
      }
      // 한국어 라벨 우선 사용
      btn.textContent = option.labelKo ?? option.label ?? option.id;
      btn.disabled = false;
    });

    if (selectedMenuEl) {
      selectedMenuEl.textContent = "아직 선택 안 됨";
    }
  }

  // 초기 텍스트 적용
  applyTexts();
  setupMenuOptions();
  setStage("menu");

  claimButtons.forEach((btn, index) => {
    btn.addEventListener("click", () => {
      const item = state.claims[index];
      if (!item) return;
      state.selectedClaim = item;
      updateLabels();
      setStage("reason");
    });
  });

  reasonButtons.forEach((btn, index) => {
    btn.addEventListener("click", () => {
      const item = state.reasons[index];
      if (!item) return;
      state.selectedReason = item;
      updateLabels();
      setStage("style");
    });
  });

  styleButtons.forEach((btn, index) => {
    btn.addEventListener("click", () => {
      const item = state.styles[index];
      if (!item) return;
      state.selectedStyle = item;
      updateLabels();
      setStage("done");
    });
  });

  // 메뉴 선택 핸들러
  menuButtons.forEach((btn, index) => {
    btn.addEventListener("click", () => {
      const option = state.menuOptions[index];
      if (!option) return;

      state.faction = option.id;
      if (selectedMenuEl) {
        selectedMenuEl.textContent = option.labelKo ?? option.label ?? option.id;
      }

      // 선택된 faction 기준으로 문장 풀 필터링 후 Claim 단계로 진입
      applyFactionFilter();
      applyTexts();
      state.selectedClaim = null;
      state.selectedReason = null;
      state.selectedStyle = null;
      updateLabels();
      setStage("claim");
    });
  });

  if (btnReset) {
    btnReset.addEventListener("click", () => {
      resetSelection();
    });
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  await loadData();
  setupButtons();
  updateLabels();
});


