# 025 자체 에디터 — 한글 받침 IME 버그 수정 + 서식 툴바 개선

- 일자: 2026-06-17
- 워크트리 / 브랜치: write-note(메인) / `025-editor-ime-toolbar`
- 관련 PR / 커밋: 미커밋(회고 후 develop 머지 예정)
- 작업 시간 (대략): 단일 세션

## 1. 무엇을 했는가 (사실)

- `speckit-specify`로 spec `025-editor-ime-toolbar` 작성 — User Story 2개(P1 받침 입력 정확성 / P2 서식 툴바), 품질 체크리스트 16/16 통과.
- **P1 받침 버그 수정** — `CustomEditor.tsx` 입력 루프(`onText`/`compositionend`)에서 IME 조합 중 `setSel`(selection state 갱신)을 억제하고, 조합 중 캐럿은 `ecRef.current.selectionStart`를 직접 읽어 그리도록 `caretPos` 계산을 변경.
- **P2 툴바 교체** — `toolbarIcons.tsx` 신규 작성(인라인 SVG 아이콘 4종 + `ToolbarButton`(자체 hover state) + `ToolbarDivider` + `MarkGlyph`), `CustomEditor.tsx`의 옛 `toolbarBtn` 헬퍼·툴바 JSX를 "안 1 혼합형"(블록=텍스트, 글자·삽입=아이콘, 그룹 구분선)으로 교체.
- 검증 — `typecheck` / `build`(RSC 경계) / `test` 567개 모두 GREEN. dogfooding으로 받침 재조합·커서·툴바 확인.
- 임시 산출물(`/poc/ime-debug` 페이지, `public/toolbar-mockup.html`, 진단 `console.log`) 전부 제거.

## 2. 어떻게 했는가 (접근)

- **P1 = systematic-debugging**. 추측 수정 금지(Iron Law) 준수.
  - Playwright 부재로 IME 자동 재현 불가 → 빈 `DocModel`로 `CustomEditor`를 직접 띄우는 임시 격리 페이지(`/poc/ime-debug`, 백엔드 불필요) + dev 서버 → 사용자 dogfooding으로 재현.
  - 진단 계측(`textupdate`/`composition` 이벤트 로그) → 1차 로그로 "받침 글자에서 조기 `compositionend` → 받침 고착" 확정.
  - **실험1**(조합 중 model/sel 둘 다 억제) → 받침 재조합 정상 = 가설 A(우리 리렌더가 범인) 확정. **실험2**(텍스트는 표시하되 `setSel`만 억제) → 정상 + 화면 표시 = 범인이 `onModelChange`가 아니라 `setSel`임을 분리.
  - 정식 수정 후 캐럿 부작용 발견 → `setSel` 억제 유지하면서 캐럿만 `ec.selectionStart`로 살리는 정밀 수정.
- **P2 = brainstorming → 경량 직접 구현**(CLAUDE.md §10 — 단일 파일 UI라 풀 plan 생략).
  - 아이콘 라이브러리 부재·인라인 SVG 관행 확인 → 디자인 방향 질문 → 사용자가 "목업으로 보여줘" → HTML 목업 4안 제시 → 사용자 "안 1" 선택 → 구현.

## 3. 잘 된 점

1) **받침 버그를 추측 0으로 해결.** 진단 계측 + 실험1/2로 가설 A(우리 리렌더)/B(EditContext 한계)를 이분 확정한 뒤에만 수정에 진입. 근거: 실험 로그가 "조합 중 리렌더를 끄면 `놀→노`로 받침이 분리(재조합)된다"를 직접 보여줌 — 메커니즘을 눈으로 확인하고 고침.
2) **최소 수정으로 좁힘.** 실험2가 "`onModelChange`(텍스트 표시)는 무해, `setSel`만 범인"을 갈라줘 수정이 입력 루프 몇 줄 + 캐럿 1줄로 끝남. 백엔드·저장 포맷·model 로직 무변경.
3) **첫 수정의 부작용을 감수하지 않고 정밀화.** 조합 중 `setSel` 전면 억제가 커서 뒤처짐을 낳자, 캐럿을 `ec.selectionStart`로 분리 처리. 사용자 "커서도 자연스럽다" 확인.
4) **시각 결정을 실물로 전환.** ASCII 3지선다가 사용자에게 안 와닿자 즉시 동작하는 HTML 목업(호버·활성 포함)으로 바꿔 선택을 받음.

