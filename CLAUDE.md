# CLAUDE.md

본 프로젝트에서 Claude 작업 시 따를 지침.

## 프로젝트 개요

컨텍스트가 안 죽는 작가용 작업공간. 메모와 글쓰기 에디터가 같은 시스템에 살면서, 세션이 끊겨도 컨텍스트가 영속하게 만드는 사이드 프로젝트.

V1 wireframe 완료, 구현 진입 전.

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
| test | (미정) |
| build | (미정) |
| boot | (미정) |

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
