# 01 · 디자인 시스템 (Design Token)

> 구현자가 색/spacing/radius/typography/layout 을 임의로 정하지 않도록 고정한 token 표.
> 모든 값은 [`wireframes.html`](./wireframes.html) 의 `:root` 및 컴포넌트 스타일에서 실측한 값이다.
> 코드 구현 시 이 값들을 CSS 변수/테마 상수로 그대로 옮긴다.

## 1. Color token

### 1-1. Surface (배경 위계)

| token | 값 | 용도 |
|---|---|---|
| `--app-bg` | `#dfe5eb` | 앱 최외곽 배경 (window 바깥). |
| `--bg` | `#eef1f4` | app-body 기본 배경. |
| `--window` | `#f8fafc` | window 프레임 내부 배경. |
| `--panel` | `#ffffff` | 카드·패널·surface 기본 흰 배경. |
| `--panel-2` | `#f3f6f9` | 보조 패널 배경 (한 단계 가라앉은 면). |
| `--paper` | `#fffdfa` | **에디터 page 전용** 아주 약한 종이색. 다른 곳 사용 금지. |
| `--rail` | `#e4e9ef` | 좌측 narrow rail 배경. |
| `--titlebar` | `#fbfcfd` | 상단 타이틀바 배경. |

### 1-2. Line (경계)

| token | 값 | 용도 |
|---|---|---|
| `--line` | `#d8dee6` | 기본 경계선 (패널 구분, 카드 테두리, input). |
| `--line-soft` | `#e7ebf0` | 약한 경계선. |
| `--frame-border` | `#cfd7e2` | window 프레임 외곽선. |

### 1-3. Text (잉크)

| token | 값 | 용도 |
|---|---|---|
| `--ink` | `#1f2937` | 본문 기본 텍스트. primary 버튼 배경으로도 사용. |
| `--muted` | `#667085` | 보조 텍스트 (sub, 타이틀바 라벨). |
| `--faint` | `#98a2b3` | placeholder, empty 상태 안내. |
| `--heading-strong` | `#344054` | 카드 내 강조 제목 막대(목업의 mock 텍스트). |

### 1-4. Accent (blue — 액션·focus 전용)

| token | 값 | 용도 |
|---|---|---|
| `--accent` | `#3b82f6` | primary action / focus 강조의 기준 blue. |
| `--accent-strong` | `#1d4ed8` | 활성 rail 버튼 텍스트. |
| `--accent-soft` | `#dbeafe` | 활성 상태 배경 (rail active, 선택 카드 hint). |
| `--accent-border` | `#93c5fd` | 선택된 카드 테두리. |
| `--accent-bg-faint` | `#f8fbff` | 선택된 카드 배경(아주 옅은 blue tint). |

> **blue 사용 규칙:** 위 5개 외 blue 신설 금지. primary action(주 버튼)·focus state(선택/포커스)에만. 정보 표시·장식에 blue 쓰지 않는다.

### 1-5. Danger

| token | 값 | 용도 |
|---|---|---|
| `--danger` | `#d64545` | 에러/파괴적 액션. (MVP에서 최소 사용.) |

## 2. Typography

폰트는 **UI 전역(sans)** 과 **에디터 본문(serif)** 을 역할 분리한다. 글로벌 글쓰기 앱 공통 패턴(UI는 조용히 sans, 본문은 개성 있는 serif)을 따른다. 두 폰트 모두 한글 글리프를 직접 번들한다 — 시스템 fallback에만 의존하지 않는다(한국어 우선 전제).

### 2-1. UI 폰트 (전역) — Noto Sans KR

- **font-family:** `"Noto Sans KR", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
- 적용 범위: rail · titlebar · 패널 헤더 · 버튼 · input · 라벨 등 에디터 본문을 제외한 전부.
- 라이선스: SIL OFL 1.1 (앱 번들/임베딩 안전). 출처: [Google Fonts](https://fonts.google.com/noto/specimen/Noto+Sans+KR).
- 선정 근거: UI는 작은 크기로 종일 반복 노출 → 또렷함·중립성 우선. 본문 serif가 개성을 담당하므로 UI는 받쳐주는 역할.

### 2-2. 에디터 본문 폰트 — 리디바탕 (기본) + 사용자 변경 가능

- **기본 font-family:** `"RIDI Batang", serif` (family 이름 정확히 `RIDI Batang`)
- 적용 범위: 에디터 page(`.paper`) 본문 + 문서 제목.
- 라이선스: SIL OFL 1.1 (번들 안전). 출처: [리디](https://ridicorp.com/ridibatang/) · [눈누](https://noonnu.cc/font_page/324).
- **사용자 변경 가능 (방향 메모 — MVP 즉시 구현 아님):** 에디터 본문 폰트는 장기적으로 사용자가 설정에서 바꿀 수 있는 방향으로 간다(Notion·Obsidian·Craft의 본문 폰트 토글과 같은 방향). **단 첫 MVP에서는 기본값 리디바탕 고정으로 진행한다.** 폰트 변경 UI·설정 저장(`AppSetting`)은 지금 중요한 기능이 아니므로 후속 phase(집필실 이후)에서 검토한다. — 2026-06-01 사용자 결정.
  - 후속 번들 후보 메모(전부 OFL): 리디바탕 / 마루 부리 / Noto Serif KR / 고운바탕.
  - 설계 SoT MVP 범위 밖 항목이므로, 본 문서 메모로만 남기고 범위 편입은 후속 결정으로 미룬다.

### 2-3. 웹폰트 로드 (미리보기/개발 참고)

미리보기 검증에 쓴 CDN(실제 Electron 앱은 `app.asar` 번들 + subset 권장):
- Noto Sans KR: `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap`
- 리디바탕: `https://cdn.jsdelivr.net/gh/fonts-archive/RIDIBatang/RIDIBatang.css`

