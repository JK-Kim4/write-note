# 04 · 구현 금지 패턴 & Review Checklist

> 구현 중 디자인이 흔들리지 않도록 고정하는 금지 목록과 PR/구현 review 체크리스트.
> 컨셉은 [`00-concept.md`](./00-concept.md), token은 [`01-design-system.md`](./01-design-system.md).

## 1. 금지 패턴 (하면 안 되는 것)

| # | 금지 | 이유 |
|---|---|---|
| 1 | **dashboard card 과잉** | 첫 화면이 SaaS dashboard처럼 보이면 안 된다. 카드는 정보 단위에만, 장식으로 늘리지 않는다. |
| 2 | **hero section** | 큰 배너·타이틀로 시선 끄는 랜딩 구성 금지. 첫 화면부터 작업 도구. |
| 3 | **과한 beige/cream 톤** | 종이색은 에디터 page(`--paper`)에만 아주 약하게. 다른 surface로 번지면 안 된다. |
| 4 | **기본 dark UI** | 기본값은 light. 전체 dark mode는 MVP 범위 밖. |
| 5 | **장식용 gradient** | 그라데이션·glow·색 그림자 금지. 그림자는 정의된 3종만. |
| 6 | **기존 WEB UI를 디자인 SoT로 재사용** | `frontend/` 컴포넌트는 참고만. 디자인 source of truth로 삼지 않는다. |
| 7 | **집필실 side panel이 editor보다 강해지는 구성** | 글쓰기 canvas가 항상 주인공. panel은 얇은 보조 surface. |
| 8 | **blue 남용** | blue는 primary action + focus state에만. 정보 표시·아이콘·장식에 blue 금지. |
| 9 | **상태 변화의 시끄러운 알림** | 저장/에러는 titlebar 라벨이나 현재 위치 한 줄로 조용히. 전역 toast·모달 배너 폭주 금지. |
| 10 | **token 밖 임의 값** | `01-design-system.md` 밖의 색/spacing/radius 신설 금지. 필요하면 문서를 먼저 갱신. |
| 11 | **UI 텍스트 영어 라벨 신설** | 한국 대상 서비스. 사용자에게 보이는 라벨·버튼·화면명·placeholder는 한글로 쓴다. 새 영어 라벨 신설 금지(코드 식별자·CSS 클래스·정착 외래어는 예외). |

## 2. Review Checklist

구현 PR 또는 화면 작업 완료 시 아래를 확인한다. 하나라도 ✗면 수정 후 머지.

### 톤 & 색
- [ ] 첫 화면이 dashboard가 아니라 조용한 글쓰기 도구처럼 보인다.
- [ ] blue가 primary action + focus state 외의 곳에 쓰이지 않았다.
- [ ] 종이색(`--paper`)이 에디터 page 밖으로 번지지 않았다.
- [ ] gradient / glow / 색 그림자가 없다. 그림자는 정의된 3종만 쓴다.
- [ ] 기본 배경이 light다 (dark 기본값 아님).

### 레이아웃 & 위계
- [ ] 작품: 새 작품 작성 블럭이 main body, 작품 목록이 우측 리스트다.
- [ ] 집필실: 에디터가 중심이고 side panel이 시각적으로 더 약하다.
- [ ] rail이 64px이고 화면 전환 역할만 한다.
- [ ] 에디터 page가 중앙 정렬(max-width 660px)이다.

### 상태
- [ ] empty / loading / error / saving / focus 중 해당 화면 상태가 [`03-screen-states.md`](./03-screen-states.md) 정의대로 구현됐다.
- [ ] 자동저장 상태가 titlebar 라벨로 조용히 표현된다 (모달/배너 아님).
- [ ] 에러 시 입력 내용이 소실되지 않는다.
- [ ] empty 상태가 dashed 카드 + 한 줄 안내로 조용하다.

### token 정합
- [ ] 사용한 색/spacing/radius가 모두 `01-design-system.md` token이다.
- [ ] 새 token이 필요했다면 문서를 먼저 갱신하고 코드에 반영했다.

### 한국어 라벨
- [ ] 사용자에게 노출되는 라벨·버튼·화면명·placeholder가 모두 한글이다 (코드 식별자/CSS 클래스 제외).
- [ ] 새 영어 라벨을 신설하지 않았다 (불가피한 외래어는 한글 표기로 정착시킨다).

### MVP 범위
- [ ] 제외 기능(원고지/모바일/인증/동기화/태그/검색/AI 등)의 UI를 그리지 않았다.
- [ ] 작품 생성 UI에 `title` + `summary`만 노출했다 (`tone`/`targetLength`는 비노출 가능).

## 3. 디자인 변경 절차

이 디자인 기준을 바꿔야 할 때:
1. 해당 산출물(`00`~`04` / `wireframes.html`) 을 먼저 수정한다.
2. 변경 이유를 PR 설명 또는 회고에 남긴다.
3. token 변경은 `01-design-system.md` → 코드 순서로만. 코드에서 먼저 바꾸고 문서를 나중에 맞추지 않는다.
