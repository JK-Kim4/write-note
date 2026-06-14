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
- [ ] M5. EditContext 입력 루프(IME·Enter·Backspace·캐럿) + 라이브 리플로우 (④) ← **다음**
- [ ] M6. 이미지 삽입 컨트롤 + 검증 + 브라우저 스크린샷 + 아침 요약

## 현재 상태 (iteration 2 끝)

- M1~M4 완료. `/poc/editor` 정적 화면: 샘플 문서(한글 문단 + 가변높이 이미지) → measure → layout → 페이지 박스 렌더. 용지(A5/A4/B4/A3)·폰트(14~28px) 컨트롤로 ①②③ 즉시 확인 가능.
- 게이트: poc-editor 단위테스트 7 GREEN, `tsc --noEmit` GREEN, `pnpm build` GREEN.
- 리서치 디제스트 확보(EditContext 정규 루프: textupdate→모델 splice→재렌더→캐럿 / characterboundsupdate→updateCharacterBounds / 측정 Range.getClientRects / 상용 에디터 비교). M5 구현에 반영 예정.
- **미검증(아침 dogfooding 영역):** 실제 브라우저 시각 렌더(측정 정확도·clip 밴드 정합). 헤드리스로는 layout 미발생이라 코드 정합·빌드까지만 확인.

### 다음 iteration 진입점 (M5)

EditContext 를 `PocEditor` 에 결선: 호스트 div 에 `editContext` 붙이고 `textupdate` 에서 활성 문단 텍스트 splice → 해당 문단만 재측정 → `layout` 재실행 → 재렌더, 캐럿은 직접 그림(문자 위치 = measure 의 줄·문자범위로 산출). Enter=문단 분할, Backspace=병합/삭제. 최소 캐럿 이동만(전체 선택/복붙/undo 는 OUT).

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
