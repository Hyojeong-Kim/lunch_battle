# Lunch War 개발 로그 (Dev Log)

> 이 문서는 `Lunch War: Office Faction Battle` HTML5 프로토타입의  
> **구현 관점 변경 이력**을 간단히 기록하는 개발용 로그입니다.  
> 기획/세계관 로그는 `worldbuilding-log.md`를 참고하세요.

---

## 2025-11-26

### 1) 초기 프로토타입 골격

- `index.html` / `style.css` / `main.js` 생성
  - Claim / Reason / Style 각각을 **버튼 1개로 랜덤 뽑기** → 한 문장으로 합치는 가장 단순한 UI/로직 구현.
  - 데이터는 `data/claims.json`, `reasons.json`, `styles.json`의 문자열 배열을 사용.

### 2) 세계관/스펙 문서 정리

- `docs/assistant-guideline.md` 생성
  - 기존 `assistant_guideline_html_5.md` 내용을 프로젝트 표준 가이드로 복사.
- `docs/worldbuilding-log.md` 생성
  - 한 줄 정체성, 톤(황산벌 레퍼런스), 시점, 컨텍스트(날씨/요일/월급),  
    메뉴 카테고리/진영 구조, Claim/Reason/Style 설계 메모 등을 단계적으로 정리.
- `docs/game-spec.md` 생성
  - 한 판 플로우, 턴 구조, 컨텍스트/설득력 점수 계산, 파일 구조 등 **구현용 스펙 요약**.

### 3) 데이터 구조 개편

- 기존 `data/claims.json / reasons.json / styles.json` 삭제.
- 카테고리별 문장 풀 파일 추가:
  - `data/sentences_korean.json`
  - `data/sentences_chinese.json`
  - `data/sentences_western.json`
  - `data/sentences_japanese.json`
- 공통 오브젝트 스키마 도입:
  - `id`, `text`, `faction`, `tone`, `tags`, `base_power`
  - `menu_category` 루트 필드로 카테고리 구분.
- `docs/db_structure.md`에 전체 구조 및 한식/중식/양식 예시 문장 풀 정의.

### 4) 태그 및 컨텍스트 스펙

- `docs/tag-spec.md` 추가
  - 태그를 `카테고리_값` 형식으로 통일 (`날씨_비`, `요일_금`, `월급_D-5` 등).
  - v1에서는 **날씨/요일/월급 3종만 점수에 사용**, 나머지 상황/상태/가치 태그는 사용하지 않음.
- `data/sentences_*.json`의 `tags`를 스펙에 맞게 정리:
  - 날씨/요일/월급 관련 태그만 남기거나 변환,
  - 기타 설명용 태그는 v1 기준으로 제거.

### 5) 메뉴/카테고리/파벌 구조

- `data/menu_catalog.json` 추가
  - `categories[].id` = `korean` 등 카테고리,
  - `categories[].factions[].id` = `kimchi_stew`, `soft_tofu_stew`, `ramen` 등 세부 파벌,
  - 각 faction마다 `menu_items[]`로 실제 메뉴 버튼에 쓸 정보 정의.
- `docs/db_structure.md`에
  - `menu_category` (한식/중식/양식/일식)와  
  - `faction` (김찌파/순찌파/라멘파 등)의 관계 설명 추가.

### 6) 메인 로직 개편 (JSON + 폴백 + 필터링)

- `main.js`를 객체 기반 JSON 구조에 맞게 수정:
  - `state.claims/reasons/styles`가 이제 문자열이 아닌 **문장 객체 배열**을 가짐.
  - 화면에는 `selected*.text`를 사용해 출력.
- 파일 없이 `index.html`만 더블클릭했을 때도 동작하도록:
  - `window.location.protocol === "file:"` 인 경우 **폴백 데이터** 사용.
  - 초기에 일식/라멘용 폴백을 사용했다가, 이후 한식/김치찌개용 폴백(`FALLBACK_DATA_KOREAN`)으로 전환.
- faction 기반 필터링 로직 추가:
  - `state.allClaims/allReasons/allStyles` (원본 풀) + `state.claims/reasons/styles` (필터 결과) 분리.
  - `applyFactionFilter()`에서
    - 선택된 `faction` 전용 문장 +
    - 카테고리 공통(`menuCategory`) +
    - 완전 공통(`neutral`)
    만 필터링해서 사용.

