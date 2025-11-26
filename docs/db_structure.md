# Lunch War 문장 풀 DB 설계 (카테고리 확장용)

## 1. 전체 구조

```bash
/data
  sentences_korean.json
  sentences_chinese.json
  sentences_western.json
  sentences_japanese.json
```

각 파일 공통 포맷:

```json
{
  "menu_category": "korean",     
  "claims": [ /* Claim 배열 */ ],
  "reasons": [ /* Reason 배열 */ ],
  "styles": [ /* Style 배열 */ ]
}
```

공통 오브젝트 스키마(Claim/Reason/Style 공통):

```json
{
  "id": "claim_korean_01",
  "text": "오늘 점심은 한식으로 속을 제대로 한 번 다져놓는 게 맞다고 봅니다.",
  "faction": "korean",          
  "tone": "논리형",              
  "tags": ["지침", "월말"],      
  "base_power": 2               
}
```

> **중요: `menu_category` vs `faction`**
>
> - `menu_category`: 한식/중식/양식/일식 같은 **큰 메뉴 계열**  
>   - 예: `"korean"`, `"chinese"`, `"western"`, `"japanese"`
> - `faction`: 그 안에서 싸우는 **구체 진영/파벌 이름**  
>   - 예:
>     - 한식 카테고리 안에서  
>       - `"kimchi_stew"` (김찌파), `"soft_tofu"` (순찌파) 등  
>     - 일식 카테고리 안에서  
>       - `"ramen"`, `"katsu"` 등
> - 즉,
>   - **`menu_category`는 DB 파일을 나누는 상위 그룹**,  
>   - **`faction`은 같은 카테고리 안에서 서로 다른 편(파벌)을 구분하는 이름**이다.
> - v1 예시에서는 한식 세트 전체를 `faction: "korean"`으로 두었지만,  
>   실제 게임 구현 시에는 **같은 한식 파일 안에서도 김찌파/순찌파 등을 `faction`으로 나눌 수 있도록** 설계한다.

---

## 1-1. 태그 스펙 요약

태그에 대한 상세 규칙은 `docs/tag-spec.md`를 따른다.  
여기서는 DB 설계 관점에서 필요한 최소 정보만 요약한다.

- 태그 형식: `카테고리_값`
- v1에서 실제 사용되는 태그 카테고리:

| 카테고리         | prefix    | 예시 값             |
|------------------|-----------|---------------------|
| 날씨(Weather)    | `날씨_*`  | 맑음/흐림/비/눈     |
| 요일(Weekday)    | `요일_*`  | 월/화목/수/금       |
| 월급(Salary)     | `월급_*`  | D-5/월급날/D+5      |

- 규칙:
  - 한 문장에 태그는 최대 1~2개까지만 사용.
  - 현재 버전에서는 **위 3종 외의 태그(상황/상태/가치)는 사용하지 않음**.
  - 점수 계산은 `context`(날씨/요일/월급)와 태그의 일치 여부만으로 진행.

---

## 2. 한식 세트 예시 (`sentences_korean.json`)

