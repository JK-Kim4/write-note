# 자체 에디터 전면 교체 + TipTap 폐기 — 설계

- 작성일: 2026-06-16
- 브랜치: `023-export` (메인 repo). 024 자체 엔진 R1+R2 머지 완료(`ea7c53f`).
- 선행: `specs/024-custom-editor-r1` (구조), `specs/024-custom-editor-r2` (마크·혼합폰트·affinity)
- 시각자료: `docs/handoff/custom-editor-parity-visual.html` (보존 vs degradation 비교)

## 1. 목표

기본 글쓰기 에디터를 TipTap(CSS column-wrap) → 자체 EditContext 엔진으로 **전면 교체**하고 TipTap을 **완전 폐기**한다. 현재 자체 엔진은 `/b/works/[id]/custom` 실험 라우트에만 있고, 기본 B형(`/b/works/[id]`)·A형(`/projects/[id]/write`)은 TipTap이다. 둘 다 자체 엔진으로 통일한다.

**양보 불가 핵심(§10):** 손실 0의 자체 엔진을 기본 에디터로. 그 전제가 블록 패리티 + 소프트 줄바꿈이다.

## 2. 현재 상태 (검증된 사실)

- `design` 설정: `"default"`(A형 Rail 셸, `/`) / `"b"`(B형 셸, `/b`, 기본값). 사용자 전환 가능 — **둘 다 살아있는 병렬 셸.**
- `writingMode` 설정: `"manuscript"`(원고지 격자) / `"editor"`(기본). **원고지 모드는 설정 UI·store에만 있고 활성 에디터에 결선 안 됨**(`ManuscriptGrid.tsx`는 어디서도 렌더 안 되는 레거시 006). → 동작 안 하는 stub. **별도 정리 트랙**(본 작업 비포함).
- 활성 에디터: A형 `PaperEditor`, B형 `BEditor` — 둘 다 TipTap StarterKit Word 스타일.
- `BStudioShell`은 `renderEditor` 슬롯으로 에디터 비결합. `ExportDialog`·`export-print` PoC는 tiptap 비결합(정적 더미).

### 2-1. 자체 엔진 무손실/손실 표면 (검증)

무손실: 문단 + 제목(H1~3) + 굵게·기울임·밑줄·취소선(4종 마크).
손실(평문 평탄화): **인용(blockquote) · 글머리표/번호목록(bullet/ordered list) · 구분선(horizontalRule) 블록 3종.**

추가로 검증된 **잠재 손실 2건**:
- `pmConvert`에 hardBreak 처리 없음 → 기존 본문의 소프트 줄바꿈(`<br>`)이 지금도 조용히 사라짐.
- `CustomEditor`의 Enter 처리(669줄)에 `shiftKey` 구분 없음 → Enter·Shift+Enter 모두 `splitBlock`. **소프트 줄바꿈 미구현.**

## 3. 핵심 결정 (사용자 합의)

| # | 결정 | 선택 | 근거 |
|---|---|---|---|
| 1 | 인용·목록·구분선 3종 | **패리티 먼저(손실 0)** | 완성도 우선. 자체 엔진에 구현 후 교체 |
| 2 | 소프트 줄바꿈(Shift+Enter) | **R3에 1급 기능으로 추가** | 보통 에디터처럼 "목록 항목 안 줄만 추가(번호 그대로)". 기존 `<br>`도 보존 |
| 3 | A형 거취 | **A형도 자체 엔진으로 교체** | "TipTap 폐기" 완성 — A형이 의존하면 패키지 제거 불가 |
| 4 | 중첩 보존 범위 | **얕은 목록만 1:1** | 한 항목당 한 문단. 진짜 "독립 문단 여러 개를 품은 항목"(드묾)은 항목 분해(글자 손실 0) |

## 4. 블록 모델 아키텍처

기존 평면 블록 모델 유지(`buffer` `\n` 분리 + `blockAttrs[]` + `markRuns[][]`), `BlockAttr` 판별 유니온만 확장. 트리 모델로 갈아엎지 않음(산문엔 얕은 구조면 충분 — 업계 표준 절충).

```
BlockAttr =
  | { type: "paragraph" }
  | { type: "heading"; level: 1|2|3 }
  | { type: "blockquote" }                                          // 신규
  | { type: "listItem"; listKind: "bullet"|"ordered"; depth: number } // 신규
  | { type: "hr" }                                                  // 신규
```

- **인용**: 텍스트 블록. 렌더=좌측 인용선+들여쓰기, measure=들여쓰기만큼 content 폭 축소.
- **목록**: 리스트 아이템 1개 = 블록 1개. 번호는 저장 안 하고 **렌더 시 파생**(연속 같은 kind·depth 아이템 카운트). 마커 폭만큼 폭 축소. `depth`로 들여쓰기.
- **구분선**: 빈 텍스트 원자 블록(세그먼트 `""`, markRuns `[]`). 캐럿 진입 불가·위/아래 건너뜀·Backspace 삭제 — R3 캐럿 유일 난점.
- **소프트 줄바꿈**: `buffer` 안에 블록 경계(`\n`)와 구분되는 **블록 내 줄바꿈 마커 `U+2028`**(유니코드 LINE SEPARATOR). `blockRanges`는 `\n`으로만 블록 분리 → 소프트 줄바꿈은 같은 블록·같은 목록 번호 유지. Shift+Enter→마커 삽입, measure 강제 줄나눔, pmConvert `U+2028` ↔ `hardBreak` 무손실 왕복.