### 7) UI 단계 개편 (순차 선택)

- `index.html` / `style.css` 수정:
  - Claim/Reason/Style 각각 **3개 버튼** + 선택 결과 라벨 구조로 변경.
  - Claim → Reason → Style 순서대로 행이 하나씩 열리도록 `setStage()` 로직 도입.
  - “선택 초기화하고 처음부터 다시” 버튼으로 Claim 단계부터 재시작 가능.
- 최종 문장 포맷:
  - `Reason.text + Claim.text + (Style.text)` 형태로 조합해 표시.

### 8) 메뉴 선택 단계 추가 (한식 v1)

- 한식 메뉴 풀(`KOREAN_MENU`) 상수 추가:
  - `kimchi_stew`, `soybean_paste_stew`, `soft_tofu_stew`, `spicy_pork`,  
    `bibimbap`, `kimchi_fried_rice`, `yukgaejang`, `gamjatang`, `samgyeopsal`, `galbijjim`.
- `index.html`에 “0. 메뉴 선택” 행 추가:
  - 메뉴 버튼 2개 + 선택 결과 라벨(`selected-menu`).
- `main.js`:
  - `setupMenuOptions()`에서 한식 메뉴 풀에서 **2개 랜덤 선택 후 버튼에 표시**.
  - 메뉴 버튼 클릭 시:
    - `state.faction = 선택된 메뉴 id`,
    - `applyFactionFilter()` 호출로 해당 메뉴 전용 + 한식 공통 문장만 사용,
    - Claim/Reason/Style 선택 상태를 초기화하고 Claim 단계로 진입.
  - 리셋 버튼 클릭 시:
    - 메뉴 선택부터 다시 진행할 수 있도록 `state.faction/menuOptions` 초기화 후 `"menu"` 단계로 복귀.

### 9) 한식 문장 풀 확장 (Claim/Reason/Style)

- `data/sentences_korean.json`에 한식 카테고리 전용 문장 풀 확장:
  - Claim:
    - 한식 공통 Claim 5개 (`faction: "korean"`)
    - 메뉴별 Claim 2개씩 × 10메뉴 (총 20개, `faction: 각 메뉴 id`)
  - Reason:
    - 한식 공통 Reason 5개 (`faction: "korean"`)
    - 메뉴별 Reason 2개씩 × 10메뉴 (총 20개)
  - Style:
    - 메뉴 카테고리와 무관하게 사용하는 공통 스타일 30개
    - `faction: "neutral"`로 설정해, 어떤 메뉴를 선택해도 공통 Style 풀을 공유.

---

## 2025-11-27

### 1) 카테고리/메뉴 확장 및 카탈로그 통합

- `data/menu_catalog.json` 확장
  - 기존 한식(`korean`) 외에 **중식(`chinese`) / 일식(`japanese`) / 양식(`western`)** 카테고리 추가.
  - 각 카테고리별로 10개 내외의 `factions` 정의:
    - 중식: 짜장면, 짬뽕, 볶음밥, 탕수육, 마파두부, 깐풍기, 고추잡채밥, 새우볶음밥, 삼선짬뽕, 유산슬 등.
    - 일식: 라멘, 돈카츠, 규동, 우동, 소바, 연어덮밥, 오야코동, 가츠동, 스시, 사시미.
    - 양식: 파스타, 스테이크, 포케, 오므라이스, 리조또, 피자, 그릴드 치킨, 파니니, 햄버그 스테이크, 타코.
  - 각 faction 마다 `menu_items[]`에 버튼 라벨(한/영) 정의, UI에서 공통으로 사용.

### 2) 중식/일식/양식 문장 풀 구축

- `data/sentences_chinese.json`
  - `menu_category: "chinese"`.
  - Claim:
    - 중식 공통 Claim 5개 (`faction: "chinese"`).
    - 메뉴별 Claim 2개씩 × 10메뉴 (짜장~유산슬).
  - Reason:
    - 중식 공통 Reason 5개.
    - 메뉴별 Reason 2개씩 × 10메뉴.
- `data/sentences_japanese.json`
  - `menu_category: "japanese"`.
  - 일식 공통 Claim/Reason 5개 + 메뉴별 Claim/Reason 2개씩 구성.
  - Style:
    - 초기에 라멘 전용 스타일 3개를 사용했다가, 이후 공통 스타일 세트로 통일.
