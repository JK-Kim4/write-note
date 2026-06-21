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
| DB | PostgreSQL (OCI Compute self-managed) |
| 인증 | Spring Security + JWT + Kakao OAuth2 |
| 모바일 캡처 | iOS Shortcut → `POST /api/capture` (사용자별 long-lived API token) |
| 프론트 호스팅 | Vercel |
| 백엔드 호스팅 | OCI Compute (self-managed) |
| 코드 품질 | ktlint + Checkstyle |

## 스크립트

### Backend (`backend/`, Gradle)

| 용도 | 명령어 |
|---|---|
| local DB | `docker compose up -d --wait postgres` |
| backend test | `cd backend && ./gradlew test` |
| backend verify | `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build` |
| backend boot | `cd backend && ./gradlew bootRun --args='--spring.profiles.active=local'` |

### Frontend (`frontend/`, pnpm — **cwd=`frontend/` 고정 의무**)

> ⚠️ frontend 명령은 반드시 `frontend/` 디렉토리에서 실행한다. repo 루트에서 vitest 실행 시 `vitest.config.ts`(jsdom 환경) 미적용 → `document is not defined` 로 테스트가 깨진다. 커밋용 `cd` 로 루트 이동 후 후속 명령의 cwd 재확인.

| 용도 | 명령어 |
|---|---|
| deps 설치 | `cd frontend && pnpm install` |
| dev 서버 | `cd frontend && pnpm dev` (→ http://localhost:3000) |
| test (전체) | `cd frontend && pnpm test` (= `vitest run`) |
| test (단일 파일) | `cd frontend && npx vitest run <파일경로>` |
| lint | `cd frontend && pnpm lint` |
| typecheck | `cd frontend && pnpm typecheck` (= `tsc --noEmit`) |
| build (RSC 경계 검출) | `cd frontend && pnpm build` — server/client 경계 위반은 lint 가 아닌 **build 에서만** 검출 (typescript/code-quality §RSC 경계) |
| frontend verify | `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build` |

## 배포 환경

배포·인프라 상세 SoT = [docs/plan/04-web-launch-v1-plan.md](./docs/plan/04-web-launch-v1-plan.md) Round 4 + [docs/plan/00-stack-and-schedule.md §2-3](./docs/plan/00-stack-and-schedule.md). 브랜치 종속·유동 정보이므로 본 절은 요약이며, 충돌 시 SoT 우선.

### 호스팅 (2026-06-16 OCI 전환)

| 대상 | 환경 |
|---|---|
| 프론트 (web 앱 `frontend/`) | Vercel (same-origin 프록시 — `/api/*` → `BACKEND_ORIGIN` rewrite) |
| 백엔드 | OCI Compute 인스턴스 (self-managed, Docker 컨테이너) |
| DB | 같은 OCI Compute 의 self-managed PostgreSQL (public 미노출, Flyway 자동 적용) |
| 데스크톱 (`desktop/`) | GitHub Releases — `v*` 태그 push 시 `.github/workflows/release.yml` 이 네이티브 러너에서 dmg/exe 빌드·게시 |
| 다운로드 페이지 (`download-site/`) | Vercel 정적 배포 (Production Branch = `main`, Root = `download-site`) — 데스크톱 설치파일 안내. **웹 앱과 분리** |

> Render(백엔드)·Supabase(DB)는 2026-06-16 폐기. 도메인 = soseolbi.com 확보(2026-06-21, 위 인프라 구성 참조).

### 브랜치 모델 (README §"브랜치 전략")

| 브랜치 | 역할 |
|---|---|
| `main` | **웹 앱 production 코드베이스**(2026-06-21 `develop→main` 승격, `7628e66`). main push → Vercel production(soseolbi.com) 자동배포 + 다운로드 페이지 production. develop 과 동기 유지 |
| `develop` | 다음 release 통합 target. push → Vercel preview 자동배포. 작은 FE 기능은 develop 직접 작업 후 main merge |
| `feature/*` | 신규 기능, 워크트리 격리 |
| `release/*` · `hotfix/*` | 출시 안정화 / production 긴급 fix (발생 시 생성) |

### 인프라 구성 (요약 — 상세 SoT = 메모리 [[deployment-live]] + 04-web-launch-v1-plan.md)

- **도메인 = soseolbi.com** (2026-06-21 harubuild.xyz 에서 전환). **Cloudflare 경유**(GoDaddy 도메인 → Cloudflare 네임서버): 프론트 `soseolbi.com`(Vercel, Cloudflare 프록시 **OFF**), 백엔드 `api.soseolbi.com`(OCI, Cloudflare 프록시 **ON** + Origin Certificate). 구 harubuild.xyz → 308 redirect.
- **FE** = Vercel (project "write-note", team narae-note). same-origin 프록시 — `/api/*` → `BACKEND_ORIGIN`(=`https://api.soseolbi.com`) rewrite. **Root Directory=`frontend`**.
- **BE** = OCI Compute(`free-a1`, ap-seoul-1, `ssh oci`) Docker 컨테이너 + 앞단 Caddy(:443) + self-managed PostgreSQL(Docker, 로컬 전용, Flyway 자동).
- **데스크톱**(`desktop/`) = GitHub Releases(`v*` 태그 push → `release.yml`). **다운로드 페이지**(`download-site/`) = 별도 Vercel 정적 배포(Root=download-site, Production=main) — 웹 앱과 분리.

### 배포 방식 (HARD-GATE — 정상 경로 = git push 자동배포)

- **FE 재배포 = `main`/`develop` push 시 Vercel git 자동배포** (정상 경로, 2026-06-21~). **`main` push → production**(soseolbi.com alias, **무중단** immutable 배포), 기타 브랜치 push → preview. 별도 명령 불필요.
  - ⚠️ **수동 `vercel --prod` 는 비권장 — 실패한다**: Root Directory=`frontend` 설정 때문에 (a) `cd frontend && vercel --prod` → 경로 중복 `frontend/frontend` 오류, (b) repo 루트 실행 → backend·desktop 포함 repo 전체(~1GB) 업로드 → **100MB 초과 deploy_failed**. 핫픽스로 꼭 필요하면 `.vercelignore` 선행. **그냥 push 로 자동배포가 맞다.** (2026-06-21 실증 — 메모리 [[deployment-live]])
- **BE 재배포 = OCI Docker blue-green 무중단** (수동, 내가 직접 수행 가능 — 단 prod 쓰기라 사용자 컨펌 시; external-infra-safety §1). 절차: `cd backend && ./gradlew bootJar` → `scp build/libs/*.jar oci:be-build/backend.jar` → `ssh oci 'sudo bash ~/be-build/blue-green-deploy.sh'`. 상세 = 메모리 [[deployment-live]].
- **배포 순서 의존(HARD-GATE) = 방향 의존** (고정 아님 — 어느 쪽이 새 계약/요구를 도입하느냐로 결정):
  - **FE 선행 → BE 후행**: BE 가 FE 가 보내는 것을 *요구*하게 될 때. 예) `CsrfDefenseFilter` 가 쿠키 변경요청에 `X-WriteNote-Client` 헤더 요구 — BE 가 먼저 나가면 헤더 없는 기존 프론트 변경요청이 403.
  - **BE 선행 → FE 후행**: BE 가 새 계약을 받아들이게 한 뒤 FE 가 그걸 *보낼* 때. 예) settings 신규 키 — FE 가 먼저 나가면 구 BE 가 그 키 포함 PUT 전체를 400 거부.
  - **FE·BE 무관**: 한쪽만 변경(예: 본 약관 모달 = FE 단독, 백엔드 변경 0)이면 순서 무관.