### 2-4. 크기/굵기

- 약어 없이: 모든 크기는 px 기준. 아래 표의 size/weight는 폰트와 무관하게 유지.

| 역할 | size | weight | 비고 |
|---|---|---|---|
| 페이지 H1 | 24px | 700 | 문서/목업 최상단 제목. |
| 화면 타이틀 (`.title`) | 18px | 700 | surface 헤더. |
| 보조 타이틀 (panel 헤더) | 15px | 700 | 작품 목록 / 연결된 메모 등. |
| 에디터 문서 제목 | 22px | 700 | paper 안의 h2. |
| 본문/intro | 14px | 400 | line-height 1.55. |
| 보조 설명 (`.sub`) | 12px | 400 | muted 색. |
| 버튼 라벨 | 12px | 650 | |
| 타이틀바 라벨 | 12px | 400 | muted 색. |
| rule 카드 | 13px | 400 | line-height 1.5. |

## 3. Spacing

| 영역 | 값 |
|---|---|
| body padding | 28px |
| 화면 grid gap | 22px |
| panel padding | 18px |
| workspace padding | 22px |
| memo-panel padding | 16px 14px |
| paper(에디터 page) padding | 42px 54px |
| input/card 내부 padding | 10~13px |
| 카드 간 간격 | 10px |

기본 리듬: **8px 계열** (8/10/14/18/22/28). 새 간격이 필요하면 이 계열 안에서 고른다.

## 4. Radius

| token | 값 | 용도 |
|---|---|---|
| `--radius` | `7px` | 기본 — surface, card, input, rail 버튼. |
| frame | `10px` | window 프레임 / modal. |
| paper | `8px` | 에디터 page. |
| button | `6px` | 버튼. |

## 5. Shadow

| token | 값 | 용도 |
|---|---|---|
| `--shadow` | `0 18px 40px rgba(15,23,42,.10)` | window 프레임. |
| paper shadow | `0 16px 38px rgba(15,23,42,.08)` | 에디터 page. |
| modal shadow | `0 26px 70px rgba(15,23,42,.22)` | 빠른 메모 modal. |

그림자는 위 3개만. 강조용 색 그림자·glow 금지.

## 6. Layout grid (화면별 컬럼)

좌측 **rail = 64px 고정**. 모든 화면 공통.

| 화면 | grid-template-columns |
|---|---|
| 작품 | `64px 1fr 250px` (rail / 새 작품 main / 작품 목록) |
| 집필실 | `64px 1fr 260px` (rail / 에디터 / 연결된 메모) |
| 메모함 | `64px 1fr` (rail / 메모 리스트) |
| 빠른 메모 | modal overlay (`width: 430px`) on `rgba(15,23,42,.22)` backdrop |

- 에디터 page(`.paper`)는 `max-width: 660px`, 중앙 정렬(`margin: 0 auto`).
- 새 작품 블럭은 `max-width: 560px`, 중앙 정렬.

## 7. Component token

### 버튼

| 종류 | 배경 | 텍스트 | 높이 | radius |
|---|---|---|---|---|
| primary | `--ink` (#1f2937) | #fff | 30px | 6px |
| secondary | `#edf2f7` | `--ink` | 30px | 6px |

padding `0 11px`, font 12px/650.

### Input / Textarea

- input: height 34px, border `--line`, bg #fff, radius 6px, padding `0 10px`, placeholder `--faint`.
- textarea: height 130px, border `--line`, bg #fff, radius 7px, padding 12px, line-height 1.5.

### Rail 버튼

- 32px 정사각, radius 7px, 중앙 정렬, font 13px/700.
- 기본: 텍스트 `#64748b`, 배경 transparent.
- active: 텍스트 `--accent-strong`(#1d4ed8), 배경 `--accent-soft`(#dbeafe).

### Card

- project-card / memo-card: 배경 `--panel`, border `--line`, radius 7px, padding 11~13px, margin-bottom 10px.
- 선택 카드: border `--accent-border`, 배경 `--accent-bg-faint`.
- empty 카드: `border-style: dashed`, 텍스트 `--faint`, 중앙 정렬.

### Titlebar

- height 38px, 배경 `--titlebar`, 하단 border `--line`.
- 좌측 신호등 dots(8px 원 × 3, `#b8c1cc`) / 중앙 화면명 / 우측 상태·단축키 라벨.

### 세그먼트 토글 (Segmented control)

메모함 필터(`[전체 | 미연결]`)에 사용. 본문 헤더 제목 행 아래 배치.

- 컨테이너: 배경 `--panel-2`, border `--line`, radius 8px, padding 3px, `display: inline-flex`.
- 항목(`.seg`): font 12px/600, 기본 텍스트 `--muted`, padding `5px 14px`, radius 6px.
- 활성(`.seg.active`): 배경 #fff, 텍스트 `--accent-strong`(#1d4ed8), `box-shadow: 0 1px 2px rgba(15,23,42,.08)`.
- titlebar 우측에는 필터 대신 "메모 N개" 같은 개수·상태 표시.
