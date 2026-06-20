# Design — 소설비 (Soseolbi) Desktop

> 비주얼 시스템 SoT (어떻게 보이는가). 전략(누가/무엇을/왜)은 루트 [`PRODUCT.md`](../PRODUCT.md).
> 충돌 시 PRODUCT.md의 원칙이 상위. 본 문서는 그 원칙을 색·타이포·모션·컴포넌트로 구체화한다.

**Register:** product · **Target:** desktop (Electron) · **Date:** 2026-06-01
**Direction:** 따뜻한 문학 작업실 — iA Writer의 *순도* + Scrivener의 *완결성*, 회색 와이어프레임이 아닌 종이·활자의 마감.
**References:** iA Writer (글쓰기 surface 순도) · Scrivener (작가 작업실 완결성 — 단 복잡함이 아닌 절제로)
**Anti-references:** Notion형 만능 워크스페이스 · Google Docs형 사무 편집기 · cream/beige 감성 slop · 카드 그득한 SaaS 대시보드

> 작성 메모: 환경 제약으로 impeccable의 Stitch DESIGN.md 템플릿 원본(`reference/document.md`)을 이 세션에서 읽지 못해(OS 레벨 read 거부), 표준 비주얼-시스템 구조로 작성했다. 색 토큰은 라이트/다크 양쪽 사용자 검토(`docs/design/font-specimen.html`)를 거친 값이다.

---

## 1. Direction & Mood

두 레이어의 **온도 대비**가 정체성이다.

- **쓰는 surface(에디터 page)는 순도** — 도구가 물러나고 본문만 남는다. 종이 한 장의 따뜻한 off-white.
- **그를 감싼 작업실(앱 배경)은 평평한 양피지 톤** — 종이가 그 위에 한 단계 밝게 "떠 있는 한 장"으로 읽히게. 나무결·텍스처 없이 톤 대비 + 그림자로만 분리한다 (Soseolbi 시안 = '디지털 안식처', cream-slop 회피는 톤 위계로).
- **accent는 깊은 잉크블루(쿨)** — 따뜻한 종이(웜)와의 온도 대비가 절제된 자신감을 만든다. blue는 **액션 + 포커스에만**.

처음 열었을 때 dashboard나 랜딩이 아니라 *조용한 글쓰기 작업실*. 매일 열어도 피로 없는 안정감이 첫인상보다 우선.

## 2. Color (OKLCH)

모든 색은 OKLCH. 라이트 = 평평한 양피지, 다크 = 촛불 아래 원고. 구현은 CSS custom property로 그대로 옮긴다. 앱 배경(`--bg`)은 **평평한 양피지** — 텍스처 없이 종이(`--paper`)보다 한 단계 어둡게 두어 종이가 떠 보이게 한다. **실시간 값 SoT = `desktop/src/styles/app.css`** (아래 값은 결정본 갱신 시점 스냅샷).

### 2-1. Light (평평한 양피지)

```css
:root {
  /* surface — 작업실(양피지·살짝 깊음) → 패널 → 종이(밝음) 위계 */
  --bg:             oklch(0.945 0.006 85);   /* 앱 배경 = 평평한 양피지 */
  --surface:        oklch(0.962 0.006 85);   /* 패널·카드·rail (바닥 위 올라온 면) */
  --surface-sunken: oklch(0.930 0.006 84);   /* 가라앉은 보조면 */
  --paper:          oklch(0.996 0.001 85);   /* 에디터 page 전용 — 배경 위로 떠 있는 한 장 */
  --paper-edge:     oklch(0.912 0.006 82);

  /* ink */
  --ink:        oklch(0.280 0.018 60);   /* 본문 — 웜 near-black, 순흑 아님 */
  --ink-soft:   oklch(0.400 0.016 62);   /* 제목 보조·강조 */
  --muted:      oklch(0.520 0.018 68);   /* 보조 텍스트 (메타·라벨) */
  --faint:      oklch(0.640 0.014 72);   /* placeholder·empty 안내 (본문 텍스트로 쓰지 말 것) */

  /* line */
  --hairline:        oklch(0.840 0.012 76);
  --hairline-strong: oklch(0.780 0.014 74);

  /* accent — 깊은 잉크블루 (액션 + 포커스 전용) */
  --accent:       oklch(0.470 0.125 252);
  --accent-hover: oklch(0.430 0.130 252);
  --accent-soft:  oklch(0.930 0.040 252);  /* focus ring·선택 카드 배경 */
  --accent-ink:   oklch(0.420 0.130 252);  /* 링크 텍스트 */
  --on-accent:    oklch(0.990 0.005 250);  /* accent 위 텍스트 */

  /* danger (최소 사용) */
  --danger:      oklch(0.550 0.160 25);
  --danger-soft: oklch(0.930 0.040 25);
}
```

