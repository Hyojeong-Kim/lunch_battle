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
  isFallbackData: false, // 폴백 JSON 사용 여부
  allClaims: [],
  allReasons: [],
  allStyles: [],
  // faction 필터 후 전체 풀
  claims: [],
  reasons: [],
  styles: [],
  // 이번 턴에 플레이어가 고를 수 있는 3개 옵션
  optionClaims: [],
  optionReasons: [],
  optionStyles: [],
  // 플레이어가 실제로 고른 문장
  selectedClaim: null,
  selectedReason: null,
  selectedStyle: null,
};

// 배틀 상태 (점수/세력/컨텍스트/턴)
const battleState = {
  turn: 1,
  maxTurn: 5,
  playerInfluence: 50,
  cpuInfluence: 50,
  context: {
    weather: "비", // 맑음 | 흐림 | 비 | 눈
    weekday: "금", // 월 | 화목 | 수 | 금
    salary: "D+5", // D-5 | 월급날 | D+5
  },
  selected: {
    claim: null,
    reason: null,
    style: null,
  },
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
  chinese: "jjajang",
  western: "pasta",
};

const MENU_CATALOG_PATH = "./data/menu_catalog.json";

// 카테고리별 전체 문장 데이터 (HTTP 환경에서 모두 프리로드)
const CATEGORY_DATA = {};
// menu_catalog 에서 뽑은 전체 메뉴 리스트 (카테고리 상관없이)
// 예: { id: "kimchi_stew", label: "Kimchi Stew", labelKo: "김치찌개", category: "korean" }
let ALL_MENUS = [];

// --- 컨텍스트 → 태그 변환 & 점수 계산 유틸 ---

const WEATHER_OPTIONS = ["맑음", "흐림", "비", "눈"];
const WEEKDAY_OPTIONS = ["월", "수", "금", "화목"];
const SALARY_OPTIONS = ["D-5", "월급날", "D+5"];

function pickFromArray(list) {
  if (!Array.isArray(list) || list.length === 0) return null;
  const index = Math.floor(Math.random() * list.length);
  return list[index];
}

function randomizeContext() {
  battleState.context.weather = pickFromArray(WEATHER_OPTIONS) ?? "맑음";
  battleState.context.weekday = pickFromArray(WEEKDAY_OPTIONS) ?? "월";
  battleState.context.salary = pickFromArray(SALARY_OPTIONS) ?? "D-5";
  updateBattleHeader();
}

function getContextTags(context) {
  const tags = [];
  if (context.weather) tags.push(`날씨_${context.weather}`);
  if (context.weekday) tags.push(`요일_${context.weekday}`);
  if (context.salary) tags.push(`월급_${context.salary}`);
  return tags;
}

function scoreSentence(sentence, activeContextTags) {
  if (!sentence) return 0;

  // v0.5: 기본 점수는 문장 자체의 위력(base_power)을 사용
  const baseScore =
    typeof sentence.base_power === "number" ? sentence.base_power : 1;

  // 컨텍스트 태그 매칭 개수에 따라 보너스 (매칭 1개당 +2점)
  const matches =
    sentence.tags && Array.isArray(sentence.tags)
      ? sentence.tags.filter((tag) => activeContextTags.includes(tag)).length
      : 0;

  const tagMatchBonus = matches * 2;
  const toneBonus = 0; // v0에서는 사용하지 않음

  return baseScore + tagMatchBonus + toneBonus;
}

// 디버그용: 한 문장의 점수 계산을 상세히 설명
function explainSentenceScore(sentence, activeContextTags) {
  if (!sentence) return null;

  const base =
    typeof sentence.base_power === "number" ? sentence.base_power : 1;
  const tags =
    sentence.tags && Array.isArray(sentence.tags) ? sentence.tags : [];
  const matchedTags = tags.filter((tag) => activeContextTags.includes(tag));
  const tagBonus = matchedTags.length * 2;
  const total = base + tagBonus;

  return {
    id: sentence.id,
    text: sentence.text,
    base,
    tagBonus,
    matchedTags,
    total,
  };
}

