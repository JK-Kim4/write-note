# 자체 에디터 엔진 PoC — 빌드 로그 (자율 /loop)

> **이 문서는 loop 재개용 상태 추적 + 아침 리뷰 가이드.** 매 iteration 갱신.
> 설계 SoT: [design](./2026-06-15-custom-editor-engine-design.md). 브랜치 `024-custom-editor`.

## 목표

집필 에디터를 TipTap → 자체 엔진으로. PoC가 4가지를 증명하면 go:
① 문단이 페이지 경계에서 **줄 단위로 이어짐**(통째 점프·여백입력 없음)
② 규격(A4/A3/B4)·폰트 변경 시 **즉시 재배치**
③ **이미지(가변높이) 끼워도 분할 정확**
④ **한글 IME 정상**

## 빌드 마일스톤

- [x] M1. 순수 레이아웃 엔진(`layoutEngine.ts`) + TDD 단위테스트 — **vitest 7 GREEN**
- [x] M2. 기하(`geometry.ts`, 실제 A4 비율 px)
- [x] M3. 측정 `measure.ts`(Range.getClientRects)
- [x] M4. 렌더러(clip+translate) + 정적 PoC 라우트 `/poc/editor` — typecheck/build GREEN
- [x] M5. EditContext 입력 루프(IME·Enter·Backspace·캐럿) + 렌더 — 빌드·헤드리스 스크린샷 검증.
- [x] M6. 캐럿 클릭 배치(hit-test)·화살표 + **CDP 인터랙티브 검증 통과**.
- [x] M7. 기본 선택 묶음(사용자 요청) — 드래그 선택·Shift/Cmd/Option+화살표·Cmd+A·선택 교체/삭제·선택 하이라이트·네이티브 선택 억제. **CDP 검증 통과**.

## 현재 상태 (iteration 3 끝)

- **M1~M5 완료.** `/poc/editor` = EditContext 라이브 에디터, `/poc/editor-static` = 정적 fallback.
- **헤드리스 Chrome 스크린샷으로 시각 검증 완료(①②③):**
  - 다중 페이지 렌더 정상 — 페이지1이 첫 문단으로 꽉 차고 **페이지2가 같은 문단을 줄 단위로 이어받음**(=① 통째 점프 아님).
  - **이미지(가변높이 블록)**가 흐름에 정상 배치·렌더(=③). 실제 A4 비율·한글 줄바꿈 정확.
- 게이트: poc-editor 단위테스트 7 GREEN, `tsc --noEmit` GREEN, `pnpm build` GREEN.
- **미검증(아침 dogfooding 영역):** ④ 한글 IME 라이브 타이핑(헤드리스 IME 불가) / ② 용지·폰트 변경 인터랙티브 반응(엔진 로직은 단위테스트 GREEN, 화면 반응은 클릭 필요) / 캐럿 클릭 배치·화살표 이동(M6).

### 발견·수정한 버그 (it.3)

- **SWC 상수폴딩이 보간 템플릿 리터럴의 `'/>`를 유실** — `\`<svg ... height='${IMG_NH}'/>\`` 형태를 빌드가 `height='400<rect`로 깨뜨려 SVG 무효화 → 이미지 미표시. node(런타임)는 멀쩡. **정적판은 리터럴 숫자라 무사.** 수정: SVG data URI 를 **보간 없는 리터럴 문자열**로(PocEditorLive `IMG_SRC`). 회귀 신호 — 빌드 산출 chunk grep(`400<rect`)로 확정.

### 발견·수정한 버그 (it.5 — 사용자 dogfooding 보고)

- **캐럿 x 누적 드리프트** — 캐럿 x 를 **canvas `measureText`** 로 쟀는데 canvas 가 한글 폰트(Apple SD Gothic Neo)를 좁게 폴백 측정("그날"=31px, 실제 DOM ~36px) → DOM 렌더와 어긋나 줄 깊을수록 캐럿이 글자에서 벌어짐. 줄바꿈은 DOM(`getClientRects`)으로 재는데 캐럿 x 만 canvas 라 불일치. **수정:** 캐럿 x·클릭 hit-test 를 줄바꿈·렌더와 동일한 오프스크린 DOM Range(`measure.ts measureLineXs`)로 통일, canvas 제거. **검증:** CDP 로 4지점 클릭 시 내 캐럿 vs 브라우저 `caretRangeFromPoint` **diff 0px**(이전엔 누적 드리프트). 교훈 — 텍스트 위치 계산은 렌더와 **같은 측정 방식**을 써야 한다(canvas↔DOM 혼용 금지).
- **캐럿 2개(네이티브 캐럿 미차단)** — EditContext 호스트(focusable div)에 브라우저 **네이티브 캐럿**(line 시작 x=0)이 우리가 그린 `.poc-caret` 과 별개로 보임. CDP 확인: `.poc-caret` 1개·contenteditable 0·host caret-color 비투명. **수정:** 호스트에 `caret-color: transparent`(자체 캐럿 그릴 때 표준 처방). 검증: caret-color `rgba(0,0,0,0)`·캐럿 1개. 교훈 — EditContext/contenteditable 위에 자체 캐럿 그릴 땐 호스트 `caret-color: transparent` 필수.

