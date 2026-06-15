# CLAUDE.md

본 프로젝트에서 Claude 작업 시 따를 지침.

## 프로젝트 개요

컨텍스트가 안 죽는 작가용 작업공간. 메모와 글쓰기 에디터가 같은 시스템에 살면서, 세션이 끊겨도 컨텍스트가 영속하게 만드는 사이드 프로젝트.

V1 wireframe 완료 + 구현 진행 중 — 001 Phase 1A Backend Foundation / 002 Frontend Route Scaffold (자동화 GREEN, dogfooding 대기) / 003 Phase 1B Backend Auth / 004 Phase 2 Backend Project Metadata & Character 종료. 다음 진입 = 005 Phase 2 Frontend Views (홈 view / 새 프로젝트 흐름 / 메타 카드 UI / 등장인물 페이지).

## 외부 SoT — 옵시디언 vault (HARD-GATE)

본 repo 의 **진척·이슈·개요는 외부 vault** 에 상위 SoT 가 박혀있다. 브랜치 무관 단일 진입점 — 본 repo 내 `docs/plan/02-progress.md` 같은 브랜치 종속 문서가 여러 워크트리에서 누락·conflict 나는 문제를 우회한다.

- vault 경로: `~/obsidian/write-note/`
- 노트 구성:
  - `00-INDEX.md` — 단일 진입점 + 본 repo 와의 역할 분리 정책
  - `01-OVERVIEW.md` — 본질·기술 스택·프로젝트 구조·워크플로우 (본 repo 인용 요약)
  - `02-PROGRESS.md` — Phase 단위 진척도 (브랜치 무관 요약)
  - `03-ISSUES.md` — 이슈 트래킹 (발견·우선순위·후속)

### 본 repo 와의 역할 분리

| 정보 | SoT |
|---|---|
| 본질 / 스택 / Phase 분해 / 백엔드 요구사항 | 본 repo `DESIGN.md` / `docs/plan/00~03` |
| 브랜치 내 상세 진척 | 본 repo `docs/plan/02-progress.md` |
| Phase 별 spec/plan/tasks | 본 repo `specs/NNN-.../` |
| 회고 / PoC 결과 | 본 repo `docs/retrospectives/` / `docs/poc/` |
| **Phase 단위 요약 진척 (브랜치 무관)** | **vault `02-PROGRESS.md`** |
| **이슈 트래킹** | **vault `03-ISSUES.md`** |
| **외부 진입점 (개요)** | **vault `01-OVERVIEW.md`** |

**충돌 시:** 본 repo SoT 가 우선. vault 는 갱신 의무 (vault 가 본 repo 를 인용·요약·링크하는 구조).

### Claude 참조·갱신 의무

| 시점 | 액션 |
|---|---|
| 세션 진입 / "어디까지?" 류 진척 질문 | vault `02-PROGRESS.md` 우선 Read (브랜치 무관 진척) |
| 이슈 발견 / 보류 결정 surfacing | vault `03-ISSUES.md` 신규 entry 작성 |
| Phase 완료 / PR merge 직후 | vault `02-PROGRESS.md` §완료 Phase 추가 + §현재 진입점 갱신 |
| 본 repo `docs/plan/02-progress.md` 갱신 시 | vault `02-PROGRESS.md` 동기 (요약·링크) |
| 기술 스택 / 본질 결정 변경 시 | vault `01-OVERVIEW.md` 갱신 |

**self-check (HARD-GATE):** 진척·이슈 정보 답변 전 vault 4 노트 중 관련 노트 Read 의무. 본 repo `docs/plan/02-progress.md` 만 읽고 답하면 브랜치 종속 정보로 단정할 위험.

## 기술 스택

기술 스택의 SoT 는 [docs/plan/00-stack-and-schedule.md §2-1](./docs/plan/00-stack-and-schedule.md) 이다. 본 표는 요약.

| 레이어 | 기술 |
|---|---|
| 프론트 | Next.js 16.2.6 (App Router) + TypeScript 5.9 + React 19.2 |
| 에디터 | TipTap |
| 상태 관리 | React Query (서버 데이터) + Zustand (로컬 UI) |
| 백엔드 | Kotlin 2.2 + Spring Boot 4.0.6 (Web + Security + Data JPA + Validation) on Java 24 toolchain (시스템 Corretto 25) |
| 빌드 | Gradle (Kotlin DSL) |
| DB | PostgreSQL (Supabase Postgres 의 DB 만 사용) |
| 인증 | Spring Security + JWT + Kakao OAuth2 |
| 모바일 캡처 | iOS Shortcut → `POST /api/capture` (사용자별 long-lived API token) |
| 프론트 호스팅 | Vercel |
| 백엔드 호스팅 | Render |
| 코드 품질 | ktlint + Checkstyle |

## 스크립트

| 용도 | 명령어 |
|---|---|
| local DB | `docker compose up -d --wait postgres` |
| backend test | `cd backend && ./gradlew test` |
| backend verify | `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build` |
| backend boot | `cd backend && ./gradlew bootRun --args='--spring.profiles.active=local'` |

