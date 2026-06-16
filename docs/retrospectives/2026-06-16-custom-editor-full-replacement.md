# 회고 — 자체 에디터 전면 교체 + TipTap 폐기 (R3~R6)

- 일자: 2026-06-16
- 브랜치: `023-export` (커밋 `1ca6c38` 설계 → `cb70ede` R6)
- 범위: R3(블록 패리티·소프트 줄바꿈·리치 복붙) · R4(B형 교체) · R5(A형 교체) · R6(TipTap 폐기)
- 설계: `docs/superpowers/specs/2026-06-16-custom-editor-full-replacement-design.md`
- 진행 방식: 라운드별 lean speckit → 라운드 자동 구현(자동 게이트) → **각 라운드 dogfooding 게이트에서 정지**(사용자 확인) → 다음 라운드

## 1. 무엇을 했나 (성과)

- TipTap(CSS column-wrap) → 자체 EditContext 엔진으로 **A·B 양쪽 집필실 전면 교체 + TipTap 3패키지 완전 폐기**(`grep @tiptap src`=0).
- R3: 평면 BlockAttr 유니온 확장(blockquote/listItem/hr) + `U+2028` 소프트 줄바꿈 + 리치 복붙(PM JSON 클립보드). pmConvert 무손실·idempotent 왕복. 순수 모듈 TDD(model/measure/pmConvert) 사실상 sonnet subagent 3병렬.
- R4/R5: BStudioShell + BCustomChapterEditor 재사용으로 두 셸 결선(중복 0). R6: 타입 이관 후 옛 에디터 6파일 + 고아 InlineEditableTitle + poc/write 삭제.
- 게이트: 최종 vitest 545 GREEN, tsc·build GREEN. 데이터 손실 위험 0(R3 패리티 선행으로 B 툴바 노드 전부 무손실).

## 2. 잘 된 것

- **§10 핵심 먼저**: 패리티(R3)를 교체(R4/R5)보다 먼저 둬 "데이터 손실 위험 구간"을 만들지 않음. R4에서 기존 챕터 교체가 무손실로 성립.
- **§11 관찰→확정→수정**: 소프트 줄바꿈 버그를 추측 수정하지 않고 measure(코드 강제 줄나눔)↔렌더(CSS pre-wrap 의존) 메트릭 불일치를 코드로 짚어 **한 번에** 해결(U+2028은 브라우저 CSS 줄바꿈 비신뢰 → 표시 시 `\n` 치환).
- **§7 재검증**: 병렬 sonnet subagent 3종의 "각자 GREEN" 보고를 수용 전 통합 tsc/vitest로 직접 재검증(병렬이라 각자 본 tsc 스냅샷이 서로의 미완성 상태였음 → 통합 검증이 필수였음).
- **시각자료로 합의**: "무엇이 보존/손실되나"를 HTML 비교자료로 만들어 사용자가 Shift+Enter 케이스를 정확히 지적 → 설계 보강(소프트 줄바꿈 1급화).
- **컴포넌트 재사용**: A형(R5)이 B형 BCustomChapterEditor를 그대로 재사용 → 세션 로직 중복 0, R6 폐기도 깔끔.

## 3. 어긋난 점 / 교훈

- **(중요) 백엔드 health 503 오진 — 단정 금지 위반**: 프론트 "불러오는 중" 멈춤을 "거의 확실히 DB 연결 끊김"으로 단정. 실제는 **MailHealthIndicator**(로컬 SMTP 미설정)가 health를 DOWN으로 집계한 것이고 DB·앱은 정상이었음. health 상세 로그를 보기 전에 원인을 단정한 것이 오진. → **교훈: health/503 같은 집계 신호는 상세(어느 인디케이터)를 확인하기 전 원인 단정 금지.** (§11/금지2 강화)
- **"무수정" 가정 미세 오차**: 설계에서 layoutEngine·geometry "무수정" 가정했으나 `geometry.blockFont`가 "paragraph 아니면 heading" 이항 narrowing을 써서 새 BlockAttr 유니온에 깨짐 → `type==="heading"` 명시 narrowing으로 보정 1곳 필요. → 유니온 확장 시 기존 narrowing 전수 점검.
- **subagent tool_uses**: R3 model subagent가 tool_uses 74(cap 가이드 ~40 초과). U+2028 주석 리터럴 esbuild 파싱 오류 자가수정 등으로 늘어남. cap 명시했으나 초과 — dispatch 시 더 강한 상한 또는 중간 체크포인트 고려.
- **export 미완성 노출**: ExportDialog가 023 때부터 CSS 없는 골격 스텁이었는데 R4 dogfooding에서 사용자가 발견("이상하게 나옴"). 회귀는 아니나, 결선만 한 미완성 UI를 dogfooding에 노출할 때 "이건 R7 영역" 사전 고지가 부족했음.

## 4. 룰 갱신 후보 (사용자 컨펌 후 반영)

- **`code-quality.md` (TS) 신규 HARD-GATE 후보**: "측정(measure)과 렌더(render)가 서로 다른 줄바꿈 메커니즘에 의존하면 정합 깨짐 — 강제 줄바꿈 문자(U+2028 등)는 CSS 렌더 신뢰성이 낮으니, 측정이 코드로 강제하면 렌더도 코드로 강제(`\n` 치환 등)하라." (2026-06-16 R3 소프트줄바꿈 회귀 근거)
- **`agent-workflow-discipline.md` 강화 후보(§11/단정)**: "집계 상태 신호(health/ready 503, composite 상태)는 **구성 인디케이터 상세를 확인하기 전 원인 단정 금지**." (2026-06-16 mail-health 오진 근거)
- 위 둘은 회귀 사례 있음 → 메타 정책상 추가 가능. 사용자 컨펌 시 반영.

## 5. 잔여 / 다음

- **R7 Export(023 Round 3)** — 새 세션에서 진입. 핸드오프 `docs/handoff/2026-06-16-r7-export-kickoff.md`.
- R2 GitHub 이슈 #65~69 close(본 정리에서 처리).
- develop merge — R7 완료 후.
- 별도 트랙: 원고지 stub(ManuscriptGrid/manuscript.ts) 정리, b.css/paper-editor.css dead CSS 정리, subagent tool_uses cap 강화.
