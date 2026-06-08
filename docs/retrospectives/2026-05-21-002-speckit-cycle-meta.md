# 002 Speckit 워크플로우 메타 회고 — specify→implement→마무리→룰갱신 단일 session

- 일자: 2026-05-21
- 워크트리 / 브랜치: 메인 / `002-frontend-route-scaffold`
- 관련 PR / 커밋: `a9d6c8d` (구현) + `fa202c1` (002 회고) + `b240953` (룰 갱신)
- 단위: 002 spec 의 speckit 5 단계 + 마무리 + 룰 갱신 통합 — 단일 session
- 별개 회고: [`2026-05-21-002-frontend-route-scaffold.md`](./2026-05-21-002-frontend-route-scaffold.md) (002 구현 영역 중심)

본 회고는 **워크플로우·인터뷰·메타 측면** 에 집중. 코드/산출물 사실은 002 회고 (`-frontend-route-scaffold.md`) 가 SoT.

## 1. 무엇을 했는가 (사실 — 워크플로우 단위)

1. `/speckit-specify` 진입 시 사용자 발언과 실제 코드베이스 갭 발견 — "와이어프레임만" 발언 vs commit `acd7d3e` (Phase 1A backend foundation 완료)
2. 사용자 본질 질문 4 옵션 (A 검증 트랙 / B Week 1B 인증 / C 프론트 라우트 스케폴드 / D 기타) 송출 → 사용자 "C" 답변
3. C 범위 모호 → C-1 (인증만, Phase 분해 SoT 정합) / C-2 (전체 wireframe 1회) / C-3 (다른) 송출 → 사용자 "C-2"
4. `/speckit-specify` 진행 — short name `frontend-route-scaffold`, `before_specify` hook 자동 실행 (`002-frontend-route-scaffold` 브랜치 생성), spec.md 작성
5. `/speckit-clarify` 진행 — 5 ambiguity 질문 순차 (PoC 처리 / 인증 라우팅 / 작성 모드 / H0 진입점 / 1:1 측정) → 사용자 letter (B/C/A/A/B) 답변 → spec.md Clarifications + FR 갱신
6. `/speckit-plan` 진행 — plan.md + research.md + data-model.md + contracts/×2 + quickstart.md 작성 + CLAUDE.md/AGENTS.md SPECKIT 마커 갱신
7. `/speckit-tasks` 진행 — 57 task / 7 phase 분해 (Setup 5 + Foundational 19 + US1 15 + US2 5 + US3 4 + US4 3 + Polish 6)
8. `/speckit-implement` 진행 — `pnpm install` 누락 발견 → install → Phase 1~5 일괄 진행 (사용자 "A" / "진행" / letter 응답으로 phase 단위 cadence) → Phase 3 build fail 발견 → 4 파일 `'use client'` fix → 최종 21 static page GREEN
9. Phase 6/7 분리 — 자동화 가능 (T052/T055/T056/T057) 진행 + dogfooding 5 (T049/T050/T051/T053/T054) 사용자 영역 인계
10. 마무리 — commit `a9d6c8d` (구현 단일) + 회고 작성 + commit `fa202c1` (회고)
11. 룰 갱신 — 회고 §5-2 의 3 후보 사용자 "A" 채택 → 룰 파일 2 종 갱신 + commit `b240953`

## 2. 어떻게 했는가 (워크플로우 / 인터뷰 cadence)

### Speckit 직렬 진행

5 단계 (`specify → clarify → plan → tasks → implement`) 모두 한 session 안에서 직렬 진행. 각 단계 종료 시점에 산출물 + 다음 단계 옵션 제시 + 사용자 컨펌 cadence.

### 인터뷰 cadence

- 매 결정 분기 시점에 옵션 표 (A/B/C/D + Short) + Recommended + Default 명시 → 사용자가 letter 답변 또는 "진행" / "이어서해줘" / "마무리" 등 모멘텀 응답
- 본 session 약 12~15 결정 분기 (specify 진입 C-2 → clarify 5 → plan 진입 / 옵션 A or B → implement phase 1~5 각 진입 → 마무리 commit/회고 / 룰 갱신 후보 채택 등)
- 사용자 stop 신호 0 회 — `잠깐만 / 왜 ~ 했어? / step N 다시 봐 / ~ 인거 맞아?` 0