function scoreTurn(claim, reason, style, activeContextTags) {
  const claimScore = scoreSentence(claim, activeContextTags);
  const reasonScore = scoreSentence(reason, activeContextTags);
  const styleScore = scoreSentence(style, activeContextTags);

  return {
    claimScore,
    reasonScore,
    styleScore,
    total: claimScore + reasonScore + styleScore,
  };
}

function calcInfluenceDelta(playerTotal, cpuTotal) {
  const diff = playerTotal - cpuTotal;

  if (diff >= 3) return +8; // 압승
  if (diff >= 1) return +4; // 근소 승리
  if (diff <= -3) return -8; // CPU 압승
  if (diff <= -1) return -4; // CPU 근소 승리
  return 0; // 비김
}

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

// 한식 메뉴 (KOREAN_MENU) - file:// 폴백 또는 menu_catalog 로드 실패 시 사용
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
  const { menuCategory, faction, allClaims, allReasons, allStyles, isFallbackData } =
    state;

  // 폴백 데이터일 때는 메뉴별 세부 진영 구분 없이 전체 풀을 사용
  if (isFallbackData) {
    state.claims = allClaims.slice();
    state.reasons = allReasons.slice();
    state.styles = allStyles.slice();
    state.optionClaims = [];
    state.optionReasons = [];
    state.optionStyles = [];
    return;
  }

  // faction 이 아직 없으면 전체 사용
  if (!faction) {
    state.claims = allClaims.slice();
    state.reasons = allReasons.slice();
    state.styles = allStyles.slice();
    state.optionClaims = [];
    state.optionReasons = [];
    state.optionStyles = [];
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

// 한 턴에 사용할 3개 옵션 뽑기
function pickRandomSubset(list, count) {
  if (!Array.isArray(list) || list.length === 0) return [];
  const pool = list.slice();
  const picked = [];
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i += 1) {
    const index = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(index, 1)[0]);
  }
  return picked;
}

function setupTurnOptions() {
  state.optionClaims = pickRandomSubset(state.claims, 3);
  state.optionReasons = pickRandomSubset(state.reasons, 3);
  state.optionStyles = pickRandomSubset(state.styles, 3);
}

// 배틀 헤더/로그 UI 갱신
function updateBattleHeader() {
  const turnEl = document.getElementById("turn-display");
  const influenceEl = document.getElementById("influence-display");
  const contextEl = document.getElementById("context-display");

  if (turnEl) {
    turnEl.textContent = `Turn ${battleState.turn} / ${battleState.maxTurn}`;
  }
  if (influenceEl) {
    influenceEl.textContent = `우리 ${battleState.playerInfluence} : ${battleState.cpuInfluence} 상대`;
  }
  if (contextEl) {
    const { weather, weekday, salary } = battleState.context;
    contextEl.textContent = `날씨: ${weather} | 요일: ${weekday} | 월급: ${salary}`;
  }
}

// 점수 차이에 따른 CPU 리액션 텍스트
function getCpuReaction(delta) {
  // delta: 이번 턴으로 "우리 진영" 세력치가 얼마나 변했는지 (플레이어 기준)
  if (delta > 0) {
    // 플레이어가 이긴 턴
    if (delta >= 8) {
      return "상대 진영이 크게 흔들린다. 상대 진영의 대장이 식은땀을 흘리는 듯하다.";
    }
    if (delta >= 6) {
      return "상대 팀 고양이들이 슬슬 이쪽 논리에 끌려오는 기색이다.";
    }
    return "상대 진영 대장의 잠깐 말문이 막힌 듯 조용해진다.";
  }

  if (delta < 0) {
    // CPU가 이긴 턴
    if (delta <= -8) {
      return "상대가 결정타를 날렸다. 우리 진영 분위기가 크게 다운된다.";
    }
    if (delta <= -6) {
      return "상대 진영 논리가 꽤 먹혔다. 우리 쪽 고양이들이 슬슬 흔들린다.";
    }
    return "상대가 능청스럽게 받아치며 분위기를 다시 가져간다.";
  }

  // 비김
  return "서로 한 발도 물러서지 않는다. 회의실 공기만 더 묵직해진다.";
}

