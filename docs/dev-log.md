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

향후에는 이 로그에 날짜를 추가하면서:
- 카테고리/진영 확장,
- 세력치/턴 UI 추가,
- Godot 컨버전 관련 변경사항
등을 적어 나간다.


