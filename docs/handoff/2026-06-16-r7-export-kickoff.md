# R7 Export (023 Round 3) — 새 세션 kickoff 핸드오프

새 세션에서 이 문서를 정독 후 R7부터 이어간다. 자체 에디터 전면 교체(R3~R6)는 완료됐다.

## 현재 상태 (진입점)

- 브랜치: `023-export` (clean, 전부 커밋). develop 미머지.
- 자체 에디터 전면 교체 완료(R3~R6, 커밋 `1ca6c38`설계 → `cb70ede`R6):
  - A형 `/projects/[id]/write`·B형 `/b/works/[id]` 둘 다 자체 EditContext 엔진(BCustomChapterEditor).
  - TipTap 완전 폐기(`grep @tiptap src`=0, 패키지 제거).
  - 게이트 GREEN: tsc · vitest 545 · build.
- 설계 마스터: `docs/superpowers/specs/2026-06-16-custom-editor-full-replacement-design.md`
- 회고: `docs/retrospectives/2026-06-16-custom-editor-full-replacement.md`
- 라운드 spec: `specs/024-custom-editor-r3/`~`r6/`

## R7 = 023 Round 3 Export — 무엇을 만드나

작품의 챕터들을 골라 묶어 **PDF / HWPX / DOCX** 로 내보내기. 현재:
- **ExportDialog UI 골격만 존재**(`src/components/export/ExportDialog.tsx`): 포맷 버튼(PDF만 활성, HWPX/DOCX disabled)·챕터 선택/순서·"줄노트 줄 포함"·용지 표시·내보내기/닫기. **`.export-dialog` CSS 전무**(스타일 안 입혀짐) + **생성 로직 0**(onExportPdf placeholder).
- ExportDialog는 A·B 공통 셸(BStudioShell)에서 `onExport`→열림 결선됨(R4). 열림/닫힘/챕터 목록은 동작.
- 챕터 합본 수집 헬퍼: `src/lib/export/collectChapters.ts`(테스트 있음) — 참고.

## 023 선행 자산 (재활용 판단 필요 — 새 세션 첫 조사)

- `/poc/export-print` (`src/app/(poc)/poc/export-print/page.tsx`): A4 인쇄 정합 PoC(@page + break-after, 정적 더미 본문, 에디터 비의존). PDF=브라우저 인쇄 정합 방식의 후보.
- hwpx 생성 스파이크: git log `0d46664 spike(023): hwpx 생성 실현가능성 검증 — hwpxlib 매핑 범위 (#42)` 참조.
- 메모리 `export-feature-progress`: "023 Export Round 3 — Phase 0·1 완료, Phase 2 PDF PoC 직전 중단, 한컴 dogfooding 대기".
- 마일스톤/이슈: web 런칭 Round 3 export 관련 이슈(#42 등) 확인.

## R7에서 합의할 본질 결정 (brainstorming 권장)

1. **포맷 범위**: R7에 PDF만? +HWPX(한글 .hwpx)? +DOCX? (HWPX는 hwpxlib 매핑·백엔드 필요 가능성 — 023 스파이크 확인)
2. **PDF 생성 방식**: 브라우저 인쇄 정합 라우트(클라이언트, 자체 엔진 페이지분할 재현) vs 라이브러리 생성(서버/클라). 자체 엔진의 페이지 기하(geometry/layoutEngine)·블록 렌더와 정합이 핵심.
3. **자체 엔진 DocModel → 출력 변환 경로**: 디스크는 PM JSON. 출력은 DocModel(또는 PM JSON)에서 HTML/PDF로. pmConvert·measure 재사용 범위.
4. **다이얼로그 스타일링**: `.export-dialog` CSS 신설(모달 오버레이+레이아웃). R4에서 미룬 것.
5. **백엔드 필요 여부**: PDF 클라이언트 생성이면 백엔드 0 가능. HWPX/DOCX는 백엔드(hwpxlib/docx 라이브러리) 가능성.

## 진행 규율 (이번 세션과 동일)

- ad-hoc 금지. brainstorming → speckit(spec→plan→tasks→analyze) → 구현. (R7은 결정 많은 기능이라 brainstorming 권장.)
- 모델 규모별 subagent(순수 변환 TDD=sonnet, 통합·렌더=opus, haiku 금지).
- §10 핵심 먼저 / §11 관찰→확정→수정 / §7 subagent 자기진단 재검증 / 단정 금지(특히 health/집계 신호).
- 게이트: tsc · vitest(`src/components/custom-editor` + `src/app/b` + `src/app/projects/[id]/write` + `src/lib/export`) · build. dogfooding 게이트에서 정지.
- dogfooding 환경: 풀스택. **백엔드 health 503은 메일 인디케이터 탓(기능 무관) — DB/앱 정상**. 계정 custom-r1@writenote.local / dogfood1234. **3537은 없는 작품 ID** — `/b/library`에서 실제 작품으로.

## R7 전에/병행 처리할 잔여 (이번 정리에서 일부 처리)

- ✅ 회고 작성 / vault 02-PROGRESS 갱신 (이번 정리)
- 이번 정리에서: GitHub 이슈 #65~69(R2) close
- R7 후: develop merge
- 별도 트랙(저순위): 원고지 stub(ManuscriptGrid/manuscript.ts) 정리, b.css/paper-editor.css dead CSS 정리

## 새 세션 첫 액션 (제안)

"R7 Export를 brainstorming부터 시작하자. 위 핸드오프 정독 후 023 선행 자산(/poc/export-print, hwpx 스파이크 #42, export-feature-progress 메모리)을 먼저 조사해 포맷 범위·PDF 생성 방식 옵션을 정리하고, 본질 결정 5개를 합의하자."