### 2-2. Dark (촛불 아래 원고)

```css
[data-theme="dark"] {
  --bg:             oklch(0.220 0.010 68);   /* 앱 배경 = 평평한 짙은 양피지 */
  --surface:        oklch(0.262 0.012 64);
  --surface-sunken: oklch(0.232 0.010 62);
  --paper:          oklch(0.288 0.014 66);   /* warm dark — 배경 위로 떠 있는 종이 */
  --paper-edge:     oklch(0.350 0.016 66);

  --ink:        oklch(0.900 0.012 82);   /* 순백 아님 */
  --ink-soft:   oklch(0.800 0.014 80);
  --muted:      oklch(0.680 0.016 76);
  --faint:      oklch(0.550 0.014 72);

  --hairline:        oklch(0.360 0.016 66);
  --hairline-strong: oklch(0.420 0.018 66);

  --accent:       oklch(0.740 0.115 248);  /* 다크 배경 대비 위해 밝게 */
  --accent-hover: oklch(0.780 0.120 248);
  --accent-soft:  oklch(0.340 0.060 250);
  --accent-ink:   oklch(0.800 0.120 248);
  --on-accent:    oklch(0.200 0.020 250);

  --danger:      oklch(0.700 0.150 25);
  --danger-soft: oklch(0.320 0.060 25);
}
```

### 2-3. 사용 규칙 (HARD)

- **종이색(`--paper`)은 에디터 page 에만.** 패널·카드·배경으로 번지면 cream-slop이 된다.
- **blue 신설 금지.** 위 accent 5개 외 새 blue 금지. primary action(주 버튼) + focus state(포커스/선택)에만. 정보 표시·아이콘·장식에 blue 쓰지 않는다.
- **gradient·glow·색 그림자·배경 텍스처 금지.** 그림자는 §5의 3종만. 앱 배경(`--bg`)은 평평한 단색 양피지 — 나무결/노이즈/vignette 없이 종이와의 톤 위계 + 그림자로만 분리한다(Soseolbi 결정본, cream-slop 회피는 톤 위계로, 구현 `desktop/src/styles/app.css`).
- **순흑/순백 금지.** 텍스트·배경 모두 웜 틴트가 들어간 ink/paper 사용.
- **대비:** 본문 `--ink`/`--ink-soft`만 (≥4.5:1 보장). `--muted`는 보조 텍스트(메타·라벨)까지만, `--faint`는 placeholder·비활성 안내 전용 — 본문에 쓰지 않는다.

## 3. Typography

폰트 2종 — UI(sans) / 본문(serif) 역할 분리. 두 종 모두 한글 글리프 직접 번들.

| 역할 | family | 비고 |
|---|---|---|
| **본문·문서 제목 (serif)** | **고운바탕 `Gowun Batang`** | 에디터 page 본문 + paper 내 제목. OFL. 사용자 결정 2026-06-01. |
| **UI 전역 (sans)** | **`Noto Sans KR`** | rail·titlebar·패널 헤더·버튼·input·라벨 등 본문 외 전부. OFL. |

### 3-1. 스케일 (px)

| 토큰 | size | weight | line-height | family | 용도 |
|---|---|---|---|---|---|
| `prose` | 18 | 400 | 1.92 | serif | 에디터 본문 (한국어 산문) |
| `doc-title` | 27 | 700 | 1.35 | serif | paper 안 문서 제목 (`text-wrap: balance`) |
| `screen-h1` | 22 | 700 | 1.3 | sans | 화면 제목 |
| `panel-title` | 15 | 700 | 1.35 | sans | 패널 헤더 (연결된 메모 등) |
| `ui-body` | 14 | 400 | 1.55 | sans | UI 본문·입력값 |
| `label` | 13 | 500 | 1.4 | sans | 라벨·세그먼트 |
| `button` | 13 | 600 | 1 | sans | 버튼 라벨 |
| `meta` | 12 | 400 | 1.5 | sans | 메타·저장 상태 (muted) |
| `caption` | 11.5 | 400 | 1.4 | sans | 캡션·faint 안내 |

