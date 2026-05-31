# 00 · 컨셉과 톤앤매너

> Desktop MVP 디자인의 본질 정의. 나머지 산출물(`01`~`04`, `wireframes.html`)은 이 문서의 컨셉을 시각/구조로 구체화한 것이다. 충돌 시 이 문서가 우선.

## 제품 한 줄

컨텍스트가 안 죽는 작가용 작업공간. 메모와 글쓰기 에디터가 같은 시스템에 살면서, 세션이 끊겨도 컨텍스트가 영속한다.

Desktop MVP는 이 본질을 **로컬 우선 Electron 앱**으로, **글쓰기 한 세션을 실제로 끝낼 수 있는 최소 제품**으로 검증한다.

## 디자인 방향 = Focus Studio (단일 명칭)

이 프로젝트의 desktop 디자인 방향은 **Focus Studio** 하나로 부른다. Focus Studio는 두 가지를 동시에 포괄하는 단일 명칭이다.

| 축 | 의미 |
|---|---|
| **시각 톤** | macOS native에 가까운 조용한 데스크탑 도구의 외관 — 회색/백색 기반, 절제된 그림자, blue는 액션에만. |
| **레이아웃 구조** | 글쓰기 canvas가 화면의 중심. 작품/메모는 얇은 보조 surface로 접근 가능하되 canvas를 압도하지 않는다. |

> 과거 문서에 등장하던 "Native Studio"는 이 명칭의 옛 표기다. 모든 산출물은 **Focus Studio** 로 통일한다.

## 무엇처럼 느껴져야 하는가

- 처음 열었을 때 **dashboard가 아니라 조용한 글쓰기 환경**처럼 느껴진다.
- 에디터가 화면의 주인공이고, 나머지는 필요할 때 옆에서 조용히 거든다.
- 반복해서 매일 여는 도구의 **안정감**이 문학적 장식보다 우선한다.
- 색과 그림자는 정보의 위계를 만들 만큼만 쓰고, 그 이상 장식하지 않는다.

## 무엇처럼 느껴지면 안 되는가

- 카드가 가득한 SaaS dashboard.
- 큰 hero 배너로 시선을 끄는 랜딩 페이지.
- 과한 beige/cream 으로 "감성"을 연출한 노트앱.
- 기본값이 어두운 dark IDE.
- 그라데이션·아이콘·뱃지로 꾸민 화면.

(상세 금지 목록과 review checklist는 [`04-implementation-rules.md`](./04-implementation-rules.md).)

## 4개 핵심 화면 (MVP 범위)

| 화면 | 한 줄 역할 |
|---|---|
| **작품** | 작성할 작품을 만들거나 고른다. 새 작품 작성 블럭이 main body, 기존 작품 목록은 우측 리스트. |
| **집필실** | 현재 작품 문서를 쓴다. 중앙 에디터 + 로컬 자동저장 + 얇은 우측 메모 panel. |
| **메모함** | 캡처한 메모를 모으고 작품에 붙인다. 최신순 리스트 + (전체/미연결) 필터. |
| **빠른 메모** | 떠오른 생각을 최소 마찰로 캡처한다. 본문만 적는 modal. |

## 우선순위 원칙 (디자인 판단이 갈릴 때)

1. **글쓰기 canvas > 보조 정보.** side panel이 에디터보다 시각적으로 강해지면 안 된다.
2. **조용함 > 표현력.** 강조 요소를 추가할지 고민되면 빼는 쪽을 default 로 한다.
3. **반복 사용의 안정감 > 첫인상.** 한 번 보고 예쁜 것보다 매일 봐도 피로 없는 쪽.
4. **blue 절약.** blue는 primary action + focus state 에만. 나머지는 회색/백색/잉크.
5. **종이 감각은 에디터 page 에만, 아주 약하게.** 다른 surface로 번지지 않는다.

## MVP 제외 (디자인하지 않는다)

원고지 모드 · 모바일 캡처 · 인증/OAuth · 서버 동기화 · PWA · 태그 · 이유 노트 · 등장인물 · 문서 본문 내 메모 pin · 세션 노트 · 검색 · export · AI · 전체 dark mode.

> 원고지 모드는 제품 핵심 기능이지만 첫 MVP를 빨리 사용 가능하게 만들기 위해 desktop Phase 2 이후로 미룬다.

## 상위 출처

- 설계 SoT: [`docs/superpowers/specs/2026-05-31-desktop-mvp-design.ko.md`](../../superpowers/specs/2026-05-31-desktop-mvp-design.ko.md)
- phase 지침: [`docs/phase/00-5-desktop-design-definition/README.md`](../../phase/00-5-desktop-design-definition/README.md)