function showTurnResult(
  playerScores,
  cpuScores,
  delta,
  playerSelection,
  cpuSelection
) {
  const scoreSummaryEl = document.getElementById("score-summary");
  const logEl = document.getElementById("log-messages");
   const debugEl = document.getElementById("debug-panel");

  if (scoreSummaryEl) {
    const diff = playerScores.total - cpuScores.total;
    let resultText = "";
    if (diff > 0) resultText = "플레이어 우세";
    else if (diff < 0) resultText = "CPU 우세";
    else resultText = "비김";

    scoreSummaryEl.textContent = `플레이어 ${playerScores.total}점 vs CPU ${cpuScores.total}점 (${resultText})`;
  }

  if (logEl) {
    let summary;
    if (delta > 0) {
      summary = `우리 진영이 ${Math.abs(
        delta
      )}명 설득에 성공했습니다. 세력: 우리 ${battleState.playerInfluence} : ${battleState.cpuInfluence} 상대`;
    } else if (delta < 0) {
      summary = `상대 진영이 ${Math.abs(
        delta
      )}명 설득에 성공했습니다. 세력: 우리 ${battleState.playerInfluence} : ${battleState.cpuInfluence} 상대`;
    } else {
      summary = `이번 턴은 팽팽하게 비겼습니다. 세력: 우리 ${battleState.playerInfluence} : ${battleState.cpuInfluence} 상대`;
    }

    if (battleState.turn === battleState.maxTurn) {
      // 마지막 턴 결과
      const finalText = ` 전투 종료! 최종 세력: 우리 ${battleState.playerInfluence} : ${battleState.cpuInfluence} 상대`;
      summary += finalText;
    }

    const formatSentence = (sel) => {
      if (!sel) return "";
      const parts = [];
      if (sel.reason) parts.push(sel.reason.text);
      if (sel.claim) parts.push(sel.claim.text);
      if (sel.style) parts.push(`(${sel.style.text})`);
      return parts.join(" ");
    };

    const playerSentence = formatSentence(playerSelection);
    const cpuSentence = formatSentence(cpuSelection);

    const lines = [summary];
    if (playerSentence) {
      lines.push(`플레이어: ${playerSentence}`);
    }
    if (cpuSentence) {
      lines.push(`CPU: ${cpuSentence}`);
    }

    const reaction = getCpuReaction(delta);
    if (reaction) {
      lines.push(`상대 리액션: ${reaction}`);
    }

    logEl.textContent = lines.join("\n");
  }

  // 개발용 디버그 패널: 점수/태그 상세 표시
  if (debugEl) {
    const activeContextTags = getContextTags(battleState.context);

    const pClaim = explainSentenceScore(
      playerSelection.claim,
      activeContextTags
    );
    const pReason = explainSentenceScore(
      playerSelection.reason,
      activeContextTags
    );
    const pStyle = explainSentenceScore(
      playerSelection.style,
      activeContextTags
    );

    const cClaim = explainSentenceScore(cpuSelection.claim, activeContextTags);
    const cReason = explainSentenceScore(
      cpuSelection.reason,
      activeContextTags
    );
    const cStyle = explainSentenceScore(cpuSelection.style, activeContextTags);

    const explainLine = (label, info) => {
      if (!info) return `  ${label}: 선택 없음`;
      const tagsText =
        info.matchedTags && info.matchedTags.length > 0
          ? info.matchedTags.join(", ")
          : "매칭 태그 없음";
      return `  ${label}: ${info.total}점 (기본 ${info.base}, 태그 보너스 +${
        info.tagBonus
      }) | ${tagsText}`;
    };

    const debugLines = [];
    debugLines.push("개발용 디버그 — 이번 턴 점수 상세");
    debugLines.push(
      `컨텍스트 태그: ${
        activeContextTags.length > 0
          ? activeContextTags.join(", ")
          : "없음 (매칭 없음)"
      }`
    );
    debugLines.push("");
    debugLines.push(`플레이어 총점: ${playerScores.total}점`);
    debugLines.push(explainLine("Claim", pClaim));
    debugLines.push(explainLine("Reason", pReason));
    debugLines.push(explainLine("Style", pStyle));
    debugLines.push("");
    debugLines.push(`CPU 총점: ${cpuScores.total}점`);
    debugLines.push(explainLine("Claim", cClaim));
    debugLines.push(explainLine("Reason", cReason));
    debugLines.push(explainLine("Style", cStyle));

    debugEl.textContent = debugLines.join("\n");
  }
}