- 단계 간 대비 ≥1.25 유지. letter-spacing: 큰 제목 `-0.01em`, 본문 기본(미세 `+0.002em` 허용), display floor `-0.04em`(현재 미해당).
- 한국어 본문 줄길이 ≤ **34em**(약 30~40자). 그 이상 늘리지 않는다.
- 본문 산문은 `text-wrap: pretty`, 제목 h1~h3는 `text-wrap: balance`.
- weight 사다리: 400 / 500 / 700 (serif는 400/700).

### 3-2. 폰트 로드

미리보기/개발 CDN (검증됨 2026-06-01):
- `Gowun Batang`·`Noto Sans KR`·`Noto Serif KR`: Google Fonts `css2`.
- (대안 비교용) `RIDI Batang`: `https://cdn.jsdelivr.net/gh/fonts-archive/RIDIBatang/RIDIBatang.css` · `Maru Buri`: `https://cdn.jsdelivr.net/gh/fonts-archive/MaruBuri/MaruBuri.css`.

**Electron 프로덕션은 CDN 의존 금지** — woff2 subset을 `app.asar`에 번들. 한글 subset 미지원 메타데이터 함정 주의(이전 회귀: `next/font`의 `subsets:['korean']` 미지원). fallback chain: `'Gowun Batang', 'Apple SD Gothic Neo', serif`.

## 4. Spacing & Layout

- **리듬: 8px 계열** — 4 / 8 / 12 / 16 / 22 / 28 / 40 / 54. 새 간격은 이 계열에서.
- 에디터 paper: **A4 규격** `max-width 210mm` × `min-height 297mm`, 중앙 정렬, 여백 `25mm`(본문 줄길이 ≈33em, ≤34em 유지). titlebar 우측에 작업공간 **줌**(− % +).
- 패널 padding `16~18px`, 카드 내부 `12~14px`, 카드 간 `10~12px`.
- **paper-on-desk 원칙:** 종이(밝음)가 작업실 배경(깊음) 위에 그림자로 떠 있어 한 장의 종이로 읽힌다.
- 사이드 패널은 에디터보다 **시각적으로 약하게** — `--surface` 배경 + 좌측 hairline 분리, 폭은 보조(에디터가 주인공, HARD).
- Flexbox 1D / Grid 2D. 무브레이크포인트 그리드는 `repeat(auto-fit, minmax(280px, 1fr))`.
- z-index 시맨틱 스케일: dropdown(100) → sticky(200) → modal-backdrop(300) → modal(310) → toast(400) → tooltip(500).

## 5. Radius & Elevation

```css
--radius-sm: 8px;    /* 버튼·input·칩 */
--radius:    12px;   /* 카드·패널 */
--radius-lg: 16px;   /* 에디터 paper·modal */
--radius-pill: 999px;
```

그림자 3종 (웜·소프트·저강도, 색 그림자 없음):
```css
--shadow-panel: 0 1px 2px -1px oklch(0.30 0.03 60 / .20), 0 8px 24px -16px oklch(0.30 0.03 60 / .30);
--shadow-paper: 0 1px 0 var(--paper-edge), 0 22px 48px -28px oklch(0.30 0.03 60 / .55);
--shadow-modal: 0 30px 70px -30px oklch(0.20 0.02 60 / .55);
```
다크에서는 drop 부분 alpha를 약간 키우고 highlight(`0 1px 0 paper-edge`)는 유지.

## 6. Motion (절제된 craft · Things류)