### Subagent dispatch 0 회

`subagent-delegation-cost.md` §"Dispatch 전 의사결정 게이트" 적용:
- Q1 LOC > 200? — YES (수천 LOC)
- Q2 추측 위험 큰 영역? — 일부 (다크 모드 / 폰트 / server-client 경계) but 검증 가능
- Q3 백그라운드 / 병렬 이득? — NO (단일 개발자 + 사용자 단계별 진행 의지)
- → 직접 구현 정합. orchestrator 직접 Edit + Bash 진행.

### Phase 일괄 vs 분리 결정

- Phase 1 (5 task) / Phase 2 (19 task) / Phase 3 (15 task) / Phase 4+5 (9 task) / Phase 6+7 (자동화 4) 각각 한 turn 일괄 진행
- Phase 분리 옵션 (A 일괄 / B 작게 분리) 송출 후 사용자 결정 cadence
- 사용자 "A" 일괄 응답 패턴 → 단계 진행 모멘텀 유지

## 3. 잘 된 점

1. **Speckit 5 단계의 산출물 누적이 다음 단계의 SoT** — clarify §Q1~Q5 결정이 plan §"라우트 결정" 으로 재인용, plan 의 Project Structure 가 tasks 의 file path 1:1 매핑, tasks 의 task 가 implement 의 작업 순서 → 5 단계 사이 회귀 0
2. **사용자 letter 응답 + Default 명시 cadence 가 모멘텀 보존** — letter 1~2 글자 응답으로 12+ 결정 진행. Default 명시 덕분에 사용자 무응답 / "진행" / "이어서해줘" 응답에 자연 진행 가능
3. **Subagent dispatch 0 회 + 직접 진행 으로 ~25,000 토큰 × N 절약** — 본 spec 의 단일 BC + 단일 워크트리 + 단계별 진행 의지 정합에 맞춰 직접 진행 선택, multi-round-implementation 룰의 "위임 자동화 안티패턴" 회피
4. **회고 + 룰 갱신 통합 cadence** — 002 회고 (`fa202c1`) 직후 회고 §5-2 의 3 후보 사용자 "A" 채택 → `b240953` commit 으로 영구화. 회고 작성 ~ 룰 갱신 사이 회귀 0 / 컨텍스트 휘발 없음
5. **자동화 영역 vs 사용자 dogfooding 영역 명시 분리** — Phase 6 의 다크 모드 19 surface 일관 / 시스템 테마 / placeholder query / wireframe 1:1 / PWA 5 task 를 본 spec close 의 사용자 영역으로 명시 + `02-progress.md` 트랙 A 박음. 본 session 무리 진행 회피.

## 4. 어긋난 점

### 4-1. 사용자 stop 신호 0 회 — 동시에 인터뷰 cadence 점검 누락

본 session 약 12~15 인터뷰 송출. stop 신호 0 회는 잘된 점이지만, 동시에 **사용자 입장에서 본질 질문이 정확했는지 사후 점검 부재**. letter 답변 cadence 가 빠르다고 다 좋은 인터뷰는 아님 — Default 가 명확해서 letter 응답이 자연 흐름이었던 것인지, 메뉴 강요라서 사용자가 빠르게 끝내려고 그랬는지 구분 어려움.

회피 가능했던 시점: 매 인터뷰 직후 self-check 만으로 충분하지 않고, **session 마무리 시점에 인터뷰 cadence 자체의 메타 점검** 가치 있음. 본 메타 회고가 그 역할.

### 4-2. `pnpm install` 누락 발견은 implement 진입 시점

`/speckit-implement` 진입 후 `node_modules` 부재 발견 → install 실행. plan / quickstart 단계에서 명시 가능했던 사전 조건. quickstart.md §0 "사전 조건" 에 박았지만 implement 시점까지 실제 install 상태 검증 미수행.