## 안전 가드레일 (HARD-GATE)

- 외부 데이터 스토어 (DB / redis) 쓰기·민감 정보 재사용 룰: [.claude/rules/infra/external-infra-safety.md](.claude/rules/infra/external-infra-safety.md)
  - 쓰기 (`INSERT/UPDATE/DELETE/DROP/TRUNCATE/ALTER` 등 / redis `SET/DEL/FLUSHDB` 등) 는 사용자 명시 컨펌 필수
  - `.env*` Read / `DATABASE_URL` 등 시크릿 환경변수 echo / 이전 세션 자격증명 재투입 금지

## 에이전트 작업 규율 (HARD-GATE)

- 의사결정·인터뷰·subagent 위임 품질 룰: [.claude/rules/shared/agent-workflow-discipline.md](.claude/rules/shared/agent-workflow-discipline.md)
  - 추측 영역 발견 시 옵션 비교 표 작성 **이전** 검증 위임 의무
  - "(권장)" 마크 부착 직전 가능성·검증 정보 self-check 의무
  - 작업 트랙 누적 시 "기존 N 보류 / 신규 M 진행" 명시 트랜잭션 분기 보고
  - Subagent dispatch prompt 체크리스트 (verbose 통제 / tool_uses cap / 안전 장치) 자동 적용

## 사용자 인터뷰 지침 (HARD-GATE)

명세 명확화 / 의사결정 / 컨펌을 사용자에게 송출하기 **직전** 의무.
본 지침의 근본 전제: 사용자가 본 인터뷰의 전후 문맥 / 코드베이스 세부 구현 / 본 도메인의 약어와 축약 표현을 **모르는 상태로 진입**한다고 항상 가정한다 (사용자가 "익숙한 영역이니 짧게 가도 OK" 명시 컨펌 전엔 풀어쓰기 default).

1. **결정의 전후 문맥 명시 의무**
   - 인터뷰 텍스트마다 (a) 무엇을 결정해야 하는가 한 줄, (b) 왜 지금 본 결정이 필요한가 (이전 작업의 어떤 산출물 / 다음 작업의 어떤 진입점이 본 결정에 의존하는지), (c) 결정 후 어떤 흐름으로 이어지는지 명시
   - 사용자가 "내가 지금 왜 이걸 결정해야 하지?" 의문 갖는 인터뷰는 송출 금지 — 의도 surfacing 박은 후 송출

2. **약어 / 축약 표현 금지 — 1회 풀어쓴 후 사용은 OK**
   - 메소드 / 필드 / 클래스 / 함수명 / DB 컬럼 인용 시 **그 값이 어떤 목적의 값인지 인라인 정의 의무**. 예: `createdAt` 단독 인용 X → "`createdAt` (entity 생성 시각, DB DEFAULT NOW() 채움)" 박음
   - 본 프로젝트 도메인 용어 (`BC`, `SoT`, `vault`, `phase`, `dogfooding` 등) 도 첫 사용 시 풀어쓰기. 같은 인터뷰 안에서 2회차부터 약어 OK

3. **선택지 = 전후 문맥 + 영향 범위 + default 의무**
   - 옵션·선택지마다 (a) 전후 문맥 1줄, (b) 선택 시 영향 범위 (어떤 파일 / 어떤 동작 / 어떤 비용·시간), (c) 무응답 시 진행할 default 명시
   - 메뉴 강요 (A1~An 일괄 컨펌) 대신 본질 질문 1~2개로 압축 가능한지 self-check. 압축 가능하면 메뉴 X

4. **기술 설정값 선택지 = 설정의 의미·효과 풀어쓰기 의무**
   - boolean flag / mode / 옵션값 (예: `sandbox`, `contextIsolation`, `readOnly`, cascade 전략, 로그 레벨) 을 선택지로 묻기 **직전**, 각 설정이 **무엇을 켜고/끄는지 + 그 효과**를 옵션 description 또는 본문에 최소 1줄씩 박는다. 값 (true/false · A/B) 만 나열하고 의미를 사용자가 모른 채 고르게 두지 않는다.
   - 사용자가 적극 검증하기 어려운 메타 영역 (프레임워크 내부 동작 / 보안 격리 수준 / 인프라 설정) 일수록 의무. 항목 2 (약어 풀어쓰기) · 3 (영향 범위) 의 기술 설정값 특화.
   - **회귀 사례 (2026-06-03 Desktop Phase 1):** Electron `sandbox` 값을 `contextIsolation` (preload↔웹페이지 JS 컨텍스트 분리) / `nodeIntegration` (renderer 의 Node API 직접접근) / `sandbox` (renderer OS 커널 격리) 의 의미 없이 true/false 만 제시 → 사용자가 질문 거부 + "각각 어떤 설정이고 무슨 효과인지 정확하게 설명해" 재요구. 회피 가능 시점 = 첫 질문 작성 시 세 설정의 의미를 1줄씩 박았어야.

