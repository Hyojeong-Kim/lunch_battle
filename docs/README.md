# Lunch War: Office Faction Battle (HTML5 Prototype)

이 리포지토리는 `Lunch War: Office Faction Battle(가제)`의  
아주 초기 HTML5 프로토타입을 위한 공간입니다.

## 현재 포함된 것

- `index.html`  
  - Claim / Reason / Style을 버튼으로 선택하고,  
    선택 결과를 한 문장으로 합쳐서 보여주는 최소 UI
- `style.css`  
  - 간단한 카드형 레이아웃 및 버튼 스타일
- `main.js`  
  - `data/claims.json`, `data/reasons.json`, `data/styles.json`을 로드하고  
    각 버튼 클릭 시 랜덤으로 하나씩 선택해서 문장으로 조합
- `data/*.json`  
  - 테스트용 Claim/Reason/Style 예시 문장 세트
- `docs/assistant-guideline.md`  
  - AI 어시스턴트와 협업 시 따라야 하는 HTML5 버전 가이드

## 사용 방법

1. 로컬에서 이 리포지토리를 클론/다운로드합니다.
2. 브라우저에서 `index.html` 파일을 직접 열면  
   별도 서버 없이 바로 버튼 테스트가 가능합니다.

※ 이후 단계에서:
- 세력치(100명), 5~7턴 전투, AI 반박 로직 등이 이 프로토타입 위에 추가될 예정입니다.