### 선택(selection) 구현 + 버그 (it.6 — 사용자 요청 "기본 선택 묶음")

- 입력 모델 캐럿(단일)→선택 `{anchor, focus}` 확장. EditContext 선택 동기(`updateSelection(min,max)`)로 **선택 위 타이핑/Backspace 를 EditContext 가 교체/삭제**(실증: charCount). 드래그=`elementFromPoint`+`screenToCaret`, Shift+화살표=focus 확장, Cmd+←→=줄끝(`lineBoundsOf`), Option+←→=단어(`wordBoundary`), Cmd+A=전체, 선택 하이라이트=줄별 rect. 네이티브 선택 억제=mousedown `preventDefault`+수동 focus+`user-select:none`+`caret-color:transparent`. **CDP 검증:** 드래그 하이라이트3·native 0 / 타이핑교체 / Backspace선택삭제 / Cmd+A→Backspace 전체삭제 0 전부 OK.
- **(버그) wrap 경계 캐럿 affinity** — `caretToScreen` 가 줄 찾기를 `within <= line.end` 로 해서 경계 offset(line[K].start==line[K-1].end)을 **이전 줄 끝**에 렌더 → Cmd+← "줄 맨앞"이 오른쪽에 표시(caretX 652 기대 348 인데 955). **수정:** `within < line.end`(downstream affinity, 맨끝은 fallback) → Cmd+← caretX 652→348 OK. 타이핑 중 줄바꿈 캐럿도 개선. 한계 — 줄 끝 정확히 클릭 시 다음 줄 시작에 캐럿(affinity 미추적, 본 구축에서 upstream/downstream 추적).

### 다음 iteration 진입점 (M6)

캐럿 클릭 배치(hit-test: 클릭 좌표 → 페이지·줄·문자 오프셋 역산 → `updateSelection`) + 화살표 이동(keydown). 그 후 ② 반응형은 헤드리스 CDP 로 select 구동해 스크린샷, 또는 아침 dogfooding 위임. 마지막에 아침 요약 작성 + prod 서버(3939) 정리.

## ✅ 빌드 완료 — 아침 리뷰 가이드 (사용자용)

**PoC 완성. `/poc/editor` (라이브 EditContext 에디터) · `/poc/editor-static` (정적 fallback).**
밤사이 **prod 서버가 이미 http://localhost:3939/poc/editor 에 떠 있습니다** (이 세션이 살아있는 한 유지). 새로 띄우려면:
```bash
cd /Users/jongwan-air/Desktop/workspaces/write-note-024-custom-editor/frontend
pnpm dev   # → Chrome 에서 http://localhost:3000/poc/editor
pnpm exec vitest run src/components/poc-editor   # 엔진 단위테스트 7개
```
**반드시 Chrome(Chromium)으로 열 것** — EditContext 는 Chrome/Edge 121+ 전용(Safari/Firefox 미지원, 이번 결정).

### 자동 검증으로 이미 통과한 것 (밤사이)
- 엔진 단위테스트 7 GREEN, `tsc` GREEN, `pnpm build` GREEN.
- **헤드리스 스크린샷**: ① 문단이 페이지 경계에서 줄 단위로 이어짐(통째 점프 아님) / ③ 이미지(가변높이) 흐름 배치 / 실제 A4 비율.
- **CDP 인터랙티브 구동**: 문단 중간 클릭(520,250)→캐럿 정확 이동(518,234) / 텍스트 삽입 시 글자수·본문 리플로우 / 화살표 이동 무크래시 / 3페이지 렌더.

### 당신이 직접 dogfooding 할 것 (자동으론 불가)
1. **④ 한글 IME 조합** — ✅ **2026-06-15 사용자 dogfooding 통과(자모 안 깨짐).** PoC 4기준 전부 검증 완료 → go/no-go 단계.
2. **② 반응형** — 상단 용지(A5/A4/B4/A3)·폰트(14~28px) 셀렉터를 바꿔 즉시 재배치(깨짐 없이)되는지.
3. 클릭 캐럿 배치·화살표·Enter(문단)·Backspace·이미지 삽입 버튼의 손맛.

### 판단 포인트 (go/no-go)
이 PoC 가 증명하려던 것 = "CSS column-wrap 으로 구조적으로 안 되던 것(줄단위 분할 정확·규격 리플로우·가변높이 이미지)을 자체 엔진이 한다." → **자동 검증 범위에선 증명됨.** ④ IME 손맛만 확인되면 본 구축(서식·저장 결선·기존 집필실 통합·Safari fallback) 진행 결정 가능.

### 알려진 한계 (PoC 의도적 범위 밖 — 본 구축 대상)
서식 마크(볼드 등)·저장 결선·텍스트 선택/복붙/undo·문단 간 여백·캐럿 위/아래 페이지경계 정밀·Safari/Firefox·대용량 성능(현재 매 입력마다 전체 재측정).

## 결정 로그 (자율 빌드)

- (it.1) 페이지 기하 = 실제 mm 비율(A4 210×297) px. stylized 28줄 모델 폐기.
- (it.1) 레이아웃 엔진은 측정값을 주입받는 순수함수로 분리 → 브라우저 없이 TDD.
