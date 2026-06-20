# 최초 사용자 온보딩 가이드 투어 — 설계

- 작성일: 2026-06-20
- 상태: 설계 합의 완료 (구현 계획 대기)
- 범위: 프론트엔드(주) + 백엔드 1줄

## 1. 목적

최초 로그인(가입) 사용자가 홈(`/`)에 도착했을 때, 소설빙의 핵심 기능 4가지를
스포트라이트 가이드 투어로 **1회** 안내한다. 이미 본 사용자에게는 다시 노출하지 않는다.

소설빙의 본질(작품 집필 + 곁쪽지로 컨텍스트 영속)을 첫 화면에서 한 바퀴 보여주어,
"무엇부터 해야 할지" 모르는 신규 사용자의 이탈을 줄인다.

## 2. 라이브러리

`driver.js` 채택.

- 바닐라 JS(프레임워크 무관, DOM 직접 제어) — React 19 / Next 16 렌더 사이클과 충돌 없음
- 의존성 0, 경량, 스포트라이트(딤 + 대상 강조) + 팝오버 기본 제공
- client component 에서만 동적 import 하여 SSR 회피

대안 검토: react-joyride(단계 관리 풍부하나 무거움), Shepherd/intro.js(기능 과다). 본 범위엔 driver.js 가 최적.

## 3. 트리거 & 영속

- 홈(`/`) 진입 시 `GET /api/settings` 의 `onboardingCompleted` 값을 확인한다.
- 미저장(= 미완료)이면 투어를 자동 시작한다.
- 투어 완료 또는 건너뛰기 시 `PUT /api/settings { settings: { onboardingCompleted: "true" } }` 로 저장 → 이후 재노출하지 않는다.
- 서버 `user_settings`(사용자별 key-value 설정 테이블) 영속이라 기기·브라우저가 바뀌어도 1회만 노출된다.

## 4. 투어 단계 (홈 단일 화면)

상단 글로벌 네비가 모든 화면에 고정이므로, **페이지 이동 없이 홈 한 화면에서** 4단계를 순회한다.
(여러 화면을 넘나드는 투어는 라우팅·요소 로딩 타이밍이 얽혀 깨지기 쉬워 배제)

| # | 가리킬 요소 | `data-tour` | 설명 문구(예시) |
|---|---|---|---|
| 1 | 홈 "새 작품" 버튼 | `new-work` | 여기서 첫 작품을 시작해요 |
| 2 | 네비 "메모" | `nav-memos` | 떠오른 아이디어를 곁쪽지로 남겨요 |
| 3 | 네비 "인물" | `nav-characters` | 등장인물을 한곳에 정리해요 |
| 4 | 네비 "집필" | `nav-write` | 작품으로 들어가 이어 써요 |

- 각 대상 요소에 `data-tour="..."` 표식을 부착한다(기능·스타일 무영향, driver.js 가 이 선택자로 대상 지정).
- 각 단계에 "건너뛰기"(투어 종료 + 완료 저장), 마지막 단계에 "시작하기" 버튼.

## 5. 백엔드 변경 (최소)

`SettingsService` 의 `ALLOWED` 허용 키 맵에 한 줄 추가:

```kotlin
"onboardingCompleted" to setOf("true"),
```

- 스키마 변경 0, 마이그레이션 0 (key-value 테이블 재사용).
- 값은 `"true"` 만 허용. 미저장 = 미완료로 간주.

## 6. 프론트 구성

- `OnboardingTour` (client component) — 홈 페이지에 마운트.
  - `useSettings` 훅으로 `onboardingCompleted` 를 읽고, 미완료면 driver.js 투어를 시작한다.
  - 완료/건너뛰기 시 settings mutation 으로 `onboardingCompleted: "true"` 저장.
- 대상 4곳에 `data-tour` 속성 추가:
  - 홈 "새 작품" 버튼 (`src/app/(main)/page.tsx`)
  - 네비 메모/인물/집필 (`src/app/(main)/layout.tsx`)
- driver.js 는 동적 import.

각 단위의 책임:
- `OnboardingTour`: "언제 투어를 시작/종료하고 완료를 저장하는가"만 담당. driver.js 인스턴스 생성·단계 정의·실행을 감싼다.
- 대상 컴포넌트: `data-tour` 표식만 노출. 투어 로직을 알지 못한다(결합 최소).

## 7. 엣지 / 에러 처리

- `GET /api/settings` 실패 → 투어를 표시하지 않는다(조용히 격하, 핵심 흐름 차단 금지).
- 대상 요소가 DOM 에 없으면 해당 단계를 방어적으로 skip(작품 0개 empty state 든 아니든 "새 작품" 버튼과 네비는 항상 존재하므로 정상 경로에선 발생하지 않음).
- 저장 mutation 실패 → 사용자 경험 차단하지 않음(다음 진입에서 다시 시도될 수 있음). 로깅만.

## 8. 테스트

- 백엔드: `SettingsService` 가 `onboardingCompleted` 키를 허용하고, 잘못된 값(`"false"` 등 집합 외)을 거부하는지(기존 settings 테스트 패턴 재사용).
- 프론트: `OnboardingTour` 행위 단위
  - `onboardingCompleted` 미완료 → 투어 시작 트리거 호출
  - 완료 상태 → 투어 미시작
  - 건너뛰기/완료 → settings mutation(`onboardingCompleted: "true"`) 호출
  - driver.js DOM 자체는 시스템 경계로 mock.

## 9. 범위 밖 (v1 제외, YAGNI)

- 설정 화면의 "가이드 다시 보기" 버튼 — key-value 인프라가 있어 나중에 한 줄로 추가 가능. v1 미포함.
- 화면별 맥락 도움말 / 여러 화면 투어 — 단일 화면 미니 투어로 한정.