상세 SoT: 글로벌 [`~/.claude/rules/shared/user-interview-quality.md`](file:///Users/jongwan-air/.claude/rules/shared/user-interview-quality.md) — 본 섹션은 본 프로젝트 한정 보강이며, 글로벌 룰의 self-check 와 함께 적용.

## 작업 실행 지침 (HARD-GATE)

### 빌드 / 테스트 = 포어그라운드 실행 의무

`./gradlew test`, `./gradlew build`, `pnpm build`, `pnpm test`, `pytest` 등 **빌드 / 테스트 명령은 포어그라운드 (Bash 도구의 `run_in_background=false`) 로 실행** 의무.

**근거**:
- 빌드 / 테스트 결과 (GREEN/RED / 회귀 발견 / 빌드 fail 메시지) 는 본 작업의 **본질 결정 신호** — Claude 가 직접 확인 후 다음 단계 진입 결정 의무
- 백그라운드 실행 시 (a) Claude 가 결과 미확인 채 다음 진입 → 회귀 silent 누적 (b) 세션 lock / 무한 wait 위험 (TestContainers 재시도 / 자동 retry 루프 / 환경 문제로 인한 hang)

**금지**:
- 빌드 / 테스트를 `run_in_background=true` 로 실행 후 결과 미확인 채 다음 작업 진입
- "곧 끝나겠지" 추측으로 다음 단계 진행
- 백그라운드 실행 후 `sleep` polling 으로 회피

timeout / cap 룰은 글로벌 [`~/.claude/rules/shared/long-running-bash.md`](file:///Users/jongwan-air/.claude/rules/shared/long-running-bash.md) 와 정합.

## 회고 스킬

- 작업 마무리 시점 5축 회고: [.claude/skills/retrospective/SKILL.md](.claude/skills/retrospective/SKILL.md)
  - 회고 §5-2 "룰 갱신 후보" 가 `agent-workflow-discipline.md` 의 누적 입력

<!-- SPECKIT START -->
Current implementation plan:

- [024 자체 에디터 엔진 1라운드 — B형 집필실 수직 슬라이스(구조). TipTap(CSS column-wrap)→자체 EditContext 엔진 교체의 첫 라운드. 신규 전용 라우트에 자체 엔진을 꽂아 프레시 테스트 챕터에 문단·제목(H1~3) 쓰기→자동저장→재로드+줄단위 페이지분할을 실환경 검증. 디스크는 PM JSON(bodyJson) 유지·경계 양방향 변환(자동저장016/버전토큰/충돌 무수정 재사용). PoC 순수 자산(geometry/layoutEngine/measure) 승격 + 블록속성(heading) 동기 + undo/plain paste. B형 셸(BStudioShell 추출)·ChapterList·BWorkSidePanel 재사용, 아웃라인은 TipTap 인스턴스 탈피 엔진 파생. 마크/리스트/완전대체/Safari=후속 라운드. 백엔드 변경 0](specs/024-custom-editor-r1/plan.md)
- [022 챕터 (Chapter) — 작품 1:N 본문 구조. 기존 documents 테이블 1:N 확장(project_id UNIQUE 제거 + sort_order·deleted_at, V14 마이그레이션, 기존 본문 무손실 1번 챕터). 챕터 목록/생성/순서/soft-delete/복구 5 endpoint + 마지막 챕터 가드(409 LAST_CHAPTER_UNDELETABLE) + 카드 합산 집계. FE A형·B형 집필실 좌패널 챕터 목록·전환(?chapter, 016 세션 재사용). Round 2.5, export(Round 3) 선행](specs/022-chapters/plan.md)
- [019 Round 1 스키마 확장 — 곁쪽지 삭제/되돌리기(soft-delete deleted_at·restore·연결행 보존) + 설정 서버 영속(user_settings key-value·테마/작성모드/원고지크기) + 등장인물 확장(age·gender·traits·Rail 진입). 마이그레이션 V9~V11 로컬 dev 한정](specs/019-round1-schema-extensions/plan.md)
- [017 집필실 3단 (Studio 3-panel) — [아웃라인 | 원고 | 인물+곁쪽지] 3열. 아웃라인=heading 클라이언트 파생 TOC(점프+하이라이트), 인물=기존 API 보기+빠른추가, 곁쪽지=MemoPanel 불변. 백엔드 변경 0](specs/017-studio-three-panel/plan.md)
- [016 자동저장 재설계 — 로컬 우선 보존(localStorage draft) + 수정시각(updatedAt 겸용) @Version 버전 토큰. 거짓 409 충돌 근본 해결 + 작성분 복구 + 비동기 공동집필 토대](specs/016-autosave-localstorage-redesign/plan.md)
- [015 Web 포팅 — Front 이식 (desktop 화면 → Next.js, electronAPI→fetch, projects 풀스택 먼저 + 페이지분할/한글 PoC 선증명)](specs/015-web-port-frontend/plan.md)

For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan above.
<!-- SPECKIT END -->