회피 가능했던 시점: plan 단계의 Constitution Check 에 "`pnpm install` 완료 상태 검증" gate 박을 수 있었음. 단 본 spec 의 영향은 작음 (install 자동화로 ~3분 비용만).

### 4-3. `frontend/AGENTS.md` 의 정독 경로 부재는 implement 시점에 발견

이미 002 회고 §4-2 박힘. 본 메타 회고에서 재인용: **본질 정의 문서 정합성 검증** 룰 (방금 룰 갱신으로 `agent-workflow-discipline.md §5` 박힘) 이 본 session 의 회귀 신호에서 직접 도출. 본 룰을 더 이른 단계 (specify 의 사용자 의도 갭 발견 시점) 에 적용했으면 본 session 의 cadence 더 명확.

### 4-4. Phase 6/7 의 dogfooding 영역 cadence 의 모호함

본 spec close 의 정의가 약함:
- 자동화 검증 영역 (T052/T055/T056) 완료 → 본 spec MVP close 가능?
- dogfooding 5 영역 완료 → 본 spec 완전 close?
- 본 session 에서는 자동화 영역까지 진행 후 사용자 영역 인계, 단 spec 의 SC-001~009 일부 (SC-002 1:1 시각 / SC-003 다크 모드 일관 / SC-004/5 가드 동작 / SC-009 PWA) 는 dogfooding 시점 검증 필요
- spec 의 "성공" 기준이 자동화 영역까지인지 dogfooding 까지인지 명시 부재

회피 가능했던 시점: spec.md 의 Success Criteria 작성 시점에 SC 별로 "자동화 가능 / dogfooding 필요" 분류 박았더라면 close 정의 명확.

### 4-5. 토큰 / 시간 정량 측정 미수행

본 session 누적 도구 호출 횟수 / 입출력 토큰 / 시간 정량 측정 0 회. 추정:
- 도구 호출: ~120~150 회
- 입출력 토큰: ~200,000~300,000
- 시간: 약 4~6 시간 (사용자 응답 대기 포함)
- subagent dispatch 0 → 추가 비용 절약 ~25,000 × N

다음 동급 작업 시 정량 측정 의무.

### 4-6. Wireframe 정확 정독 deferred — close 시점에 명시 부재

`wireframe.html` 의 정확한 HTML/CSS px / gap / radius / margin 값 정독은 본 session 미수행 (002 회고 §4-5 박힘). 메타 측면: spec/plan 단계에서 wireframe 정확 정독을 "deferred to dogfooding" 으로 명시했지만 dogfooding 영역 (T053) 의 작업량 / fix iteration 수 추정 0. **deferred 결정의 비용 부재** — 다음 session 의 dogfooding cycle 비용 예측 불가.

## 5. 다음 작업에 남길 교훈

### 5-1. 작업별 교훈 (이 프로젝트 한정)

1. **Spec 의 Success Criteria 작성 시 자동화 / dogfooding 분류 명시** — SC-001 (19 surface 진입 가능, 자동화 가능) / SC-002 (1:1 시각, dogfooding) / SC-003 (다크 모드 일관, dogfooding) ... 분류로 close 정의 명확화
2. **`pnpm install` / `./gradlew build` 등 빌드 게이트 사전 검증 gate 를 plan 의 Constitution Check 에 명시** — implement 진입 시 환경 누락 발견 회피
3. **Deferred 결정 시 비용 예측 박음** — 본 spec 의 wireframe 정확 정독 deferred 처럼, deferred 결정에는 "후속 cycle 의 예상 작업량 / 시간 / iteration 수" 1줄 박음
4. **본 session 의 토큰 / 시간 정량 측정 의무** — 다음 동급 spec 작업 시 시작 / 종료 시점 metrics 캡처 (대략 도구 호출 수 + 시간 + subagent 위임 횟수). 정량화 영구화

### 5-2. 룰 갱신 후보 (사용자 컨펌 필요)

본 메타 회고에서 surfacing 한 룰 갱신 후보. **사용자 컨펌 전까지 룰 파일 수정 금지.**

#### 후보 1 — Spec Success Criteria 의 검증 분류 명시 룰