| 토큰 | 값 | 용도 |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.2, 0.7, 0.2, 1)` | 진입·전환 기본 (ease-out-quint 류) |
| `--ease-soft` | `cubic-bezier(0.4, 0, 0.2, 1)` | 테마·색 전환 |
| dur-micro | 120ms | active press, hover |
| dur-base | 200ms | focus ring, 카드 hover |
| dur-enter | 320ms | 화면/카드 진입, stagger |

- **press:** 인터랙티브 요소 `transform: scale(0.97)` 120ms.
- **hover:** 카드/종이 `translateY(-2px)` 240ms.
- **진입:** opacity 0→1 + translateY 10px→0, 리스트는 stagger(50ms 간격). *기본 상태가 보이는 값* — 진입은 enhancement (visibility를 transition에 걸지 않는다).
- **저장 상태:** titlebar 라벨 텍스트 크로스페이드. spinner 남발 금지 (로컬 저장은 대부분 즉시).
- **재료:** transform/opacity 중심. backdrop blur는 modal dim 1곳만 (장식용 glassmorphism 금지). bounce/elastic 금지 — ease-out만.
- **reduced-motion(필수):** `@media (prefers-reduced-motion: reduce)` 에서 모든 transform/opacity transition → 즉시 전환 또는 크로스페이드. hover lift 제거. 진입 애니메이션 off.

## 7. Components

모든 사용자 노출 라벨은 **한글**(코드 식별자·CSS 클래스 예외).

### 버튼
- **primary:** bg `--accent`, text `--on-accent`, radius `--radius-sm`, padding `9px 15px`, weight 600. hover `--accent-hover`, press scale .97.
- **secondary:** bg `--surface`, text `--ink`, border `--hairline`. hover border `--accent`.
- **ghost:** 투명, text `--ink-soft`, hover bg `--surface`.

### Input / Textarea
- bg `--paper`(에디터 맥락) 또는 `--surface`(패널 맥락), border `--hairline`, radius `--radius-sm`, text `--ink`, placeholder `--faint`.
- **focus:** border `--accent` + ring `0 0 0 3px var(--accent-soft)`. (blue 허용 두 자리 중 하나.)

### 에디터 page (paper)
- bg `--paper`, radius `--radius-lg`, shadow `--shadow-paper`, **A4(210×297mm)**, 중앙. 본문 `prose`(고운바탕, 좌우 25mm 여백 안에서 꽉 — ≈33em). chrome 최소 — 커서만으로 충분. titlebar 우측에 작업공간 줌.

### 페이지 뷰 (결정 2026-06-02)
- 본문이 길어지면 **단일 페이지 + 좌우 ◀▶ 버튼**으로 한 장씩 넘기는 방식(키보드 ←→ 병행, 하단 `n/N` 인디케이터). 정적 목업 `docs/design/desktop/page-view.html` 로 확정(세로 연속 분할 모드도 토글로 병기).
- **실제 TipTap 자동 페이지 분할 구현은 별도 spec/Phase.** PoC 결과(`tiptap-pagination-plus`): 세로 자동분할은 동작하나 종이 렌더 불안정 + 좌우 캐러셀/단일버튼은 "페이지별 텍스트 분리 엔진"을 자체 구현해야 함 + 한국어 IME 회귀 검증(PoC 0-1 4케이스) 선행 필요. 현 desktop 앱은 **연속 A4** 유지.

### 본문 서식 — BubbleMenu (텍스트 선택 시)
- 서식 도구는 영구 툴바가 아니라 **텍스트 선택 시에만 뜨는 BubbleMenu** 로 제공한다(순도 컨셉 — 평소엔 숨음). **글꼴·글자 크기 변경 도구는 두지 않는다** — 본문은 고운바탕 18px 고정(워드/구글독스식 폰트 선택 회피, anti-reference 정합).
- 구성: **굵게 · 기울임 · 제목 · 인용 · 목록** (StarterKit 마크 기준). 인라인 서식(굵게/기울임)과 블록 서식(제목/인용/목록) 사이에 1px divider.
- 컨테이너: bg `--surface`, border `1px --hairline`, radius `--radius-sm`, `--shadow-panel`, padding 4px. 버튼 30×30 ghost, hover `--surface-sunken`, **active = `--accent-ink` + `--accent-soft`**(blue 허용 자리).
- 본문 마크업 위계: h1 24px / h2 21px(고운바탕 700), blockquote 는 1px `--hairline-strong` 좌선 + `--ink-soft`(side-stripe 금지 회피 위해 1px 한정). 글꼴은 본문과 동일(고운바탕) — 위계는 크기·weight 로만.
- 결정: 2026-06-01 사용자 확정. 구현 기준 `desktop/src/components/Editor.tsx` (`@tiptap/react/menus` BubbleMenu).

### 사이드 패널 (연결된 메모·참조)
- bg `--surface`, 좌측 `1px var(--hairline)` 분리. 에디터보다 약하게(HARD). 헤더 `panel-title` + 보조 sub.

### Card (메모·작품)
- bg `--surface`, border `--hairline`, radius `--radius`, padding 12~14, shadow `--shadow-panel`(아주 약하게 또는 무).
- **선택/활성:** border `--accent` 계열 + bg `--accent-soft`(아주 옅게).
- **empty:** `border: 1px dashed var(--hairline-strong)`, text `--faint`, 중앙 — 조용한 한 줄.
- 카드 중첩 금지. 같은 카드 무한 반복(SaaS 그리드) 금지.

### Chrome (titlebar / rail)
- macOS-native에 가까운 조용한 외관. titlebar bg `--surface`, 하단 hairline. 좌측 신호등 dots, 중앙 화면명(muted), 우측 상태 라벨(저장됨·글자수 등 — muted, 조용히).
- rail(화면 전환): 활성만 `--accent` 텍스트 + `--accent-soft` 배경. 비활성 `--muted`.

### 세그먼트 토글 / 연결 칩 / 링크
- 세그먼트: 컨테이너 `--surface-sunken`, 활성 항목 bg `--paper`/`--surface` + text `--accent-ink` + 미세 그림자.
- 연결 칩: secondary 버튼 모양, 작품명 또는 "미연결".
- 링크: text `--accent-ink`, 밑줄은 `color-mix`로 옅게.

### Modal (빠른 메모 등)
- backdrop: `--bg` 계열 dim(alpha ~.4) + 약한 blur. modal: bg `--surface`, radius `--radius-lg`, shadow `--shadow-modal`. Esc 닫기. 입력 소실 금지.

### Skeleton (loading)
- 정적 `--surface-sunken` 톤 막대. **blue 미사용.** 펄스 최소(없어도 됨).

### 금지 (match-and-refuse)
- side-stripe border(1px 초과 색 좌/우 보더) · gradient text · 장식 glassmorphism · hero-metric 템플릿 · 동일 카드 그리드 · 섹션마다 작은 대문자 eyebrow · 01/02/03 넘버 스캐폴딩 · 컨테이너 밖으로 넘치는 텍스트.

## 8. Screen States

| 상태 | 원칙 | 표현 |
|---|---|---|
| **empty** | 조용하게 | dashed 카드 + 한 줄 안내(`--faint`). 큰 일러스트 금지. |
| **loading** | spinner 남발 금지 | `--surface-sunken` skeleton. 로컬은 대부분 즉시. |
| **error** | 현재 위치에서 짧게 | `--danger` 한 줄 + 재시도 동선. 입력 소실 금지. 전역 toast 폭주 금지. |
| **saving** | titlebar 라벨로 조용히 | `저장됨 · 1,248자`(muted) / `저장 중…` / `저장 실패`(danger). "저장됨"은 blue 아님(정상 상태는 강조 X). |
| **focus** | blue 허용 자리 | input ring(accent-soft) · 선택 카드(accent border) · 활성 rail. 에디터는 커서만. |

## 9. Accessibility

- **WCAG 2.1 AA.** 본문 ≥4.5:1, 큰 텍스트 ≥3:1, placeholder 동일. 종이 위 세리프 본문이 흐려지지 않게 `--ink` 사용.
- **reduced-motion 대체 의무** (§6).
- **한국어 우선** — IME 조합 안정성(TipTap 회귀 케이스 재사용), 고운바탕 + fallback chain 가독성 양쪽 테마 검증.
- 라이트/다크 전 화면 일관. 색맹 대비: 상태를 색에만 의존하지 않고 라벨/아이콘 병행.
- 포커스 가시성: 키보드 동선에서 `--accent` ring 항상 또렷하게.

## 10. 다음 단계

본 DESIGN.md를 근거로 `/impeccable craft 집필실`(에디터 = 제품 주인공) 또는 `/impeccable shape <화면>` 진행. 구현 시 §2 토큰을 CSS custom property로 그대로 이식하고, §7 컴포넌트·§8 상태·§9 접근성 체크리스트를 PR 게이트로 둔다.

> 경로 메모: 루트 `DESIGN.web-legacy.md`(예정 — 환경 회복 시 `DESIGN.md`에서 리네임)는 보류된 web 트랙 기록. 본 `docs/DESIGN.md`가 desktop 활성 디자인 SoT.
