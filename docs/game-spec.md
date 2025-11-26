# Lunch War 게임 스펙 (v0.1 초안)

> 이 문서는 `README.md`와 `worldbuilding-log.md`, `assistant-guideline.md`를  
> 바탕으로 **구현 관점에서 필요한 스펙을 요약**한 문서입니다.
> - 기획/세계관의 상세 사고 과정은 `worldbuilding-log.md` 참고
> - AI 협업/톤 가이드는 `assistant-guideline.md` 참고

---

## 1. 핵심 개념 요약

- **장르**: 턴제 논리 배틀 / 캐주얼 전략
- **플랫폼 (v1)**: HTML5 브라우저에서 돌아가는 오프라인 프로토타입
- **플레이 방식**: 플레이어 vs CPU (서버리스)
- **테마**:
  - 평범한 사무실의 점심 시간
  - “오늘 점심 뭐 먹지?” 논쟁이 **전쟁 드라마급 세력 전쟁**으로 과장되는 세계
  - 등장인물: 2족보행 의인화 고양이 직장인 (뚱냥이 체형)

---

## 2. 한 판의 흐름 (요약)

1. **메뉴 선택**
   - 오늘의 점심 메뉴 후보(`menu_item`) 중 하나를 플레이어가 고른다.
   - 예: 제육볶음 / 김치찌개 / 라멘 / 돈카츠 등.
2. **카테고리 결정**
   - 선택된 메뉴의 상위 메뉴 카테고리(`menu_category`)가 결정된다.
   - 예: 제육/김찌 → `korean`, 라멘/돈카츠 → `japanese`.
3. **문장 세트 로딩**
   - 해당 카테고리용 **Claim/Reason/Style 3×3×3 세트**를 로드한다.
4. **컨텍스트 설정**
   - 오늘의 날씨/요일/월급 타이밍으로 `context`가 정해진다.
5. **5~7턴 진행**
   - 매 턴, 플레이어가 Claim/Reason/Style을 골라 문장 1개를 만들고,
   - 설득력 점수에 따라 세력치(100명 기준)가 이동한다.
6. **엔딩**
   - 마지막 턴 종료 시 플레이어 세력이 ≥ 51명이면 승리, 아니면 패배.

---

## 3. 데이터 구조 (개념 스키마)

### 3-1. 메뉴 / 카테고리

```json
{
  "menu_items": [
    { "id": "menu_pork_bulgogi", "name": "제육볶음", "category": "korean" },
    { "id": "menu_kimchi_stew", "name": "김치찌개", "category": "korean" },
    { "id": "menu_ramen", "name": "라멘", "category": "japanese" }
  ],
  "menu_categories": [
    { "id": "korean", "label": "한식" },
    { "id": "japanese", "label": "일식" }
  ]
}
```

### 3-2. 컨텍스트 (`context`)

```json
{
  "weather": "비",          // 맑음 / 흐림 / 비 / 눈
  "weekday": "목",          // 월 / 화/목 / 수 / 금
  "salary_timing": "D-5"   // D-5 / 월급날 / D+5
}
```

### 3-3. 문장 요소 (Claim / Reason / Style)

- 공통 필드:

```json
{
  "id": "claim_ramen_01",
  "text": "오늘 점심은 라멘 진영이 국물로 이 사무실을 구원해야 합니다.",
  "faction": "ramen",          // ramen | curry | cutlet | udon | neutral
  "tone": "논리형",             // 논리형 | 감성형 | 유머형 ...
  "tags": ["추움", "지침"],     // 컨텍스트와의 궁합용 태그
  "base_power": 2              // 1~3, 기본 설득력
}
```

- Claim / Reason / Style 파일 구조 예시:

```json
[
  {
    "id": "claim_ramen_01",
    "text": "오늘 점심은 라멘 진영이 국물로 이 사무실을 구원해야 합니다.",
    "faction": "ramen",
    "tone": "논리형",
    "tags": ["추움", "지침"],
    "base_power": 2
  },
  {
    "id": "claim_ramen_02",
    "text": "지금 이 체력으로는, 국물 들어간 라멘 말고는 버틸 수가 없습니다.",
    "faction": "ramen",
    "tone": "감성형",
    "tags": ["지침", "월말"],
    "base_power": 3
  }
]
```