- `data/sentences_western.json`
  - `menu_category: "western"`.
  - 양식 공통 Claim 5개 + 메뉴별 Claim 2개씩 × 10메뉴.
  - 양식 공통 Reason 5개 + 메뉴별 Reason 2개씩 × 10메뉴를 신규 작성하여 반영.

### 3) 공통 Style 세트 v1 적용

- `sentences_korean.json`에 정의한 **공통 Style 30개 세트**를 다른 카테고리에도 동일 적용:
  - `style_common_01` ~ `style_common_30` (논리형/감성형/유머형/전투형).
  - 전부 `faction: "neutral"`로 설정해, 한·중·일·양식 전체에서 동일한 말투 선택지가 랜덤으로 등장.
- `sentences_chinese.json / sentences_japanese.json / sentences_western.json`의 기존 스타일 문장은 삭제하고 공통 세트로 교체.

### 4) 태그(날씨/요일/월급) 튜닝

- `docs/tag-spec.md` 스펙에 맞게 중식/일식/양식 문장에도 태그를 추가:
  - 날씨:
    - 비/눈 + 따뜻한 국물 계열: 짬뽕, 라멘, 우동, 육개장 등 → `날씨_비`, `날씨_눈`.
    - 맑은 날 가볍게 먹는 메뉴(소바 등) → `날씨_맑음`.
  - 요일:
    - 불금/회식 느낌의 메뉴(피자, 타코, 탕수육 등) → `요일_금`.
    - 주초/업무 모드(월)에서 빨리 먹고 일하기 좋은 문장 → `요일_월`.
    - 주중 중간(수) 피로 관리/가볍게 먹기 → `요일_수`.
    - 일식 연어덮밥 등은 비교적 여유로운 `요일_화목`에 매칭.
  - 월급:
    - 월급 전(`월급_D-5`) 가성비/중식/양식 Reason 일부에 태그 추가.
    - 월급날(`월급_월급날`)에는 삼겹살/스테이크/스시/유산슬 등 “보상형 메뉴”에 태그 부여.
    - 월급 직후(`월급_D+5`)에는 갈비찜/사시미/가츠동/햄버그 스테이크 쪽에 태그 부여.
- `scoreSentence()`에서 태그 매칭 시 **태그 1개당 +2점 보너스**를 유지, 컨텍스트에 따라 메뉴 간 점수 차이가 확실히 나도록 조정.

### 5) 메뉴 선택 로직 확장 (전 카테고리 공통)

- `main.js`
  - `CATEGORY_FILES` + `CATEGORY_DATA`:
    - 한/중/일/양식 각 카테고리 JSON을 HTTP 환경에서 모두 프리로드.
  - `MENU_CATALOG_PATH` + `ALL_MENUS`:
    - `menu_catalog.json`을 읽어, 모든 카테고리의 `factions`를 평탄화한 전체 메뉴 리스트를 생성.
  - `loadData()`:
    - `file://`일 경우:
      - 기존처럼 `FALLBACK_DATA_KOREAN` + `KOREAN_MENU`만 사용.
    - HTTP/HTTPS일 경우:
      - 모든 카테고리 JSON과 `menu_catalog.json`을 병렬로 로드하고, 초기 카테고리는 한식으로 설정.
  - `setupMenuOptions()`:
    - 메뉴 선택 단계에서 이제 **카테고리 무관 전체 메뉴 풀(ALL_MENUS)**에서 2개를 랜덤 선택.
    - 카탈로그 로드 실패 시에는 한식 메뉴만 사용하는 폴백 로직 유지.
  - 메뉴 버튼 클릭 시:
    - `state.faction = 선택한 메뉴 id`, `state.menuCategory = 해당 메뉴의 category`.
    - 선택된 카테고리의 `claims/reasons/styles`를 `CATEGORY_DATA`에서 다시 로드 후 `applyFactionFilter()` 수행.

### 6) 점수/CPU 배틀 로직 + 디버그 패널

- `scoreSentence()` / `scoreTurn()` / `calcInfluenceDelta()`:
  - Claim/Reason/Style 각각:
    - `base_power` + (매칭 태그 수 × 2점)으로 점수 계산.
  - 플레이어 vs CPU 각 턴의 총점 차이에 따라 세력 변화량 결정:
    - +8 / +4 / 0 / -4 / -8 단계.