불변식 유지: INV-1(`blockAttrs.length === 세그먼트 수`), INV-4(run len 합 = 블록 글자 수, `U+2028` 포함).

**최대 위험 정합성(R3 필수 게이트):** pmConvert 왕복 idempotence(HARD-GATE, 2026-06-15 회귀). PM 중첩 리스트 ↔ 평면 listItem 블록, blockquote/hr/hardBreak 노드 복원이 결정론적 왕복으로 무손실·idempotent여야 함.

## 5. 라운드 분해

| 라운드 | 이름 | 내용 | dogfood 게이트 |
|---|---|---|---|
| **R3** | 블록 패리티 + 소프트 줄바꿈 | 인용·목록·구분선 + 소프트 줄바꿈을 자체 엔진에 추가 (model `BlockAttr`/`U+2028` 확장 + measure + render(번호 파생·마커·인용선) + caret/selection(hr 원자·소프트 줄바꿈) + pagination 무수정 확인 + pmConvert 왕복 무손실·idempotent + 툴바 버튼) | 프레시 챕터에 5종 블록 + 4종 마크 + Shift+Enter 줄바꿈 작성→저장→재로드 **무손실** + PM JSON 왕복 idempotent(결정론 테스트) |
| **R4** | B형 전면 교체 | 기본 `/b/works/[id]`를 `BStudioShell + BCustomChapterEditor + export 통합`으로 재작성. `/custom` 실험 라우트·경고배너 제거 | **기존** B형 실제 챕터(인용/목록/줄바꿈 포함)를 자체 엔진으로 열어 무손실 |
| **R5** | A형 전면 교체 | `/projects/[id]/write`의 `ChapterEditor/PaperEditor`를 자체 엔진 결선으로 교체(A형 툴바·아웃라인 차이 흡수) | A형 챕터 무손실 |
| **R6** | TipTap 폐기 | `@tiptap/*` 3패키지 + 아래 파일 제거, 타입 이동, multicol WIP(`7b84c74`) supersede 확인 | `grep -rn @tiptap src`=0 + build·tsc·전체 vitest GREEN |
| **R7** | Export (023 Round 3) | 자체 엔진 모델 기반 내보내기 — 원래 023 목표 | 별도 진입점, 교체 종료 후 |
| — | develop merge | 최종 통합 | — |

순서 논리: R3(패리티)이 손실 0 교체의 전제 → R4 기본 교체 무손실 성립 → R5 A형 통일 → R6 비로소 TipTap 제거 가능. 데이터 손실 위험 구간 없음.

### 5-1. R6 폐기 상세

- 삭제 파일: `BEditor.tsx`·`PaperEditor.tsx`·`Editor.tsx`(레거시 006)·`ChapterEditor.tsx`·`BChapterEditor.tsx`·`useEditorOutline.ts`
- 타입 이동: `BChapterEditorConflictHandlers/SyncStatus` → 중립 모듈(`BStudioShell.tsx` 또는 `custom-editor/types.ts`)
- 패키지 제거: `@tiptap/pm`·`@tiptap/react`·`@tiptap/starter-kit`
- 부수: `Editor.tsx` 삭제로 고아 될 `ManuscriptGrid.tsx`/`manuscript.ts`(원고지 레거시)는 **별도 트랙**으로 분리(본 폐기와 미혼합)

## 6. 제약 (HARD-GATE)

- 백엔드 변경 0 / Chromium 전용(EditContext) / 공동집필 충돌감지(016 버전 토큰) 제거 금지
- 직렬화 왕복 idempotence 유지(`code-quality.md` 자동저장 dirty 판정 HARD-GATE)
- IME 가드는 `compositionstart/end`(`e.isComposing` 금지)
- §10 핵심 먼저 / §11 관찰→확정→수정 / §7 subagent 자기진단 재검증 / §12 1:N 세션 키 추종

## 7. 진행 방식

- 라운드별 speckit(spec→plan→tasks→analyze) → sub-agent 위임(순수 TDD=sonnet, 캐럿/선택/렌더=opus, haiku 금지) → dogfooding(custom-r1@writenote.local/dogfood1234, 작품 3537)
- 게이트: `tsc --noEmit` · vitest(`src/components/custom-editor` + `src/app/b`) · `pnpm build`(RSC 경계)

## 8. 별도 트랙 (본 작업 비포함, surfacing)

- 원고지 모드(`writingMode: "manuscript"`) stub — 설정 UI·store만 있고 미결선. 정리 또는 구현 결정 필요.
- R2 마무리: 회고·vault(02-PROGRESS/03-ISSUES) 갱신·GitHub 이슈 #65~#69 close.