## 4. 어긋난 점

- **사용자 방향 수정 2회.**
  - (1) brainstorming 첫 질문을 ASCII preview 3지선다로 냈다가 거부당함 → "목업으로 보여줘". **회피 가능 시점**: 툴바는 본질적으로 시각 영역이므로, 첫 질문부터 텍스트 옵션이 아니라 실물 목업을 제시했어야. brainstorming 지침의 "보여주는 게 말하는 것보다 명확"을 ASCII로 우회하려다 빗나감.
  - (2) P1 정식 수정 직후 "커서 위치 좀 어색" — 첫 수정(조합 중 `setSel` 전면 억제)이 캐럿 뒤처짐 부작용을 낳음. **회피 가능 시점**: 조합 중 `setSel` 억제를 결정하는 순간, `setSel`이 동시에 맡던 두 역할(① 리렌더 트리거 ② 캐럿 위치 갱신)을 분리 인지해 "캐럿은 조합 중 무엇으로 따라가나"를 함께 설계했어야.
- **추측 수정 0 / 반복 헛수정 0.** 같은 증상을 다른 가설로 다시 고치는 사이클 없음(systematic-debugging §11 회피). 캐럿 정밀 수정만 dogfooding 전 미검증 가설이었고 1회 검증으로 확정.
- **재현 비용**: dogfooding 3회(IME는 OS 입력기라 자동화 불가, 단위테스트 미커버). 불가피 — 임시 격리 페이지로 백엔드 의존은 제거해 최소화함.

## 5. 다음 작업에 남길 교훈

### 5-1. 작업별 교훈 (이 프로젝트 한정)

- **자체 EditContext 에디터의 IME 조합 중 상태 갱신**: `textupdate` 처리에서 텍스트(`onModelChange`)는 갱신해도 되지만 selection state(`setSel`)를 갱신하면 조합이 강제 종료돼 한글 받침 재조합이 깨진다. 조합 중(`composingRef.current`)에는 `setSel`을 억제하고, 캐럿은 `ec.selectionStart`를 직접 읽어 렌더하며, `compositionend`에서 한 번 정렬한다.
- IME 입력 버그는 Vitest/JSDOM으로 재현 불가 → 빈 model로 에디터만 띄우는 임시 격리 페이지 + dev dogfooding이 유일 검증 경로.

### 5-2. 룰 갱신 후보 (사용자 컨펌 필요)

**후보 1 — 프로젝트 룰 `.claude/rules/typescript/code-quality.md` (한국어 영역 검증 cadence 절)에 회귀 사례 추가**

- 일반 원칙: **에디터가 IME 조합(composition) 중 화면을 React state로 갱신할 때, 텍스트 표시와 selection/caret 갱신을 분리하라. selection state 변경이 일으키는 리렌더는 조합을 강제 종료시켜 CJK 재조합(한글 받침 이동 등)을 깰 수 있다.** 조합 중에는 selection state 갱신을 억제하고 텍스트 표시만 유지한다.
- 근거 회귀 사례: §4 (1) — `CustomEditor.onText`가 조합 중 `setSel` 호출 → 받침이 앞 글자에 고착("노란달"→"놀란달"). 실험2로 `setSel`이 범인임을 확정, 조합 중 억제 + 캐럿 `ec.selectionStart` 분리로 해결.
- self-check: "조합 중 텍스트 표시와 캐럿 갱신을 분리한다"는 IME를 다루는 어느 커스텀 에디터에도 적용되는 일반 명제로 추상화 가능 → 후보 적격. 단 EditContext 특정 API(`ec.selectionStart`)는 사례 근거로만 인용.

**후보 2 — 약한 신호, 후보에서 보류 제안**

- "시각적 UI 결정은 텍스트 옵션보다 실물 목업을 먼저 제시"(§4 (2))는 일반 원칙이나, 회귀 1건 + 손해 경미(질문 1회 재구성). §5-2 "회귀 사례 부재 시 추가 금지"에 비춰 **룰 승격 보류**, 본 회고 기록으로만 남김.

**사용자 컨펌 전까지 실제 룰 파일 수정하지 않음.**