- **갱신 대상**: 본 프로젝트 `.claude/rules/shared/agent-workflow-discipline.md` 또는 (글로벌) `~/.claude/rules/shared/user-interview-quality.md`
- **추가 룰 본문**:
  > ### Spec Success Criteria 의 검증 분류 의무
  > spec.md 의 Success Criteria 작성 시 각 SC 항목에:
  > - 검증 mechanism (자동화 빌드/린트/grep / dogfooding 육안·iOS·Android / 사용자 환경)
  > - 검증 시점 (spec close 전 의무 / spec close 후 별도 cycle / V1 출시 전)
  > 1줄 명시. spec close 정의를 SC 별로 분기 가능하게.
- **근거 회귀 사례**: 본 메타 회고 §4-4 — 002 spec 의 SC 가 close 정의 모호, dogfooding 영역 cadence 인계 시 비용 추정 부재

#### 후보 2 — Deferred 결정의 비용 예측 의무 룰

- **갱신 대상**: 본 프로젝트 `.claude/rules/shared/agent-workflow-discipline.md`
- **추가 룰 본문**:
  > ### Deferred 결정의 후속 비용 예측 의무
  > "본 spec 영역 밖", "Phase 7 polish 에 보강", "후속 phase 합류 예정" 등 deferred 결정 시:
  > - 후속 cycle 의 예상 작업량 (LOC / 파일 수 / task 수) 1줄
  > - 예상 iteration 횟수 (fix 횟수 / 사용자 확인 cycle 수)
  > - close 정의가 변할 가능성 (deferred 영역이 본 spec close 정의에 영향?)
  > 명시. 비용 예측 부재 시 다음 cycle 진입 시점에 사용자가 "이게 얼마나 걸리는지" 추측해야 함.
- **근거 회귀 사례**: 본 메타 회고 §4-6 — wireframe 정확 정독 deferred 결정에 비용 예측 부재. T053 dogfooding 영역의 fix iteration 수 미지

#### 후보 3 — Session 마무리 시점에 토큰/시간/dispatch 정량 측정 룰

- **갱신 대상**: `.claude/skills/retrospective/SKILL.md` (회고 양식 자체 갱신) 또는 `~/.claude/rules/shared/subagent-delegation-cost.md` §"사후 자동 회고 트리거"
- **추가 룰 본문**:
  > ### Session 마무리 정량 측정 의무
  > 회고 §1 "무엇을 했는가" 또는 §4 "어긋난 점" 의 마지막에:
  > - 도구 호출 횟수 (대략)
  > - 입출력 토큰 (대략)
  > - 작업 시간 (시작~종료)
  > - Subagent dispatch 횟수
  > 4 항목 박음. 측정 정확도 낮아도 정량화 자체가 다음 session 의 cadence 결정 근거.
- **근거 회귀 사례**: 본 메타 회고 §4-5 — 002 session 의 토큰 / 시간 / 호출 정량 0 회. 다음 session cadence 결정 근거 부재

---

## 메타 — 본 회고의 위치

본 메타 회고는 002 spec 의 implementation 영역 회고 (`2026-05-21-002-frontend-route-scaffold.md`) 와 **별개 단위**.

- 002 회고: implementation 영역 (코드 / 산출물 / 추측 차단 / 룰 갱신 후보 3 건)
- 본 메타 회고: **워크플로우 단위** (speckit cadence / 인터뷰 / 결정 분기 / 토큰·시간 메타)

두 회고 모두 SoT 인용:
- `~/.claude/rules/...` (글로벌 룰)
- `.claude/rules/...` (본 프로젝트 룰)
- `~/.claude/skills/retrospective/SKILL.md` 또는 `.claude/skills/retrospective/SKILL.md` (본 프로젝트 회고 스킬)
- `docs/plan/02-progress.md` 의 누적 진척

본 메타 회고 §5-2 의 3 후보는 002 회고 §5-2 의 3 후보 (사용자 채택 → `b240953` 박힘) 와 별개의 신규 후보. 사용자 컨펌 받으면 영구화.