```json
{
  "menu_category": "korean",
  "claims": [
    {
      "id": "claim_korean_01",
      "text": "오늘 점심은 한식으로 속을 제대로 한 번 다져놓는 게 맞다고 봅니다.",
      "faction": "korean",
      "tone": "논리형",
      "tags": ["지침", "월말"],
      "base_power": 2
    },
    {
      "id": "claim_korean_02",
      "text": "이 정도로 피곤한 날엔, 밥 한 그릇에 국 하나는 깔아줘야 사람 구실을 합니다.",
      "faction": "korean",
      "tone": "감성형",
      "tags": ["지침", "야근"],
      "base_power": 3
    },
    {
      "id": "claim_korean_03",
      "text": "한 번 든든하게 먹어놔야, 오후 회의에서 쓰러지는 동료가 안 나옵니다.",
      "faction": "korean",
      "tone": "유머형",
      "tags": ["회의", "불금"],
      "base_power": 2
    }
  ],
  "reasons": [
    {
      "id": "reason_korean_01",
      "text": "어제 야근에 컵라면으로 대충 때운 결과, 지금 몸이 한국식 가정식 같은 걸 절실히 요구하고 있기 때문입니다.",
      "faction": "korean",
      "tone": "감성형",
      "tags": ["야근", "지침"],
      "base_power": 3
    },
    {
      "id": "reason_korean_02",
      "text": "외근도 많고 걸어 다닐 일도 많은 날이라, 밥이랑 국으로 탄수와 수분을 동시에 채워놔야 하기 때문입니다.",
      "faction": "korean",
      "tone": "논리형",
      "tags": ["외근", "추움"],
      "base_power": 2
    },
    {
      "id": "reason_korean_03",
      "text": "월말 결산 지옥 들어가기 전에, 김치찌개 한 번으로 멘탈 방어막을 쳐둘 필요가 있기 때문입니다.",
      "faction": "korean",
      "tone": "논리형",
      "tags": ["월말", "리포트"],
      "base_power": 2
    }
  ],
  "styles": [
    {
      "id": "style_korean_01",
      "text": "재무 보고서 설명하듯, 수치와 근거를 차분하게 들이밀면서.",
      "faction": "korean",
      "tone": "논리형",
      "tags": ["월", "회의"],
      "base_power": 2
    },
    {
      "id": "style_korean_02",
      "text": "어젯밤 야근 썰을 살짝 섞어서, 동료들의 동정심을 자극하는 톤으로.",
      "faction": "korean",
      "tone": "감성형",
      "tags": ["야근", "지침"],
      "base_power": 3
    },
    {
      "id": "style_korean_03",
      "text": "단톡방 밈에 쓰일 법한 말투로, '이건 국밥각이다'를 반복하면서 농담 반 진담 반으로.",
      "faction": "korean",
      "tone": "유머형",
      "tags": ["불금", "화/목"],
      "base_power": 1
    }
  ]
}
```

---

## 3. 중식 세트 예시 (`sentences_chinese.json`)

```json
{
  "menu_category": "chinese",
  "claims": [
    {
      "id": "claim_chinese_01",
      "text": "오늘 점심은 중국집으로 가서 탄수와 기름을 한 번에 해결하는 게 전략적으로 맞습니다.",
      "faction": "chinese",
      "tone": "논리형",
      "tags": ["지침", "외근"],
      "base_power": 2
    },
    {
      "id": "claim_chinese_02",
      "text": "짜장 한 그릇 먹고 나면, 최소한 오후 두 시까지는 버틸 수 있습니다.",
      "faction": "chinese",
      "tone": "감성형",
      "tags": ["지침", "리포트"],
      "base_power": 3
    },
    {
      "id": "claim_chinese_03",
      "text": "오늘 탕수육 안 시키면, 이 팀에서 배신자가 나올 수도 있습니다.",
      "faction": "chinese",
      "tone": "유머형",
      "tags": ["불금", "회의"],
      "base_power": 2
    }
  ],
  "reasons": [
    {
      "id": "reason_chinese_01",
      "text": "밖에 비가 와서 멀리 나가기 애매하니, 배달·포장에 최적화된 메뉴를 선택하는 것이 합리적이기 때문입니다.",
      "faction": "chinese",
      "tone": "논리형",
      "tags": ["비", "외근"],
      "base_power": 2
    },
    {
      "id": "reason_chinese_02",
      "text": "이번 달 지출을 생각하면, 짜장면 세트 정도가 가성비와 만족도 사이의 타협안이기 때문입니다.",
      "faction": "chinese",
      "tone": "논리형",
      "tags": ["D-5", "D+5"],
      "base_power": 2
    },
    {
      "id": "reason_chinese_03",
      "text": "팀원들 입맛이 제각각일 때, 짜장·짬뽕·볶음밥으로 모두를 만족시키기 가장 쉬운 선택이기 때문입니다.",
      "faction": "chinese",
      "tone": "감성형",
      "tags": ["회의", "조율"],
      "base_power": 3
    }
  ],
  "styles": [
    {
      "id": "style_chinese_01",
      "text": "프로젝트 킥오프 프레젠테이션처럼, 장점들을 슬라이드 넘기듯 나열하는 톤으로.",
      "faction": "chinese",
      "tone": "논리형",
      "tags": ["월", "회의"],
      "base_power": 2
    },
    {
      "id": "style_chinese_02",
      "text": "'예전에 우리 다 같이 시켜 먹고 행복해했던 그 날'을 소환하듯, 추억팔이하는 말투로.",
      "faction": "chinese",
      "tone": "감성형",
      "tags": ["추억", "팀워크"],
      "base_power": 3
    },
    {
      "id": "style_chinese_03",
      "text": "탕수육 찍먹/부먹 논쟁을 일부러 꺼내서, 분위기를 띄운 다음 슬쩍 메뉴를 밀어 넣는 방식으로.",
      "faction": "chinese",
      "tone": "유머형",
      "tags": ["불금", "화/목"],
      "base_power": 1
    }
  ]
}
```

