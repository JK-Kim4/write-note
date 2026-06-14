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
- [x] M5. EditContext 입력 루프(IME·Enter·Backspace·캐럿) + 렌더 — **빌드·헤드리스 스크린샷 검증**. IME 라이브만 아침 dogfooding.
- [ ] M6. 캐럿 정밀화(클릭 hit-test·화살표) + ②반응형 인터랙티브 검증 + 아침 요약 ← **다음**

## 현재 상태 (iteration 3 끝)

- **M1~M5 완료.** `/poc/editor` = EditContext 라이브 에디터, `/poc/editor-static` = 정적 fallback.
- **헤드리스 Chrome 스크린샷으로 시각 검증 완료(①②③):**
  - 다중 페이지 렌더 정상 — 페이지1이 첫 문단으로 꽉 차고 **페이지2가 같은 문단을 줄 단위로 이어받음**(=① 통째 점프 아님).
  - **이미지(가변높이 블록)**가 흐름에 정상 배치·렌더(=③). 실제 A4 비율·한글 줄바꿈 정확.
- 게이트: poc-editor 단위테스트 7 GREEN, `tsc --noEmit` GREEN, `pnpm build` GREEN.
- **미검증(아침 dogfooding 영역):** ④ 한글 IME 라이브 타이핑(헤드리스 IME 불가) / ② 용지·폰트 변경 인터랙티브 반응(엔진 로직은 단위테스트 GREEN, 화면 반응은 클릭 필요) / 캐럿 클릭 배치·화살표 이동(M6).

### 발견·수정한 버그 (it.3)

- **SWC 상수폴딩이 보간 템플릿 리터럴의 `'/>`를 유실** — `\`<svg ... height='${IMG_NH}'/>\`` 형태를 빌드가 `height='400<rect`로 깨뜨려 SVG 무효화 → 이미지 미표시. node(런타임)는 멀쩡. **정적판은 리터럴 숫자라 무사.** 수정: SVG data URI 를 **보간 없는 리터럴 문자열**로(PocEditorLive `IMG_SRC`). 회귀 신호 — 빌드 산출 chunk grep(`400<rect`)로 확정.

### 다음 iteration 진입점 (M6)

캐럿 클릭 배치(hit-test: 클릭 좌표 → 페이지·줄·문자 오프셋 역산 → `updateSelection`) + 화살표 이동(keydown). 그 후 ② 반응형은 헤드리스 CDP 로 select 구동해 스크린샷, 또는 아침 dogfooding 위임. 마지막에 아침 요약 작성 + prod 서버(3939) 정리.

## 아침 리뷰 방법 (사용자용)

```bash
cd /Users/jongwan-air/Desktop/workspaces/write-note-024-custom-editor/frontend
pnpm dev          # 그 후 Chrome에서 http://localhost:3000/poc/editor
pnpm exec vitest run src/components/poc-editor   # 엔진 단위테스트
```
PoC 화면에서 확인할 것: 한글 타이핑이 페이지를 줄 단위로 넘는지 / 용지·폰트 바꾸면 재배치되는지 / 이미지 삽입 시 통째로 밀리는지.
(M5까지 못 가면 정적 화면이라도 ①②③는 확인 가능 — 진척은 위 마일스톤 체크박스 참고.)

## 결정 로그 (자율 빌드)

- (it.1) 페이지 기하 = 실제 mm 비율(A4 210×297) px. stylized 28줄 모델 폐기.
- (it.1) 레이아웃 엔진은 측정값을 주입받는 순수함수로 분리 → 브라우저 없이 TDD.
