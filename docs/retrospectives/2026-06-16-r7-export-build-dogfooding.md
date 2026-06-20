# R7 Export (023 Round 3) — 구현 + dogfooding 회고

- 일자: 2026-06-16
- 브랜치: `023-export` (develop 미머지)
- 관련 커밋: `59f08f5`(설계) → `f4cc82b`(plan) → `1198e8a`~`cb84044`(12 task) → `fecd70b`(테스트 복원) → dogfooding 수정(`0057e88`·`262968d`/`f514df9`·`045df61`·`7c323ce`·`248af8d`·`b1050c8`)
- 작업: brainstorming → speckit(spec/plan) → subagent-driven 12 task → 풀스택 dogfooding

## 1. 무엇을 했는가 (사실)

- **설계·계획**: R7 Export 설계(PDF 브라우저 인쇄 정합 / HWPX·DOCX 백엔드 / `ExportDoc` DTO / 합본 3모드) + 12 task 단일 plan 작성.
- **PDF(클라, 백엔드 0)**: `mergeChaptersForPrint`(joinMode별 합본) + `relayout`/`renderRuns`를 `printLayout.tsx`로 동작보존 추출 + `PrintDocument`(인쇄 페이지 DOM) + `PrintOverlay` + `usePdfExport` 훅, A·B 양쪽 결선.
- **워드(백엔드)**: POI/hwpxlib 의존성 + `ExportRequest` DTO + `DocxExportService`(POI XWPF) + `HwpxExportService`(스파이크 승격) + `ExportController`(소유자 검증, 401/200/404 테스트) + `buildExportDoc`/`exportWord`/`useWordExport` 프론트 결선.
- **dogfooding 수정 6건**: 빈 블록 Backspace 강등(`0057e88`) / Cmd+A IME 가드(`262968d`→롤백 `f514df9`) / 워드 제목 직접 서식(`045df61`) / PDF 빈 페이지·취소 재오픈(`7c323ce`) / 합본 방식 라벨 위계(`248af8d`·`b1050c8`).
- 게이트: 프론트 tsc·vitest·build / 백엔드 ktlint·checkstyle·test·build 전부 GREEN. R7 export dogfooding 통과(PDF 본문·합본·취소, DOCX 생성·제목, HWPX 생성).

## 2. 어떻게 했는가 (접근)

- **사전 조사로 옵션 검증 후 인터뷰**(§1 정합): layoutEngine/measure/geometry/pmConvert 실제 시그니처·POI XWPF API(context7)·`toGeoPaperSize` 기존 매핑을 먼저 확인하고 brainstorming 옵션·plan 코드를 구성. 추측 옵션을 사용자에게 던지지 않음.
- **subagent-driven, 모델 규모별**: 순수 변환 TDD=sonnet / 통합·렌더·위험(추출)=opus. task마다 spec+code 리뷰(작은 순수 함수는 직접 diff 검증으로 갈음).
- **dogfooding은 §11 관찰 우선**: 버그 보고 시 추측 수정 전 관찰 — chapter 본문 DB 직접 확인(빈 챕터 가설 기각), PrintOverlay 코드로 print-root 위치 확정, 백엔드 재기동으로 로그 확보.

## 3. 잘 된 점

1) **사전 조사가 plan 오류를 조기 차단·정정**: `toGeoPaperSize` 기존 매핑을 코드로 확인해 spec의 "PaperSize 통일" 부정확 항목을 plan/spec에서 정정(§5 정합). 근거: `BCustomChapterEditor.tsx:31-35` 실측.
2) **동작보존 추출 회귀 0**: `relayout`/`renderRuns` printLayout 추출 시 custom-editor 275 테스트 무회귀 + diff 기반 spec 리뷰로 "로직 변경 0" 독립 검증.
3) **PDF 빈 페이지 근본 수정(§11 관찰)**: 추측 수정 대신 chapter 본문 정상 확인 → print-root가 컴포넌트 트리 안(body 직속 아님)이라 `@media print`가 통째로 숨김을 코드로 확정 → createPortal 1회 수정으로 해결, dogfooding 재확인 통과.
4) **소유자 검증 충실**: ExportController가 401/200/404 3경로 테스트 커버.

## 4. 어긋난 점

