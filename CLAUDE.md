# CLAUDE.md

본 프로젝트에서 Claude 작업 시 따를 지침.

## 프로젝트 개요

컨텍스트가 안 죽는 작가용 작업공간. 메모와 글쓰기 에디터가 같은 시스템에 살면서, 세션이 끊겨도 컨텍스트가 영속하게 만드는 사이드 프로젝트.

V1 wireframe 완료, 구현 진입 전.

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

## 회고 스킬

- 작업 마무리 시점 5축 회고: [.claude/skills/retrospective/SKILL.md](.claude/skills/retrospective/SKILL.md)
  - 회고 §5-2 "룰 갱신 후보" 가 `agent-workflow-discipline.md` 의 누적 입력

<!-- SPECKIT START -->
Current implementation plan:

- [Phase 2 Backend — Project Metadata & Character CRUD](specs/004-phase-2-backend-project-character/plan.md)

For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan above.
<!-- SPECKIT END -->