async function loadData() {
  try {
    const isFileProtocol = window.location.protocol === "file:";

    if (isFileProtocol) {
      // file:// 환경: 한식 폴백 데이터 + 한식 메뉴만 사용
      CATEGORY_DATA.korean = FALLBACK_DATA_KOREAN;
      state.isFallbackData = true;

      // 폴백용 전체 메뉴 (한식만)
      ALL_MENUS = KOREAN_MENU.map((m) => ({
        ...m,
        category: "korean",
      }));

      const data = CATEGORY_DATA.korean;
      state.menuCategory = data.menu_category ?? DEFAULT_CATEGORY;
      state.faction =
        DEFAULT_FACTION_BY_CATEGORY[state.menuCategory] ??
        DEFAULT_FACTION_BY_CATEGORY[DEFAULT_CATEGORY];

      state.allClaims = Array.isArray(data.claims) ? data.claims : [];
      state.allReasons = Array.isArray(data.reasons) ? data.reasons : [];
      state.allStyles = Array.isArray(data.styles) ? data.styles : [];

      applyFactionFilter();
      return;
    }

    // HTTP/HTTPS 환경: 모든 카테고리 JSON 프리로드
    state.isFallbackData = false;

    const categoryEntries = Object.entries(CATEGORY_FILES);
    const categoryPromises = categoryEntries.map(async ([category, path]) => {
      const res = await fetch(path);
      if (!res.ok) {
        throw new Error(`JSON 로드 실패: ${path} (${res.status})`);
      }
      const json = await res.json();
      CATEGORY_DATA[category] = json;
    });

    // 메뉴 카탈로그 로드
    const catalogPromise = (async () => {
      try {
        const res = await fetch(MENU_CATALOG_PATH);
        if (!res.ok) {
          throw new Error(
            `메뉴 카탈로그 로드 실패: ${MENU_CATALOG_PATH} (${res.status})`
          );
        }
        const catalog = await res.json();
        if (catalog && Array.isArray(catalog.categories)) {
          ALL_MENUS = catalog.categories.flatMap((cat) => {
            if (!Array.isArray(cat.factions)) return [];
            return cat.factions.map((faction) => ({
              id: faction.id,
              label: faction.name || faction.id,
              labelKo: faction.name_ko || faction.name || faction.id,
              category: cat.id,
            }));
          });
        }
      } catch (e) {
        console.error("메뉴 카탈로그 로드 중 오류, 한식 메뉴로 폴백:", e);
        ALL_MENUS = KOREAN_MENU.map((m) => ({
          ...m,
          category: "korean",
        }));
      }
    })();

    await Promise.all([...categoryPromises, catalogPromise]);

    const initialCategory = DEFAULT_CATEGORY;
    const data =
      CATEGORY_DATA[initialCategory] ??
      CATEGORY_DATA.korean ??
      FALLBACK_DATA_KOREAN;

    state.menuCategory = data.menu_category ?? initialCategory;
    state.faction =
      DEFAULT_FACTION_BY_CATEGORY[state.menuCategory] ??
      DEFAULT_FACTION_BY_CATEGORY[initialCategory];

    state.allClaims = Array.isArray(data.claims) ? data.claims : [];
    state.allReasons = Array.isArray(data.reasons) ? data.reasons : [];
    state.allStyles = Array.isArray(data.styles) ? data.styles : [];

    applyFactionFilter();
  } catch (error) {
    console.error("데이터 로드 실패, 폴백 데이터 사용:", error);

    // 완전 실패 시에도 최소한 한식 폴백으로 동작
    CATEGORY_DATA.korean = FALLBACK_DATA_KOREAN;
    ALL_MENUS = KOREAN_MENU.map((m) => ({
      ...m,
      category: "korean",
    }));

    const data = CATEGORY_DATA.korean;
    state.menuCategory = data.menu_category ?? DEFAULT_CATEGORY;
    state.faction =
      DEFAULT_FACTION_BY_CATEGORY[state.menuCategory] ??
      DEFAULT_FACTION_BY_CATEGORY[DEFAULT_CATEGORY];

    state.allClaims = Array.isArray(data.claims) ? data.claims : [];
    state.allReasons = Array.isArray(data.reasons) ? data.reasons : [];
    state.allStyles = Array.isArray(data.styles) ? data.styles : [];

    state.isFallbackData = true;
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
  const resultEl =
    document.getElementById("combined-sentence") ||
    document.getElementById("result-sentence");
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
  const btnConfirmTurn = document.getElementById("confirm-turn");
  const btnNextTurn = document.getElementById("next-turn");

  function applyTexts() {
    // 현재 턴에 사용할 옵션 배열이 비어 있으면 새로 뽑기
    if (
      state.optionClaims.length === 0 ||
      state.optionReasons.length === 0 ||
      state.optionStyles.length === 0
    ) {
      setupTurnOptions();
    }

    // 현재는 각 배열에 최대 3개가 있다는 전제를 사용
    claimButtons.forEach((btn, index) => {
      const item = state.optionClaims[index];
      btn.textContent = item ? item.text : "-";
      btn.disabled = !item;
    });
    reasonButtons.forEach((btn, index) => {
      const item = state.optionReasons[index];
      btn.textContent = item ? item.text : "-";
      btn.disabled = true; // Reason은 Claim 선택 후 활성화
    });
    styleButtons.forEach((btn, index) => {
      const item = state.optionStyles[index];
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
    battleState.selected.claim = null;
    battleState.selected.reason = null;
    battleState.selected.style = null;
    applyTexts();
    setupMenuOptions();
    setStage("menu");
    updateLabels();
  }

  function setupMenuOptions() {
    // v2: menu_catalog 기반 전체 메뉴(카테고리 무관)에서 2개 랜덤 선택
    const source =
      Array.isArray(ALL_MENUS) && ALL_MENUS.length > 0
        ? ALL_MENUS
        : KOREAN_MENU;
    const pool = source.slice();
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
      const item = state.optionClaims[index];
      if (!item) return;
      state.selectedClaim = item;
      battleState.selected.claim = item;
      updateLabels();
      setStage("reason");
    });
  });

  reasonButtons.forEach((btn, index) => {
    btn.addEventListener("click", () => {
      const item = state.optionReasons[index];
      if (!item) return;
      state.selectedReason = item;
      battleState.selected.reason = item;
      updateLabels();
      setStage("style");
    });
  });

  styleButtons.forEach((btn, index) => {
    btn.addEventListener("click", () => {
      const item = state.optionStyles[index];
      if (!item) return;
      state.selectedStyle = item;
      battleState.selected.style = item;
      updateLabels();
      setStage("done");
    });
  });

  // 메뉴 선택 핸들러
  menuButtons.forEach((btn, index) => {
    btn.addEventListener("click", () => {
      const option = state.menuOptions[index];
      if (!option) return;

      // 메뉴(faction) 및 카테고리 설정
      state.faction = option.id;
      state.menuCategory = option.category || state.menuCategory || DEFAULT_CATEGORY;

      // 선택된 카테고리에 맞게 전체 풀 교체
      if (!state.isFallbackData) {
        const dataForCategory =
          CATEGORY_DATA[state.menuCategory] ??
          CATEGORY_DATA[DEFAULT_CATEGORY] ??
          FALLBACK_DATA_KOREAN;

        state.allClaims = Array.isArray(dataForCategory.claims)
          ? dataForCategory.claims
          : [];
        state.allReasons = Array.isArray(dataForCategory.reasons)
          ? dataForCategory.reasons
          : [];
        state.allStyles = Array.isArray(dataForCategory.styles)
          ? dataForCategory.styles
          : [];
      }

      if (selectedMenuEl) {
        selectedMenuEl.textContent = option.labelKo ?? option.label ?? option.id;
      }

      // 선택된 faction 기준으로 문장 풀 필터링 후 Claim 단계로 진입
      applyFactionFilter();
      setupTurnOptions();
      applyTexts();
      state.selectedClaim = null;
      state.selectedReason = null;
      state.selectedStyle = null;
      battleState.selected.claim = null;
      battleState.selected.reason = null;
      battleState.selected.style = null;
      updateLabels();
      setStage("claim");
    });
  });

  if (btnReset) {
    btnReset.addEventListener("click", () => {
      resetSelection();
    });
  }

  if (btnConfirmTurn) {
    btnConfirmTurn.addEventListener("click", () => {
      const { claim, reason, style } = battleState.selected;

      const logEl = document.getElementById("log-messages");
      if (!claim || !reason || !style) {
        if (logEl) {
          logEl.textContent =
            "Claim, Reason, Style을 모두 선택해야 턴을 확정할 수 있습니다.";
        }
        return;
      }

      const activeContextTags = getContextTags(battleState.context);
      const playerScores = scoreTurn(claim, reason, style, activeContextTags);

      // v0: CPU는 같은 풀에서 랜덤으로 문장 선택
      const cpuClaim = pickRandom(state.claims);
      const cpuReason = pickRandom(state.reasons);
      const cpuStyle = pickRandom(state.styles);
      const cpuScores = scoreTurn(
        cpuClaim,
        cpuReason,
        cpuStyle,
        activeContextTags
      );

      const delta = calcInfluenceDelta(
        playerScores.total,
        cpuScores.total
      );

      battleState.playerInfluence = Math.min(
        100,
        Math.max(0, battleState.playerInfluence + delta)
      );
      battleState.cpuInfluence = Math.min(
        100,
        Math.max(0, battleState.cpuInfluence - delta)
      );

      updateBattleHeader();
      showTurnResult(
        playerScores,
        cpuScores,
        delta,
        { claim, reason, style },
        { claim: cpuClaim, reason: cpuReason, style: cpuStyle }
      );

      // 이번 턴은 끝, 다음 턴 버튼만 활성화 (단 마지막 턴이면 비활성)
      if (btnConfirmTurn) btnConfirmTurn.disabled = true;
      if (btnNextTurn) {
        btnNextTurn.disabled = battleState.turn >= battleState.maxTurn;
      }
    });
  }

  if (btnNextTurn) {
    btnNextTurn.addEventListener("click", () => {
      if (battleState.turn >= battleState.maxTurn) {
        return;
      }

      battleState.turn += 1;
      battleState.selected.claim = null;
      battleState.selected.reason = null;
      battleState.selected.style = null;
      state.selectedClaim = null;
      state.selectedReason = null;
      state.selectedStyle = null;

      setupTurnOptions();
      applyTexts();
      updateLabels();
      setStage("claim");
      randomizeContext();

      const scoreSummaryEl = document.getElementById("score-summary");
      const logEl = document.getElementById("log-messages");
      const debugEl = document.getElementById("debug-panel");
      if (scoreSummaryEl) {
        scoreSummaryEl.textContent =
          "아직 점수가 없습니다. Claim/Reason/Style을 모두 고른 뒤 턴을 확정해보세요.";
      }
      if (logEl) {
        logEl.textContent = `Turn ${battleState.turn} 시작. Claim/Reason/Style을 선택해 주세요.`;
      }
      if (debugEl) {
        debugEl.textContent = "개발용 디버그: 아직 턴 정보 없음.";
      }

      if (btnNextTurn) btnNextTurn.disabled = true;
      if (btnConfirmTurn) btnConfirmTurn.disabled = false;
    });
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  await loadData();
  setupButtons();
  updateLabels();
  randomizeContext();
});


