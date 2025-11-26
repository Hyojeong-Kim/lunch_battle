// 매우 단순한 프로토타입용 스크립트
// - data/*.json 에서 Claim/Reason/Style 리스트를 로드
// - 버튼 3개로 각각 랜덤 선택
// - 현재 선택 상태를 합쳐 한 문장으로 표시

const state = {
  claims: [],
  reasons: [],
  styles: [],
  selectedClaim: null,
  selectedReason: null,
  selectedStyle: null,
};

async function loadData() {
  try {
    const [claimsRes, reasonsRes, stylesRes] = await Promise.all([
      fetch("./data/claims.json"),
      fetch("./data/reasons.json"),
      fetch("./data/styles.json"),
    ]);

    state.claims = await claimsRes.json();
    state.reasons = await reasonsRes.json();
    state.styles = await stylesRes.json();
  } catch (error) {
    console.error("데이터 로드 실패:", error);
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

  claimEl.textContent = state.selectedClaim ?? "아직 선택 안 됨";
  reasonEl.textContent = state.selectedReason ?? "아직 선택 안 됨";
  styleEl.textContent = state.selectedStyle ?? "아직 선택 안 됨";

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
  if (selectedClaim) parts.push(selectedClaim);
  if (selectedReason) parts.push(`왜냐하면 ${selectedReason}`);
  if (selectedStyle) parts.push(`(${selectedStyle} 톤)`); // 스타일은 괄호 처리

  resultEl.textContent = parts.join(" / ");
}

function setupButtons() {
  const btnClaim = document.getElementById("btn-claim");
  const btnReason = document.getElementById("btn-reason");
  const btnStyle = document.getElementById("btn-style");
  const btnRandomAll = document.getElementById("btn-random-all");

  btnClaim.addEventListener("click", () => {
    state.selectedClaim = pickRandom(state.claims);
    updateLabels();
  });

  btnReason.addEventListener("click", () => {
    state.selectedReason = pickRandom(state.reasons);
    updateLabels();
  });

  btnStyle.addEventListener("click", () => {
    state.selectedStyle = pickRandom(state.styles);
    updateLabels();
  });

  btnRandomAll.addEventListener("click", () => {
    state.selectedClaim = pickRandom(state.claims);
    state.selectedReason = pickRandom(state.reasons);
    state.selectedStyle = pickRandom(state.styles);
    updateLabels();
  });
}

window.addEventListener("DOMContentLoaded", async () => {
  await loadData();
  setupButtons();
  updateLabels();
});


