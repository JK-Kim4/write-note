# write-note

컨텍스트가 안 죽는 작가용 작업공간.

취미로 소설·단막극·시를 쓰는 사람들이 일상의 영감과 글쓰기 세션 사이에서 잃어버리는 *맥락*을 살려주는 사이드 프로젝트. 메모와 글쓰기 에디터가 *같은 시스템*에 살면서, 세션이 끊겨도 컨텍스트가 영속하게 만드는 것이 목표.

## 문서

- [DESIGN.md](./DESIGN.md) — 설계 문서, UI/UX 결정, 디자인 시스템 컴포넌트
- [docs/plan/00-stack-and-schedule.md](./docs/plan/00-stack-and-schedule.md) — 기술 스택 SoT + 일정 + 보류 결정
- [docs/plan/01-phase-breakdown.md](./docs/plan/01-phase-breakdown.md) — Week → Phase 분해 (총 56 Phase)
- [designs/wireframe.html](./designs/wireframe.html) — 인터랙티브 wireframe (메인 9개 view + 인증 12개 패널)

## 상태

🟢 Week 1A Backend Foundation (001) + Week 1B Backend Auth (003 — Spring Security + JWT + Kakao OAuth2 + 이메일/비밀번호 로그인 + 5회 실패 잠금 + 비밀번호 재설정) + Week 2 Backend Project Metadata & Character (004 — Project 메타 5 필드 + Document auto-provisioning + Character CRUD 5 endpoint + Character reorder) 종료. 다음 = Week 2 Frontend Views (005 — 홈 view / 새 프로젝트 흐름 / 메타 카드 UI / 등장인물 페이지).

🟡 002 Frontend Route Scaffold — 자동화 GREEN / dogfooding 5 영역 대기 (vault ISSUE-001).

## 디렉토리

```
write-note/
├── frontend/           Next.js 16 (App Router + TS + Tailwind)
├── backend/            Spring Boot 4.0.6 (Kotlin + Gradle Kotlin DSL)
├── docs/plan/          기술 스택 + Phase 분해
├── designs/            wireframe.html
├── DESIGN.md           본질 + UI/UX 결정
└── docker-compose.yml  로컬 인프라 (Postgres 17)
```

## 기술 스택 (요약, 상세는 [docs/plan/00-stack-and-schedule.md §2-1](./docs/plan/00-stack-and-schedule.md) 참조)

| 레이어 | 기술 |
|---|---|
| 프론트 | Next.js 16 (App Router) + TypeScript + React 19 + Tailwind 4 |
| 에디터 | TipTap |
| 백엔드 | Kotlin 2.2 + Spring Boot 4.0.6 on Java 24 toolchain (Web + Security + Data JPA + Validation + Flyway) |
| 빌드 | Gradle Kotlin DSL (gradlew wrapper 포함) |
| DB | PostgreSQL 17 (로컬 docker, 프로덕션 Supabase Postgres) |
| 인증 | Spring Security + JWT + Kakao OAuth2 |
| 모바일 캡처 | iOS Shortcut → `POST /api/capture` |
| 호스팅 | Vercel (FE) + Render (BE) + Supabase (DB) |

## 로컬 개발 환경

### 사전 요구사항

- Node.js 20+ / pnpm 8+
- Java 24 (Gradle toolchain). 시스템 Corretto 25 이상이면 OK — Gradle 이 toolchain 24 로 자동 처리
- Docker 28+ — Postgres 컨테이너
- Spring Boot 빌드는 backend/ 의 `./gradlew` wrapper 사용 (시스템 gradle 불필요)

### 실행 순서

```bash
# 1. Postgres 컨테이너 기동
docker compose up -d --wait postgres

# 2. 백엔드 (호스트 직접 실행)
cd backend
./gradlew bootRun --args='--spring.profiles.active=local'  # 8080 포트

# 3. 프론트 (호스트 직접 실행, 새 터미널)
cd frontend
pnpm install                 # 첫 회만
pnpm dev                     # 3000 포트, http://localhost:3000
```

### 백엔드 검증

```bash
cd backend
./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build
```

### 서비스 종료

```bash
docker compose down          # Postgres 컨테이너 정지 + 네트워크 정리
docker compose down -v       # 볼륨까지 삭제 (DB 데이터 날아감)
```

## 브랜치 전략

정통 git flow (Vincent Driessen 모델) + 워크트리 격리.

| 브랜치 | 역할 |
|---|---|
| `main` | production-released 만 (현재: V1 출시 전이라 기획 산출물만) |
| `develop` | 다음 release 준비 (integration target) |
| `feature/*` | 신규 기능 (develop → feature → develop merge), 워크트리 격리 의무 |
| `release/*` | V1 출시 직전 안정화 (발생 시점 생성) |
| `hotfix/*` | production 긴급 fix (발생 시점 생성) |