- CPU 선택:
  - 현재 필터링된 문장 풀에서 Claim/Reason/Style을 각각 랜덤으로 뽑아 CPU 점수 산출.
- UI:
  - 상단 `battle-header`에 Turn / 세력치 / 컨텍스트(날씨/요일/월급) 표시.
  - `showTurnResult()`에서 이번 턴 점수 요약 + CPU 리액션 + 플레이어/CPU 문장을 로그로 출력.
- 디버그 패널:
  - `index.html` 결과 카드 안에 `<pre id="debug-panel">` 추가.
  - `explainSentenceScore()`를 통해 각 문장의:
    - `base_power`, 매칭 태그, 태그 보너스, 최종 점수를 계산해 문자열로 정리.
  - 턴 확정 시:
    - 현재 컨텍스트 태그와 플레이어/CPU의 Claim/Reason/Style별 상세 점수를 개발용으로 표시.
  - 다음 턴 시작 시:
    - `debug-panel` 내용을 `"개발용 디버그: 아직 턴 정보 없음."`으로 리셋.

### 7) 버그/톤 정리

- 일식 Style:
  - 초기에 `faction: "ramen"`으로 설정되어 라멘 선택 시에만 Style이 노출되는 버그가 있었음.
  - 이후 Style 전체를 공통 세트(`neutral`)로 통합하면서 문제 해결.
- 양식 Style:
  - 예전 긴 문장 스타일(프레젠테이션/인스타톤 등)을 사용하던 것을,  
    v1 설계에 맞춘 짧은 공통 Style 세트로 교체해 톤 일관성 확보.

---

## 2025-11-28

### 1) 인트로 / Start To Battle 화면 도입

- `index.html`
  - 기존 배틀 화면을 `battle-screen` 섹션으로 감싸고,
  - 별도의 인트로 섹션 `start-screen`을 추가:
    - 타이틀: “Lunch War: Office Faction Battle”
    - 한 줄 설명: 직장인 고양이 점심 메뉴 전쟁 + Claim/Reason/Style 조합 요약
    - `START TO BATTLE` 버튼: 실제 배틀 화면으로 진입하는 유일한 진입점.
- `style.css`
  - 인트로 카드를 중앙에 배치하는 레이아웃 추가:
    - 최소 뷰포트 높이, 가운데 정렬, 카드 스타일(라운드+그라데이션+섀도우).
  - `battle-screen` 기본 `display: none;`, `.is-active` 시에만 표시되도록 클래스 기반 토글 구조 도입.

### 2) 인트로 → 배틀 전환 로직

- `main.js`
  - `initIntroScreen()` 추가:
    - `start-battle-btn`, `start-screen`, `battle-screen`을 찾아 이벤트 바인딩.
    - 초기에는:
      - `battle-screen`에서 `.is-active` 제거, `aria-hidden="true"` 설정.
    - Start 버튼 클릭 시:
      - `start-screen`을 `display: none` 처리.
      - `battle-screen`에 `.is-active` 추가, `aria-hidden`을 `false`로 변경.
      - `updateBattleHeader()`와 첫 턴 안내 로그 설정.
  - `DOMContentLoaded` 핸들러에서:
    - 기존 `loadData()`, `setupButtons()`, `updateLabels()`, `randomizeContext()` 호출 뒤
    - `initIntroScreen()`을 호출하여 인트로-배틀 흐름 초기화.

### 3) 현재 상태 메모

- 코어 기능 측면:
  - Start 화면 → 메뉴 2개 중 1개 선택 → Claim/Reason/Style 순차 선택 → 점수/세력/디버그까지  
    한 판을 플레이할 수 있는 **텍스트/버튼 기반 MVP 루프** 완성.
- UI/연출 측면:
  - 인트로와 배틀 화면이 분리되면서,
    - 향후 엔딩 화면/리플레이 UX/난이도 선택 등도 같은 구조로 확장할 수 있는 기반 확보.

---

향후에는 이 로그에 날짜를 추가하면서:
- 카테고리/진영 확장,
- 세력치/턴 UI 추가,
- Godot 컨버전 관련 변경사항
등을 적어 나간다.