---

## 4. 양식 세트 예시 (`sentences_western.json`)

```json
{
  "menu_category": "western",
  "claims": [
    {
      "id": "claim_western_01",
      "text": "오늘 정도면, 한 번쯤은 파스타나 샐러드로 분위기를 바꿔줄 필요가 있습니다.",
      "faction": "western",
      "tone": "논리형",
      "tags": ["중간주", "D+5"],
      "base_power": 2
    },
    {
      "id": "claim_western_02",
      "text": "계속 무거운 것만 먹다 보면 퍼지니까, 오늘은 가볍게 양식으로 리듬을 한 번 바꾸는 게 좋습니다.",
      "faction": "western",
      "tone": "감성형",
      "tags": ["건강", "지침"],
      "base_power": 3
    },
    {
      "id": "claim_western_03",
      "text": "오늘 샐러드 먹어두면, 오후 회의 때 '우리 팀 되게 의식 있는 팀'처럼 보일 수도 있습니다.",
      "faction": "western",
      "tone": "유머형",
      "tags": ["회의", "이미지"],
      "base_power": 2
    }
  ],
  "reasons": [
    {
      "id": "reason_western_01",
      "text": "이번 주에 이미 두 번이나 국밥 계열을 갔기 때문에, 메뉴 편식을 방지할 필요가 있기 때문입니다.",
      "faction": "western",
      "tone": "논리형",
      "tags": ["반복", "지침"],
      "base_power": 2
    },
    {
      "id": "reason_western_02",
      "text": "외부 미팅이 있어 깔끔한 소스·냄새가 덜 나는 메뉴를 선택하는 게 예의이기 때문입니다.",
      "faction": "western",
      "tone": "논리형",
      "tags": ["외근", "회의"],
      "base_power": 2
    },
    {
      "id": "reason_western_03",
      "text": "월급 들어온 지 얼마 안 됐을 때 한 번쯤은, '사치 아닌 사치'를 해줘야 다음 달까지 버틸 힘이 생기기 때문입니다.",
      "faction": "western",
      "tone": "감성형",
      "tags": ["월급날", "D+5"],
      "base_power": 3
    }
  ],
  "styles": [
    {
      "id": "style_western_01",
      "text": "브랜딩 기획 회의하듯, '우리 팀 이미지'를 슬쩍 강조하는 프레젠테이션 톤으로.",
      "faction": "western",
      "tone": "논리형",
      "tags": ["회의", "브랜딩"],
      "base_power": 2
    },
    {
      "id": "style_western_02",
      "text": "인스타 스토리 올릴 것처럼, '여기 가면 사진 건진다'는 식의 말투로 살짝 유혹하듯이.",
      "faction": "western",
      "tone": "감성형",
      "tags": ["불금", "이미지"],
      "base_power": 3
    },
    {
      "id": "style_western_03",
      "text": "다이어리에 적어둘 새해 목표를 읊조리듯, '이번 달엔 양식도 한 번쯤'이라고 농담 섞어 말하는 톤으로.",
      "faction": "western",
      "tone": "유머형",
      "tags": ["건강", "목표"],
      "base_power": 1
    }
  ]
}
```