> 실제 라멘 세트의 전체 목록과 설명은 `worldbuilding-log.md` 6번 섹션 참고.

---

## 4. 턴 구조 & 문장 조합 (상세)

### 4-1. 한 턴의 UI/로직 플로우 (v1)

1. **선택 UI**
   - Claim 영역: 3개 버튼 (텍스트 미리보기)
   - Reason 영역: 3개 버튼
   - Style 영역: 3개 버튼
2. **선택 결과**
   - 플레이어가 각 영역에서 1개씩 선택 → 총 3개 ID 확보
3. **문장 생성**
   - 출력 포맷 (텍스트):
     - `Reason.text + " " + Claim.text + " " + "(" + Style.text + ")"`
   - 예:
     - `어제 야근으로 간이 다 말라서 지금 국물 보충이 시급하기 때문입니다. 오늘 점심은 라멘 진영이 국물로 이 사무실을 구원해야 합니다. (사극 전투 장면처럼 절박한 톤으로.)`
4. **설득력 계산**
   - 5-1/5-2 섹션 규칙에 따라 점수 계산 (아래 참조).
5. **CPU 리액션 + 세력 이동**
   - 점수 구간에 따른 리액션 텍스트/연출,
   - 세력치 ±4/±6/±8 적용.

### 4-2. 설득력 점수 계산 (요약)

1. **기본 점수 합산**
   - `base_total = claim.base_power + reason.base_power + style.base_power`
2. **컨텍스트 보너스**
   - 현재 `context`와 각 요소의 `tags`를 비교.
   - 일치 태그 수에 따라 요소별 +보너스 (예: 최대 +2까지)  
   - 세 요소의 보너스를 합쳐 `context_bonus` 생성.
3. **최종 점수 & 단계화**
   - `total_score = base_total + context_bonus`
   - 예시 구간:
     - 0~4: 약한 설득 → 세력 이동량 ±4
     - 5~7: 보통 설득 → 세력 이동량 ±6
     - 8 이상: 강한 설득 → 세력 이동량 ±8

---

## 5. CPU 리액션 (v1)

- CPU는 **문장을 생성하지 않는다.**
- 설득력 레벨에 따라 고정 리액션만 제공:
  - 약한 설득:
    - 텍스트 예: `동료들이 시큰둥해 한다.`
  - 보통 설득:
    - 텍스트 예: `여럿이 고개를 끄덕이며 이쪽으로 기울기 시작했다.`
  - 강한 설득:
    - 텍스트 예: `자리 곳곳에서 "그거 좋다"는 말이 터져 나온다.`
- 난이도 조정은
  - 세력 이동량 보정,
  - 컨텍스트 보너스 크기 조정 등으로 구현 예정.

---

## 6. 파일 구조 & 구현 메모 (HTML5 v1)

- 루트 구조:
  - `index.html` – 기본 화면/버튼 구조
  - `style.css` – 레이아웃 및 버튼/텍스트 스타일
  - `main.js` – 게임 로직 (데이터 로딩, 선택, 점수 계산, 세력치 관리)
  - `data/`
    - `claims.json`
    - `reasons.json`
    - `styles.json`
  - `docs/`
    - `assistant-guideline.md`
    - `worldbuilding-log.md`
    - `game-spec.md` (이 문서)

### 6-1. main.js v1 목표

- [ ] `data/*.json`을 새 스키마(id/text/... 포함) 기준으로 로드
- [ ] 한 카테고리(예: 라멘/일식 세트)의 Claim/Reason/Style 3개만 우선 사용
- [ ] 각 칼럼별로 3개 버튼 UI 구성
- [ ] 선택 상태에 따라 문장 생성 → 화면 출력
- [ ] 아주 단순한 버전의 설득력 계산 및 세력치 이동 UI(숫자 기반) 추가

---

## 7. 참고 문서

- 세계관/사고 로그: `docs/worldbuilding-log.md`
- AI 협업 가이드: `docs/assistant-guideline.md`
- 간단 개요: `README.md`