- **Cmd+A 헛수정 1회(§11 위반 직전 차단)**: 조합 중 Cmd+A "두 번 눌러야" → 가드만 여는 1차 수정(`262968d`)이 조합 중 selection을 IME가 되돌리는 "깜빡" 부작용 유발. 사용자 재보고 후 §11대로 추측 반복 안 하고 **롤백(`f514df9`)**해 baseline 명확화. 회피 가능 시점: 1차 수정 전 "조합 중 명령은 commit 선행이 필요한가" 관찰.
- **plan이 A형 라우트 누락**: plan은 ExportDialog 결선을 B형(BStudioShell)만 가정했으나 Task 1에서 A형(`projects/[id]/write/page.tsx`)도 독립 마운트 발견 → 공통 훅(usePdfExport/useWordExport)으로 보강. 회피 가능 시점: plan 단계 "ExportDialog 마운트처" grep.
- **DOCX 제목 styleId 가정 오류**: plan이 `p.style="Heading1"`을 박았으나 POI 빈 문서엔 Heading 스타일 정의가 없어 일반 폰트로 렌더. **단위테스트가 "제목 텍스트 포함"만 검증해 못 걸름** → dogfooding에서 발견, 직접 서식(bold+크기)으로 수정. 회피 가능 시점: plan에서 "styleId가 빈 문서에 정의되는가" 검증 또는 테스트에 서식 assert.
- **PDF print-root portal 미고려**: plan/구현이 `@media print { body > *:not(.print-root) }`가 print-root의 body 직속을 전제함을 놓침 → dogfooding 흰 페이지로 발견.
- **워드 500 초기 혼선**: 사용자가 띄운 stale BE(R7 전 코드 가능성)로 첫 워드 500 → BE 재기동 후 해소. 백엔드 재시작 없이 dogfooding 진입한 탓.
- **에디터 갭 5건 노출(R3~R6 미성숙)**: R7 dogfooding 중 자체 엔진(전면 교체) 갭이 다수 노출 — 빈블록 Backspace(✅수정)·Cmd+A·IME 조합 중 명령·**거짓 409 저장충돌(중대)**·목차 선택 인디케이터. R7 export와 무관하나 같은 브랜치라 merge 영향. 사용자 결정으로 별도 집중 라운드(systematic-debugging)로 분리.

## 5. 다음 작업에 남길 교훈

### 5-1. 작업별 교훈 (이 프로젝트 한정)

1. **인쇄 전용 DOM은 `createPortal(document.body)`로 body 직속 마운트** — `@media print`로 특정 요소만 인쇄하려면 그 요소가 body 직속이어야 규칙(`body > *:not(.print-root)`)이 산다. 컴포넌트 트리 안에 두면 루트 div와 함께 숨겨진다.
2. **워드(DOCX/HWPX) 생성은 styleId 의존 대신 run 직접 서식** — POI `new XWPFDocument()`·hwpxlib BlankFile은 Heading/스타일 정의가 없어 styleId만으론 시각 효과 없음. 직접 서식(bold+크기)이 뷰어 무관 견고.
3. **A·B 두 집필실 라우트는 export·세션 결선을 공통 훅으로** — ExportDialog/세션을 양쪽이 독립 마운트하므로 한쪽만 결선하면 누락.

### 5-2. 룰 갱신 후보 (사용자 컨펌 필요)

**후보 1 — 생성물 단위테스트의 검증 한계 명시 (agent-workflow-discipline 또는 testing 룰)**
- (1) 대상: `.claude/rules/...` (testing-strategy 또는 agent-workflow-discipline)
- (2) 본문(일반 원칙): "파일·문서 등 **생성물의 단위테스트가 '생성 성공/요소 존재'만 검증하면, 실제 렌더·스타일·외부 뷰어 정합 갭을 못 잡는다.** 시각/외부 렌더 결과(인쇄·워드프로세서·브라우저 표시)는 dogfooding 게이트로 검증하고, plan에 '단위테스트로 못 잡는 가정'(예: 스타일 정의 존재)을 명시한다."
- (3) 근거: §4 DOCX 제목 styleId — 단위테스트 "텍스트 포함" 통과했으나 dogfooding에서 일반 폰트 발견.

**후보 2 — 전면 교체(엔진/인프라) 위에 신기능을 얹을 때 (agent-workflow-discipline)**
- (1) 대상: `.claude/rules/shared/agent-workflow-discipline.md`
- (2) 본문(일반 원칙): "검증 미성숙한 전면 교체(자체 엔진·인프라 교체) **위에 신기능 라운드를 얹으면, 신기능 dogfooding이 교체분의 갭을 다수 노출**해 트랙이 뒤엉킨다. 교체 라운드는 자체 dogfooding을 충분히 통과시킨 뒤 신기능 라운드에 진입하거나, 신기능 dogfooding에서 나온 교체분 갭은 즉시 별도 트랙으로 분리한다."
- (3) 근거: §4 R7 export dogfooding 중 R3~R6 자체 엔진 갭 5건 노출 → 별도 라운드 분리.

(Cmd+A 헛수정·롤백, print-root portal 구현 세부는 §11·§5-1로 충분 — 룰 승격 제외.)

---

## 미해결 / 다음 진입점

- **R7 export**: dogfooding 통과. develop merge 결정 대기 — 단 같은 브랜치의 **에디터 갭(특히 거짓 409 저장충돌)이 중대**하므로 merge 전 고려 필요.
- **에디터 갭 별도 라운드(systematic-debugging)**: ① 거짓 409 저장충돌(제목 편집+목차 클릭 경로, §12 차원 추종 재발 의심) ② 목차 클릭 선택 인디케이터 앞부분만 ③ Cmd+A·IME 조합 중 명령(조합 commit 선행 필요) ④ HWPX 한컴 렌더 미검증.