- **배포 전 베이스 정합 확인(HARD-GATE)** — push/merge/배포 전 `git fetch origin && git log --oneline HEAD..origin/develop` 로 누락 커밋(특히 보안·인증·공개경로 계약) 점검. 메모리 [[branch-base-verify-before-work]].
- **§19 한계** — prod 로그인 불가 → 인증 뒤 동작(authed)은 배포해도 검증 못 함. build/test GREEN 을 authed 정합 증거로 단정 말 것. 비인증 화면은 운영 HTML 직접 확인 가능.

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

- [030 운영 툴(Admin Ops Tool) v1 — 솔로 운영자용 경량 운영 툴. 신규 Announcement 엔티티 1개(V16)로 (a) 공개 GET 2개→본 앱 홈 배너+/notice 목록·상세, (b) 별도 Next.js 어드민 앱(admin-site/, 신규 Vercel 프로젝트 Root=admin-site)에서 공지 CRUD·회원 조회(읽기전용)·통계(카운트+30일 가입추이). 관리자 인증=role 미도입, /api/admin/** 에 principal.email==ADMIN_EMAIL(env) 검사하는 커스텀 AdminAuthorizationManager(스키마 변경 0, JWT 재사용). 문의=외부 채널 링크(인앱 폼 0). 회원/통계는 기존 User/Project 읽기전용 집계·비밀값 미노출 DTO 화이트리스트. 어드민 앱은 download-site(정적)와 달리 완전한 Next 앱(빌드 필요). 단계 A(공지,P1)/B(회원,P2)/C(통계,P3) 독립배포, 단계내 BE선행→FE후행. 설계 docs/superpowers/specs/2026-06-21-admin-ops-tool-design.md](specs/030-admin-ops-tool/plan.md)
- [029 집필실 에디터 페이지 넘김 뷰 — 자체 CustomEditor 를 연속 세로 스크롤에서 "한 화면에 한 페이지"로 완전 대체. view.pages[currentPage] 한 장만 렌더(데스크탑 zoom·모바일 transform:scale 두 분기), 좌/우 큰 < > 오버레이+PageUp/Down+"n/N" 표시, 캐럿이 흘러가면 caret.pageIndex 로 currentPage 자동 전환(기존 scrollTop-follow effect 대체)·<>는 뷰 이동(캐럿 유지). 선택은 현재 페이지 내만(v1,⌘A 전체선택 유지), 목차 점프=해당 페이지 전환+캐럿. 좌표계가 절대 pageIndex 기준이라 단일 렌더에도 caretToScreen/screenToCaret/selRects 동작 보존. layoutEngine/measure/model/geometry/printLayout·백엔드·PDF export 무변경. 변경 집중=CustomEditor.tsx+pagedView.ts(신규 순수헬퍼). 자체 에디터 회귀위험 영역→dogfooding 게이트 필수(한글 IME 4케이스+캐럿/선택/페이지자동전환/목차/모바일). 028과 별도 트랙. develop 직접](specs/029-editor-paged-view/plan.md)
- [028 홈(메인) 페이지 개선 — 3가지. (US1/P1) 집필 리듬 즉시 반영: 세션 종료 후 sessions 쿼리 invalidate + 홈 weekly refetchOnMount always, 오늘 막대 날짜+"오늘" 강조, 빈 주 안내. (US1) 세션 최소시간 임계 15초→10초(application.yml; effective 15, 코드 :30 은 미발동 fallback). 빈 막대 근본원인은 구현 0단계 라이브 관찰로 확정(추측 금지). (US2/P2) 오늘 작업시간 원통형 게이지 — 기존 weekly dayMs[today] 재사용(신규 fetch 0), 채움=오늘/일일목표. 일일 목표 user_settings 신규 키 dailyGoalMinutes(이산 30/60/90/120/180/240/300, 기본60) + 설정 페이지 select. (US3/P3) 인사 부제 뒷문구 → 퍼블릭도메인 문학 인용구 무작위 회전(날짜·"안녕하세요."·저자 유지). 백엔드=application.yml 1줄+SettingsService ALLOWED 1줄, 신규 endpoint·마이그레이션 0, 배포순서 BE선행→FE후행. develop 직접 작업](specs/028-home-page-improvements/plan.md)
- [027 최초 사용자 온보딩 가이드 투어 — driver.js 스포트라이트 4단계 미니 투어(홈 단일 화면, 새 작품·메모·인물·집필). 완료/건너뛰기 시 서버 user_settings onboardingCompleted 키로 영속(기기 무관 1회). 백엔드 1줄(SettingsService ALLOWED 키 추가), FE OnboardingTour(client, driver.js 동적 import) + 대상 4곳 data-tour 표식. "다시 보기" v1 제외. BE 선행→FE 후행 배포](specs/027-onboarding-tour/plan.md)
- [026 모바일 집필 지원 (iOS 입력 + 반응형) — iOS(WebKit, EditContext 미지원)에서 자체 에디터 입력 가능 + 모바일 반응형(헤더 가로 overflow=왼쪽 슬라이드) 버그 fix. CustomEditor 입력 결합부를 InputAdapter 인터페이스로 추상화 → EditContext 어댑터(데스크탑 무회귀) + contenteditable 어댑터(iOS) 기능감지 분기. 자체 엔진 model/measure/printLayout/layoutEngine/geometry 재사용. PoC(iOS 한글 IME) 먼저 dogfood → 편집 best-effort 이식(캐럿/선택/편집키/마크/블록/undo/복붙/목차/자동저장/페이지분할) → 반응형 → 임시패치 정리. 백엔드 0](specs/026-mobile-editor-support/plan.md)
- [024 R3 자체 에디터 블록 패리티 + 소프트 줄바꿈 — TipTap 전면 교체(R3~R7, 023-export 단일 브랜치)의 1단계. 자체 EditContext 엔진을 손실 0 대체재로 만들기 위해 인용(blockquote)·글머리표/번호목록(bullet/ordered)·구분선(hr) 블록 + 소프트 줄바꿈(Shift+Enter/hardBreak)을 1급 추가. 평면 블록 모델 유지·BlockAttr 유니온 확장(blockquote/listItem{listKind,depth}/hr) + buffer 내 U+2028 줄바꿈 마커. measure=R2 오프스크린 styled-DOM+Range 일반화에 인용 들여쓰기·목록 마커폭·U+2028 강제 줄나눔(canvas 금지). 번호목록 번호=렌더 파생, 구분선=원자 빈 블록(캐럿 진입불가). pmConvert가 신규 노드 무손실·idempotent 왕복(R4 기존 데이터 교체 안전의 전제). layoutEngine·geometry 무수정, 백엔드 0. 상위 설계 docs/superpowers/specs/2026-06-16-custom-editor-full-replacement-design.md](specs/024-custom-editor-r3/plan.md)
- [024 R2 자체 에디터 엔진 2라운드 — 마크(부분 스타일)·혼합폰트 줄측정. 1라운드(구조) 위에 문자 단위 인라인 마크(bold/italic/underline/strike) + 한 줄 안 혼합 스타일 측정/캐럿/선택을 더함("드래그한 부분만 굵게"). 데이터 구조=블록별 마크 run-list(정규형 비트마스크 run, 평문 buffer는 텍스트·offset SoT 유지), 측정=오프스크린 styled-DOM+Range run 일반화(canvas 금지), affinity=(offset,방향) 튜플로 1라운드 `<=` 워크어라운드 대체. pmConvert가 PM text node marks(bold/italic/underline/strike) 무손실·idempotent 왕복. 1라운드 모듈(model/measure/pmConvert/CustomEditor) run 단위 일반화, layoutEngine·geometry·outline 무수정, 백엔드 0. 워크트리 024-custom-editor, 메인 repo 023 비접촉](specs/024-custom-editor-r2/plan.md)
- [024 자체 에디터 엔진 1라운드 — B형 집필실 수직 슬라이스(구조). TipTap(CSS column-wrap)→자체 EditContext 엔진 교체의 첫 라운드. 신규 전용 라우트에 자체 엔진을 꽂아 프레시 테스트 챕터에 문단·제목(H1~3) 쓰기→자동저장→재로드+줄단위 페이지분할을 실환경 검증. 디스크는 PM JSON(bodyJson) 유지·경계 양방향 변환(자동저장016/버전토큰/충돌 무수정 재사용). PoC 순수 자산(geometry/layoutEngine/measure) 승격 + 블록속성(heading) 동기 + undo/plain paste. B형 셸(BStudioShell 추출)·ChapterList·BWorkSidePanel 재사용, 아웃라인은 TipTap 인스턴스 탈피 엔진 파생. 마크/리스트/완전대체/Safari=후속 라운드. 백엔드 변경 0](specs/024-custom-editor-r1/plan.md)
- [022 챕터 (Chapter) — 작품 1:N 본문 구조. 기존 documents 테이블 1:N 확장(project_id UNIQUE 제거 + sort_order·deleted_at, V14 마이그레이션, 기존 본문 무손실 1번 챕터). 챕터 목록/생성/순서/soft-delete/복구 5 endpoint + 마지막 챕터 가드(409 LAST_CHAPTER_UNDELETABLE) + 카드 합산 집계. FE A형·B형 집필실 좌패널 챕터 목록·전환(?chapter, 016 세션 재사용). Round 2.5, export(Round 3) 선행](specs/022-chapters/plan.md)
- [019 Round 1 스키마 확장 — 곁쪽지 삭제/되돌리기(soft-delete deleted_at·restore·연결행 보존) + 설정 서버 영속(user_settings key-value·테마/작성모드/원고지크기) + 등장인물 확장(age·gender·traits·Rail 진입). 마이그레이션 V9~V11 로컬 dev 한정](specs/019-round1-schema-extensions/plan.md)
- [017 집필실 3단 (Studio 3-panel) — [아웃라인 | 원고 | 인물+곁쪽지] 3열. 아웃라인=heading 클라이언트 파생 TOC(점프+하이라이트), 인물=기존 API 보기+빠른추가, 곁쪽지=MemoPanel 불변. 백엔드 변경 0](specs/017-studio-three-panel/plan.md)
- [016 자동저장 재설계 — 로컬 우선 보존(localStorage draft) + 수정시각(updatedAt 겸용) @Version 버전 토큰. 거짓 409 충돌 근본 해결 + 작성분 복구 + 비동기 공동집필 토대](specs/016-autosave-localstorage-redesign/plan.md)
- [015 Web 포팅 — Front 이식 (desktop 화면 → Next.js, electronAPI→fetch, projects 풀스택 먼저 + 페이지분할/한글 PoC 선증명)](specs/015-web-port-frontend/plan.md)

For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan above.
<!-- SPECKIT END -->
