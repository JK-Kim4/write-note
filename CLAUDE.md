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
| PoC 결과 | 본 repo `docs/poc/` |
| **회고 (retrospective)** | **외부 vault `~/obsidian/write-note/retrospectives/`** (형상관리 제외 — public repo 노출 방지) |
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

> Render(백엔드)·Supabase(DB)는 2026-06-16 폐기. 도메인 = soseolbi.com 확보(2026-06-21, 위 인프라 구성 참조).
> **데스크톱 앱(`desktop/`)·다운로드 페이지(`download-site/`)는 폐기**(2026-06-27 정리, 코드·워크플로우·설계문서 제거). 본 프로젝트는 **웹 앱(`frontend/`+`backend/`) 전용**이며, GitHub Releases·버전 태그(`v*`)는 웹 앱 릴리즈 노트로만 운영한다.

### 브랜치 모델 (README §"브랜치 전략")

| 브랜치 | 역할 |
|---|---|
| `main` | **웹 앱 production 코드베이스**(2026-06-21 `develop→main` 승격, `7628e66`). main push → Vercel production(soseolbi.com) 자동배포. develop 과 동기 유지 |
| `develop` | 다음 release 통합 target. push → Vercel preview 자동배포. 작은 FE 기능은 develop 직접 작업 후 main merge |
| `feature/*` | 신규 기능, 워크트리 격리 |
| `release/*` · `hotfix/*` | 출시 안정화 / production 긴급 fix (발생 시 생성) |

### 인프라 구성 (요약 — 상세 SoT = 메모리 [[deployment-live]] + 04-web-launch-v1-plan.md)

- **도메인 = soseolbi.com** (2026-06-21 harubuild.xyz 에서 전환). **Cloudflare 경유**(GoDaddy 도메인 → Cloudflare 네임서버): 프론트 `soseolbi.com`(Vercel, Cloudflare 프록시 **OFF**), 백엔드 `api.soseolbi.com`(OCI, Cloudflare 프록시 **ON** + Origin Certificate). 구 harubuild.xyz → 308 redirect.
- **FE** = Vercel (project "write-note", team narae-note). same-origin 프록시 — `/api/*` → `BACKEND_ORIGIN`(=`https://api.soseolbi.com`) rewrite. **Root Directory=`frontend`**.
- **BE** = OCI Compute(`free-a1`, ap-seoul-1, `ssh oci`) Docker 컨테이너 + 앞단 Caddy(:443) + self-managed PostgreSQL(Docker, 로컬 전용, Flyway 자동).

### 배포 방식 (HARD-GATE — 정상 경로 = git push 자동배포)

- **FE 재배포 = `main`/`develop` push 시 Vercel git 자동배포** (정상 경로, 2026-06-21~). **`main` push → production**(soseolbi.com alias, **무중단** immutable 배포), 기타 브랜치 push → preview. 별도 명령 불필요.
  - ⚠️ **수동 `vercel --prod` 는 비권장 — 실패한다**: Root Directory=`frontend` 설정 때문에 (a) `cd frontend && vercel --prod` → 경로 중복 `frontend/frontend` 오류, (b) repo 루트 실행 → frontend 외 backend 등 포함 repo 전체 업로드 → **100MB 초과 deploy_failed**. 핫픽스로 꼭 필요하면 `.vercelignore` 선행. **그냥 push 로 자동배포가 맞다.** (2026-06-21 실증 — 메모리 [[deployment-live]])
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
  - **회고 산출물은 외부 vault `~/obsidian/write-note/retrospectives/` 에 저장**(본 repo `docs/retrospectives/` 미사용 — gitignore, public repo 노출 방지). 룰의 회귀 사례 인용도 vault 경로.

<!-- SPECKIT START -->
Current implementation plan:

- [048 카드 관리 (Card Management) — 보드 카드(cards)를 여러 보드 가로질러 관리하는 화면 + 보드 없는 독립 카드. "메모"는 폐기된 memos 부활이 아니라 기존 보드 카드(요구사항 "카드 종류·연결 삭제경고·소속 보드"가 cards 에만 있는 속성이라 확정, memos 백엔드·iOS 캡처는 살아있으나 무변경·미노출). clarify 2건: (Q1)연결 없는 카드 자유 재배정 양방향(독립↔보드·보드A↔보드B, 연결선 걸린 카드만 범위 밖) (Q2)독립 카드도 기존 4종(character/place/event/theme) 재사용+무지정 기본. 데이터모델=board_id nullable + 모든 카드 user_id(V30 additive: add nullable→boards.user_id 백필→NOT NULL+FK cascade→board_id DROP NOT NULL→idx_cards_user; 숨은 인박스 보드 대안 기각). 신규 CardController /api/cards(유저 스코프 소유=card.user_id): GET 목록(cross-board·boardName·linkCount[distinct 이웃] 동봉·N+1 회피 grouped projection)·POST 독립 생성·GET/PATCH/DELETE {id}·PATCH {id}/board(재배정: 연결 있으면 400·대상 보드 소유검증·null=떼기). 기존 /api/boards/{boardId}/cards/* 무변경(additive). 함정=user_id NOT NULL→모든 insert 경로가 채움(신규 + 기존 BoardService.createCard). 빈 본문=백엔드 관대(default '')·"내용 필수"는 FE 생성폼 가드만(이원검증 금지). 신규 에러코드 0(BOARD_OWNER_INVALID·ValidationException·404 재사용). 삭제 경고=linkCount>0("N개 카드와 연결"), 카드 삭제 시 링크 DB cascade(FE 중복삭제 금지). FE 교차캐시=재배정/떼기 시 해당 board useBoardDetail+useBoardsMine invalidate. R1 BE(V30+CardController/Service/Repository+createCard user_id+IT)→R2 FE 데이터계층(lib/api/cards·useCards·electron 미러)→R3 FE UI(진입점=/boards 하위 탭[보드|카드]·NAV 무변경, 목록=그리드 종류색 틴트 타일·소속 보드 라벨·연결 배지·정렬 생성일 내림차순(안정, createdAt DTO 추가)·문자열 검색(내용/보드명)+필터(소속 전체/보드소속/독립·종류 4종+무지정) FE 클라, 우측 슬라이드오버 상세[종류·본문·재배정·삭제], 삭제경고 linkCount, 독립 생성 인라인 IME 가드, 재배정 잠금[연결 있는 카드], 빈 상태 오버레이 — 목업 확정 docs/research/2026-07-01-card-management-mockup.html)→R4 FE 집필 통합(FE-only 신규 BE 0: 집필 화면 BoardReferencePanel 에 [보드|카드] 토글 추가, 카드 뷰=그 작품 참조 보드 카드+독립 카드를 GET /api/cards+GET /boards/reference FE 필터, 3단 그룹[이 작품 보드→시리즈 보드→독립, 각 그룹 생성일 내림차순], R3 상세 재사용·참조 목적, US6/FR-019·FR-019a, 목업 docs/research/2026-07-01-writing-card-view-mockup.html). BE선행→FE후행, additive 구FE무손상. 진입점=보드 하위 탭이라 신규 top-level 라우트·NAV 항목 없음. 고아 memo FE 파일(useMemos.ts 등)은 범위 밖(별도 정리 트랙 surfacing). 설계 SoT=specs/048-card-management/{spec,plan,research,data-model,contracts,quickstart}. constitution 빈템플릿→CLAUDE.md 룰 준용](specs/048-card-management/plan.md)
- [047 공유 사용성 개선 (Share UX) — 046 공유 기능이 마이페이지 하위(/mypage/shares)에 묻혀 핵심임에도 접근성 떨어지던 것 해결. 신규 BE 도메인 0(046 share_link/share_snapshot/share_comment 재사용 + share_comment.read_at 1컬럼 V29 additive). (1) 진입점: 헤더 최상위 "공유" 칩 신설((main)/layout.tsx NAV_ITEMS 6번째·/shares)+마이페이지 사이드바 "공유 관리" 제거+/mypage/shares→/shares redirect(037 next.config 선례)+작품카드(DraggableWorkCard) 공유버튼(편집·보관·삭제와 나란히)+시리즈타일(CategoryTile) ⋯메뉴 공유. (2) 1:N 유지(기존 share_link owner/target 유니크 없음·createShareLink 매번 새 토큰+스냅샷 — BE 변경0): 작품/시리즈 공유 클릭→그 대상 링크 0개면 "공유 링크 만들기"·1개+면 시점별 링크목록("2026.06.25 공유")+"새 공유 링크 만들기", 활성링크 1+면 카드/타일 "● 공유 중·N". 신규 SharePopover(작품/시리즈 공용·listMine을 targetType/targetId FE필터—신규 조회 endpoint 0)+ShareLinkManager 재구성(받은피드백 맨위+작품/시리즈 그룹·생성폼 제거). (3) 받은피드백 읽음관리: 읽음·집계 단위=작품(projectId, 기존 인박스 listForAuthor/findByProjectIdIn 단위 정합). "받은 피드백 N"=read_at IS NULL 수, "피드백 보기" 열면 그 작품 안읽은 댓글 전체 read_at 채움(열면 묶음 전체 읽음·사용자 확정). 신규 POST /api/projects/{id}/comments/read(소유검증 COMMENT_FORBIDDEN 재사용·신규 에러코드 0)+listMine SharedWorkMeta.unreadCommentCount additive(projectId group-by 일괄·N+1회피·부분인덱스)+AuthorCommentResponse.readAt additive. R1 BE(V29+집계+읽음endpoint)→R2 FE진입점·관리(헤더칩·/shares·redirect·ShareLinkManager 재구성)→R3 FE 작품/시리즈 진입점(SharePopover·카드/타일·공유중표시·shareGrouping 순수헬퍼)→R4 FE읽음(인박스 열때 read·안읽음강조). BE선행→FE후행, additive 구FE무손상. 046 공개열람/회원댓글/대상삭제보존 무변경(FR-015). 설계 목업 docs/research/2026-06-28-share-entry-points-mockup.html(사용자 승인). 설계 SoT=specs/047-share-ux/{spec,plan,research,data-model,contracts,quickstart}. constitution 빈템플릿→CLAUDE.md 룰 준용](specs/047-share-ux/plan.md)
- [046 공유하기 (Share) — 공유 링크 + 위치 지정 피드백. 작가가 작품/시리즈를 공유 링크로 내보내 비로그인 외부인이 읽기전용 열람(공유 시점 **불변 스냅샷** 동결, 원문 수정 미반영), 로그인 회원은 본문 텍스트 구간에 **작가 전용 비공개** 댓글. 신규 BE 도메인 3테이블(share_link/share_snapshot/share_comment, V27~28, 기존 변경0)+ShareErrorCode + optional auth(=`/api/shared/**` permitAll + nullable @AuthenticationPrincipal, JwtAuthenticationFilter 토큰부재 pass-through 실측 활용→신규 필터 0)+스냅샷 owner키 암호화(BodyCipherService 재사용·공개read 서버측 복호, at-rest 평문0)+앵커=불변 스냅샷의 문단인덱스+문단내 시작·길이(살아있는 에디터 블록ID 주입 POC[docs/poc/2026-06-28-block-id-anchoring-poc.md]는 미래 '실시간 반영' 옵션으로 보존). clarify 4건(댓글 작가전용 비공개·텍스트구간 앵커·대상삭제시 링크비활성+스냅샷·댓글 보존[ProjectService/CategoryService 훅, 보드 clearOwner 선례]·활성링크+회원 누구나)=spec SoT, PRD v0.4와 divergence→PRD v0.5 동기 권장. R1 BE 공유+스냅샷+공개읽기[코어§10]→R2 BE 댓글+optional auth+작가인박스→R3 BE 시리즈+공개작품선택+삭제수명주기→R4 FE 관리UI+작가인박스→R5 FE 공개페이지(printLayout 정적렌더·noindex)+회원 댓글(텍스트 구간). BE선행→FE후행, Testcontainers 검증(로컬DB 미적용 — external-infra-safety), '구현완료'=게이트GREEN+서브에이전트 리뷰, authed dogfooding(로그인 뒤·시각)은 별도 수동게이트(§19). 설계 SoT=specs/046-share-feedback/{spec,plan,research,data-model,contracts}. constitution 빈템플릿→CLAUDE.md 룰 준용](specs/046-share-feedback/plan.md)
- [046 집필 화면 인라인 보드 편집 + 오버레이 열고/닫기 다듬기 — 트랙 A(브랜치 worktree-045-board-link-coachmark에 045와 동반, develop 기반). FE only(BE·마이그레이션·에러코드 0). 집필 화면 우측 보드 목록 "열기"가 router.push(/boards/[id])=완전 이탈하던 것을, 이미 있던 인라인 참조 패널(BoardReferencePanel=PlotBoardCanvas 편집가능 캔버스)로 통일. 변경: InlineBoardList optional onOpenBoard(있으면 인라인 오버레이·그 보드 preselect, 없으면 router.push 유지→LibraryBoard 시리즈 보드 섹션 보존) + BWorkSidePanel onOpenBoard 전달 + BStudioShell boardRefInitialId·openBoardRef·"보드 참조" 토글·active(주황) + BoardReferencePanel(initialBoardId preselect·우측 슬라이드 transition open||mounted·투명 캐처 바깥클릭 닫기[원고 안 어두워짐]·✕·ESC·⤢ 넓게 폭토글·↗ 전체화면 router.push). 디자인=인터랙티브 목업으로 잠금(docs/research/2026-06-27-writing-board-overlay-open-close-mockup.html·...-edit-mockup.html, 사용자 승인) → 경량 설계문서 docs/board/board-writing-inline-overlay-design.md(speckit 무거운 과정 생략, 트랙 D 선례). 버그픽스 2건(dogfooding): (1) 인라인 오버레이 편집 후 재오픈 유실 — useBoardDetail을 항상 마운트된 부모서 호출→same-board 재오픈 시 observer remount 안 됨→refetchOnMount:"always" 미발동·stale 캐시 재시드. 수정=detail+캔버스를 열림따라 마운트되는 자식 BoardReferenceCanvas로 분리→재오픈마다 fresh refetch. (2) 연결된 카드 삭제 시 간헐 거짓 "연결 끊기 실패" 토스트 — RF가 카드삭제(deleteCard)+연결선삭제(deleteLink) 동시 발화, 백엔드는 FK CASCADE로 링크 이미 정리→프론트 deleteLink 중복·racy(보통 404는 044 isNotFoundError 억제, 드물게 비404 transient). 수정=삭제중 카드 id ref 기록(handleNodesDelete)+onEdgesDelete 마이크로태스크 지연→cascade 연결선이면 deleteLink 생략(콜백 순서 무관, 공용 PlotBoardCanvas). 검증=게이트(typecheck·lint0err·test727·build)+사용자 dogfooding 전항(오버레이+메인페이지 회귀·독립 연결선삭제·슬라이드·닫기3경로·폭/전체화면·시리즈보드 router 유지·045 코치마크 무회귀). FE 단독→배포순서 무관. constitution 빈템플릿→CLAUDE.md 룰 준용](docs/board/board-writing-inline-overlay-design.md)
- [045 보드 "끌어서 잇기" 첫-진입 코치마크 — 트랙 2(ISSUE-051 잔여, 브랜치 worktree-045-board-link-coachmark, develop 기반·룰26 base 검증). FE only(BE·마이그레이션·에러코드 0). 보드 캔버스에서 처음 어느 카드든 연결점(React Flow Handle)에 커서를 올리면 그 점(top/right/bottom/left)에서 바깥으로 "끌어서 잇기" 텍스트 코치마크 1회 노출→localStorage 단일 플래그(writenote.board.coachmark.v1 `{linkHint?:true}`) 기억→재진입·다른 보드 안 뜸. 본 뒤 매 hover는 연결점만(현행 보존). 실측(추측 아님): @xyflow/react 12.11.1 HandleProps=HandlePropsSystem&Omit<HTMLAttributes<HTMLDivElement>,'id'>&{onConnect?}→Handle이 onMouseEnter/onMouseLeave forward(커서 올라간 연결점 감지)·연결 드래그(pointerdown) 무충돌·라벨 pointer-events-none 비차단. 메커니즘=자체 custom 코치마크(driver.js 아님—튜토리얼벽·동적트리거·body-append 다크함정 회피), 영속=localStorage(서버 SettingsService.ALLOWED 값 화이트리스트 회피, 043 lastViewedBoard 선례). 범위=공유 캔버스라 /boards/[id]+집필 참조 패널(BoardReferencePanel) 공통, 홈 온보딩(driver.js) 독립. "이건 뭔가요?"(처음 카드 선택 종류 안내)=사용자 결정 제거(FR-008, worksheet TASK-7 두번째 항목 의도적 축소). 문서 모순 화해(룰28): worksheet TASK-7(첫-진입 1회) vs 핸드오프 TASK-2(매-hover 지속)→사용자 결정 첫 진입 1회로 통합. 변경=신규 lib/boardCoachmark.ts·components/board/linkHintPlacement.ts(순수 TDD: seen 판정·마크·손상 화해 / 앵커→방향)+CardNode.tsx(hoveredHandle 상태+Handle onMouseEnter/Leave+라벨·1회성 마크). 회귀가드=연결점 group-hover·잇기 4경로·종류 칩·삭제·선택 인디케이터 무변경. TDD 순수+캔버스 시각/hover=dogfooding 게이트(룰14·25, quickstart 전항 사용자 확인 후 통과 단정). 위치 목업=docs/research/2026-06-27-board-coachmark-placement-mockup.html(사용자 승인). 설계 SoT=docs/board/board-link-coachmark-design.md. FE 단독→배포순서 무관. 완료=ISSUE-051 잔여(TASK-2 힌트·TASK-7) 완전 종료. constitution 빈템플릿→CLAUDE.md 룰 준용](specs/045-board-link-coachmark/plan.md)
- [044 보드 카드 만들기 UX 보완 — 보드 TASK-1 미구현 잔여 회수(ISSUE-051, 브랜치 worktree-044-board-card-creation-ux, develop 기반). 기획(board-ux-worksheet.md) vs 구현 GAP에서 드러난 잔여. FE only(BE·스키마·에러코드 0 — 기존 카드 생성 POST /api/boards/{id}/cards·본문 편집 PATCH 재사용). (1) 빈 보드(카드 0개) 진입 시 빈 격자 캔버스 대신 중앙 안내(신규 BoardEmptyGuide, COPY "여기에 첫 카드를 적어보세요"/"+ 카드 만들기", nodes.length===0 오버레이가 격자 덮음·빈 캔버스 노출 금지) (2) 캔버스 빈 곳 더블클릭→그 자리 카드 생성(React Flow 12.11.1 onPaneDoubleClick prop 부재 실측→wrapper 네이티브 onDoubleClick + (e.target).classList .react-flow__pane 한정 + screenToFlowPosition 좌표변환; zoomOnDoubleClick=false로 더블클릭 줌만 끔·휠(zoomOnScroll)·핀치(zoomOnPinch)·한눈에보기(fitView) 유지) (3) 세 생성경로("+카드" 버튼·빈곳 더블클릭·빈보드 버튼)가 공통 createCardAt(pos)로 카드 즉시 생성 + 생성 직후 자동 본문 편집(autoEditCardId 캔버스 상태 + boardActions consumeAutoEdit, onSuccess 실제 id 확정 후 진입=temp→real 스왑 리마운트 키 유실 방지). 빈 본문 카드도 즉시 저장·잔존(사용자 결정 2026-06-27 — worksheet TASK-1 완료기준 "본문 없이 벗어나면 카드 안 남음" 대체, 나머지 3기준 유지). 변경=PlotBoardCanvas(CanvasInner)·CardNode·boardActions 수정 + 신규 BoardEmptyGuide, 두 렌더처(/boards/[id]·집필 참조 패널 BoardReferencePanel) CanvasInner 공통 자동적용. 회귀가드=더블클릭 pane 한정→카드 더블클릭 편집·잇기 빈곳 drop(onConnectEnd)·컨트롤 무충돌, 잇기/드래그/종류/매핑 무변경. 038 spec FR-005("빈 캔버스로 정상표시")를 worksheet 정합으로 직접 정정 동반(룰28 모순 화해). TDD=순수로직(pane 판별·autoEdit consume·빈보드 판정), 캔버스 상호작용·시각·포커스=dogfooding 게이트(jsdom 미검증·룰14, quickstart 전항 사용자 확인 후 통과 단정·룰25). FE 단독→배포순서 무관. constitution 빈템플릿→CLAUDE.md 룰 준용](specs/044-board-card-creation-ux/plan.md)
- [041 보드 진입점·매핑·아이디어 보드 — 트랙 C 코어 (038 연장, 브랜치 038-memo-plot-board). 설계 SoT=docs/board/board-track-c-design.md. 매핑 모델을 dual-FK(boards.project_id/category_id)→다형 단일소유(owner_type 'project'/'category'/null + owner_id)+1:N 전환(V24 in-place 편집·부분유니크인덱스 제거·CHECK 짝·idx_boards_owner, 진짜 FK 상실→대상 삭제 보존은 ProjectService.deleteProject·CategoryService.delete hard-delete 경로에 BoardRepository.clearOwner 훅, archive는 무처리). BE: GET /boards/mine(소속 라벨 작품 title/시리즈 name/"아이디어" 동봉·N+1 일괄조회·최근순) 신규 + POST owner 선택(매핑충돌 409 제거) + PATCH /{id}/owner(set/clear, null=아이디어) 신규로 PUT /project·/category 2개 대체 + GET /boards 필터 owner化(내부탭②용) + DTO projectId/categoryId→ownerType/ownerId·ownerLabel + 에러 BOARD_*_ALREADY_MAPPED 2제거·BOARD_OWNER_INVALID(400) 추가 + owner 검증(본인 작품/시리즈, 짝/type)·삭제훅 단위·IT. FE: lib/api·electron-api·useBoards(useBoardsMine/usePatchBoard, set* 제거)·/boards 허브 재설계(소속 라벨 칩·클라 검색·생성 picker BoardOwnerPicker "이 보드는 어디에 쓸 건가요?"·나중에 붙이기)·BoardMappingControl 제거. 검색=클라 필터. 내부 탭(작품/시리즈 상세 호스트)·집필 참조(GET /works/:id/reference-boards·마지막 본 보드·분할뷰)는 범위 밖(후속 ②③). 보드 develop·main 미배포→API 계약 변경 prod 위험 0, 트랙 누적분 원자적 동반 merge. 마이그레이션 in-place→로컬 dev DB board 3테이블 drop+history 3행 삭제+재마이그레이션(컨펌). BE선행→FE후행. 검증=게이트+회귀 grep(어댑터 밖 node/edge 0·폐기문구 0·제거 에러코드 잔존 0)+dogfooding 6항(picker 3경로·나중에 붙이기·검색·1:N·대상삭제 보존·Track A/B 무회귀). TDD=owner 검증·라벨 파생 순수로직. constitution 빈템플릿→CLAUDE.md 룰 준용](specs/041-board-entry-points/plan.md)
- [040 보드 유비쿼터스 언어 정리 — 트랙 B (038 연장, 브랜치 038-memo-plot-board). 보드 도메인 node/edge/board_nodes/board_edges → PRD §0 유비쿼터스 언어 Card/Link/cards/links 전면 rename(순수 리팩토링, 동작 변화 0). 영향범위 SoT=docs/board/board-track-b-impact-survey.md. BE: 마이그레이션 V24~26 in-place 편집(cards/links + source_card_id/target_card_id + 제약·인덱스명) + 엔티티 BoardNode→Card·BoardEdge→Link + repo CardRepository/LinkRepository + service createCard/createLink 등 + DTO CreateCardRequest/CardResponse/LinkResponse(sourceCardId/targetCardId) + controller endpoint /{boardId}/cards·/links + 에러코드 BOARD_EDGE_*→BOARD_LINK_*(메시지 노드→카드) + 테스트 동기. FE: 데이터계층(lib/api·electron-api·query/useBoards 타입·함수·훅·endpoint) + nodeKinds→cardKinds + 어댑터 내부 도메인 식별자만(NodeCard→CardNode, LinkEdge 유지, linkGraph neighborNodeIds→neighborCardIds·incidentEdgeIds→incidentLinkIds), RF 자체 API(useNodesState·Node·onConnect·ConnectionMode)는 어댑터 안 보존(PRD §8). 네이밍=bare Card/Link(하드 충돌 0). boards·Board·base /api/boards·매핑 에러코드·카드 종류 값(plot 등)·type 컬럼 불변. 보드 develop·main 미배포(실측)→API 계약 변경에도 prod 위험 0, 038 merge 시 원자적 동반. 마이그레이션 in-place→로컬 dev DB board 3테이블 drop+history 3행 삭제+재마이그레이션(컨펌). BE선행→FE후행(구현순서). 검증=게이트(BE ktlint·checkstyle·test·build / FE typecheck·lint·test·build)+회귀 grep(어댑터 밖 node/edge 0·DB board_nodes/edges 0·화면 node/edge/메모 0)+dogfooding 전항(트랙 A 동작 보존). TDD=룰 §5-5 예외(rename). constitution 빈템플릿→CLAUDE.md 룰 준용](specs/040-board-ubiquitous-language/plan.md)
- [039 플롯 보드 연결(Link) UI — 트랙 A (038 연장, 브랜치 038-memo-plot-board). 보류됐던 연결 UI를 FE 캔버스에만 재결선(신규 백엔드 0 — 엣지 BE 계약·FE API·훅·BoardEdgeResponse·BoardDetail.edges 보존 재사용). brainstorming 확정: ① 무방향 선(React Flow ConnectionMode.Loose, 화살표 없음. 단 BE는 A→B·B→A 별개 허용 → FE가 linkGraph.canLink로 "이미 이어진 쌍(양방향)·자기연결" 선제 차단) ② 이웃 하이라이트(별도 백링크 패널 없음 — 선택 카드 이웃 node/edge 또렷·나머지 dim). 잇기 4경로=드래그 유효drop(onConnect)/빈곳 drop 새카드+연결(onConnectEnd toNode==null 분기, DEFAULT_KIND=plot)/클릭-클릭(잇기 모드)/중복·자기연결 무시. 끊기=custom edge LinkEdge hover ✕(+Delete 보조)→useDeleteEdge. 낙관=RF 로컬 useEdgesState(노드 패턴 동형, temp-edge id→onSuccess 실제 id, onError reseed). 순수헬퍼 linkGraph.ts(toRFEdge·isPairLinked·isSelfLink·neighborNodeIds·incidentEdgeIds·canLink) TDD, 캔버스 상호작용=dogfooding 게이트(jsdom 미검증). 변경=PlotBoardCanvas/NodeCard/boardActions+신규 linkGraph·LinkEdge. colorMode light 고정. 어댑터 경계(node/edge 어댑터 내부만, 전면 rename은 트랙 B). FE 단독 배포순서 무관. constitution 빈템플릿→CLAUDE.md 룰 준용](specs/039-board-link-ui/plan.md)
- [038 플롯 보드 (Plot Board) — 작품/시리즈와 무관하게 독립 생성하는 플롯 설계 보드. 무한 캔버스(React Flow v12 @xyflow/react, client-only dynamic ssr:false) 위에 보드 전용 노드(기존 캡처 메모 `memos` 와 완전 별개 신규 객체, 노드 제거≠메모 삭제) 생성·드래그 배치·방향 연결(엣지)·백링크. 위치/본문/연결/뷰포트 영속·복원. 저장 타이밍=드래그 종료(onNodeDragStop) 배치 PATCH·뷰포트 onViewportChange 디바운스, 낙관적+롤백. 보드↔작품(Project)·보드↔시리즈(Category) 매핑 모두 0~1:0~1(부분 유니크 인덱스, 대상당 보드≤1, ON DELETE SET NULL 로 대상 삭제 시 보드 보존). 신규 BE 도메인 boards/board_nodes/board_edges(V24, 기존 테이블 변경 0) + 사용자 소유 CRUD(Result envelope·@AuthenticationPrincipal·findByIdAndUserId 재사용) + 신규 BoardErrorCode(매핑충돌 409 2종·엣지중복 409·엣지검증 400·404 3종, client.ts error.code 분기). R1 BE전체(GREEN)→R2 FE 노드배치·영속(P1)→R3 엣지·백링크(P2)→R4 매핑·보드관리(P3), BE선행→FE후행. constitution 빈템플릿→CLAUDE.md 룰 준용. 스토리=기존 시리즈(Category) 확정. 캡처 메모 도메인 무변경(SC-007)](specs/038-memo-plot-board/plan.md)
- [038 홈 작품 카드 개선 + 새 디자인 다크모드 지원 — 사용성 개선 2건(독립). US1(P1) 홈(/) "이어서 쓰기" 제외 작품 카드 최대 2개 제한 + 초과 시 "더 보기"→/library, 각 카드에 시리즈명·최종 수정일 추가 + 호버 시 생성일·총 집필시간(타임워치 totalDurationMs 재사용, /library DraggableWorkCard 호버 패턴). 데이터는 ProjectCard 응답에 대부분 존재(lastSentenceSource·documentUpdatedAt·createdAt·totalDurationMs), 시리즈명(categoryName)만 BE additive(categoryId→name 일괄 매핑 N+1 회피, 미분류=null→"미분류"). 마이그레이션 0·신규 에러코드 0. 정렬 불변(documentUpdatedAt desc, 동률 id desc). US2(P2) 테마 토글 메커니즘(useThemeEffect→:root.dark, tokens.css :root.dark 다크변수)은 정상이나 새 디자인(B: 홈·마이페이지)이 고정 Tailwind 색(bg-white·text-gray-* ~270곳, dark:·var 0건)이라 .dark 무반응=의도적 "라이트 고정"(PreferencesSections:78). 사용자 결정=새 디자인 전체 다크 지원. 접근=목업 게이트 선행(docs/research/2026-06-24-bdesign-dark-mockup.html 승인 후)→tokens.css 다크 회색계조 보강+@theme 의미색 확장→고정색을 의미색 토큰(bg-canvas/text-ink) 치환+잔여 dark: variant. 시각=단위테스트 미보장(§14)→라이트/다크+한국어 dogfooding. US1 BE선행→FE, US2 FE단독. constitution 빈템플릿→CLAUDE.md 룰 준용](specs/038-home-cards-theme-fix/plan.md)
- [037 마이페이지 계정 셸 재구성 — 036 마이페이지를 좌측 사이드 메뉴 계정 셸로. 중첩 라우트 /mypage/{섹션}(profile·settings·connections·withdraw), mypage/layout.tsx 가 사이드 메뉴 공유. 사이드 5개: 프로필(닉네임036+계정정보), 환경설정(테마·용지·목표 — 기존 /settings 흡수), 계정 연결(신규), 문의(→/contact 링크), 회원 탈퇴(맨 아래 위험 분리·모달 보존). /settings→/mypage/settings(next.config redirects), 헤더 nav '설정' 제거, link-success 목적지→/mypage/connections. 계정 연결=기존 /link/kakao(302 OAuth)·/link/email 재사용, 해제 미지원(unlink endpoint 부재)→연결 추가만. BE 변경=AuthMeResponse.passwordSet additive 1(passwordHash!=null, 계정연결 UI 판단)·마이그레이션 0·신규 에러코드 0. 기존 settings page 4블록(테마·용지·목표·탈퇴) 컴포넌트 추출 재배치(동작 보존). R1 FE단독(셸+환경설정흡수, BE0)→R2 BE선행(passwordSet)→FE(계정연결). 카카오 연결 시작 브라우저 흐름(POST→302 OAuth·CSRF·session)=R2 실측. develop 미merge 036 위 분기](specs/037-mypage-account-shell/plan.md)
- [036 사용자 닉네임 + 마이페이지 — users 에 고유·필수·변경가능 nickname 컬럼(V23: nullable 추가→`사용자<id>` 백필→NOT NULL+UNIQUE). 신규 가입(이메일·카카오) 시 큐레이션 한글 단어조합(수식어+명사+4자리, 외부의존 0·충돌 재추첨)을 NicknameGenerator 가 자동부여, 기존 회원은 백필. 마이페이지(/mypage, /settings 와 분리) 신설=닉네임 변경 + 계정정보(이메일·가입방식·가입일) 읽기전용. 닉네임 변경 PATCH /api/users/me/nickname(신규 UserController): 2~16자·`^[가-힣a-zA-Z0-9_]{2,16}$`·정확일치 중복판정·직접입력 금칙어(ForbiddenWords)필터. 에러=기존 AuthErrorCode +3(NICKNAME_INVALID_FORMAT 400·NICKNAME_FORBIDDEN_WORD 400·NICKNAME_ALREADY_REGISTERED 409)·AuthException·Result envelope 재사용(신규 enum 0). AuthMeResponse additive nickname·createdAt + UserAuthConverter 매핑. 회원가입 요청폼 무변경. R1 BE(생성·검증·endpoint·응답확장)선행→R2 FE(마이페이지·표시)후행. constitution 빈템플릿→CLAUDE.md 룰 준용. 닉네임은 추후 공유/첨삭 식별자 토대](specs/036-user-nickname-mypage/plan.md)
- [033 시리즈 중심 재구성 (챕터 제거 + 메타 시리즈 종속화) — 032 시리즈(category) 위에서 "시리즈=책 / 작품=장" 모형 정렬. (1) 챕터 제거: documents 1:N→앱레벨 1:1(운영 다중본문 0건·작품별 활성본문 max 1 실측 → 스키마 보존, DocumentController 챕터 endpoint(목록/생성/순서/제목/삭제/복구)·FE ChapterList·BStudioShell 챕터UI만 제거, V22 불필요, sort_order/deleted_at 컬럼 보존). (2) 출판메타 시리즈 종속: 판형·출판방식·장르·줄거리를 Category에 additive(V21 nullable), 작품 개별설정 불가, 미분류·미설정=시스템기본값("A4"/"paper") fallback. BE가 effective 판형 해석해 Project 응답에 effectivePaperSize/effectiveLayoutMode 추가→집필실(CustomEditor·BStudioShell)·내보내기(PrintDocument·ExportDialog) 단일경로. 작품 시리즈이동 시 새 시리즈값 자동적용·본문불변. (3) 톤·문체·세계관·다음장면=UI만 제거·DB컬럼(tone_notes/world_notes/next_scene) 보존. (4) 두 층위 목표분량: 시리즈 총목표(Category.target_length)+하위작품 word_count 합산 진척(CategoryResponse.totalWordCount) / 작품 목표(Project.target_length) 유지. R1챕터제거/R2판형·출판·미분류fallback/R3장르·줄거리·톤류·화면간소화/R4목표분량, buffer 통합브랜치(032+033 함께 검증후 develop). 운영 V20 미적용(category_id 부재 실측)→배포시 V20+V21 처음 함께적용·전작품 미분류 시작. constitution 빈템플릿→CLAUDE.md 룰 준용. 신규 status/에러코드 0](specs/033-series-restructure/plan.md)
- [032 작품 카테고리 분류 (UI="시리즈"/코드 category) — 작품 페이지(/library)에 폴더형 분류 도입. 작품은 최대 1개 시리즈(projects.category_id nullable, NULL=미분류, 기존 작품 무손실). 인터랙션=타일 드릴인(C) — 루트=시리즈 타일(책등 스택, id시드 결정적 장식높이·길이의미 없음·8권+N)+미분류 작품, 열고 들어가 탐색(?folder=<id> URL), 카드를 타일로 @dnd-kit 드래그 분류(드롭=타일로 빨려들어감 fly-in, dropAnimation=null로 snap-back 제거) + 터치/키보드용 ⋯ 이동 메뉴 + 생성 인라인폼. 용어=dogfooding 후 모음→시리즈. N뎁스 설계=parent_id 컬럼 보유+앱레벨 1뎁스 강제(parentId 비-null 400). BE=V20(categories 테이블+projects.category_id FK ON DELETE SET NULL 작품보존) + CRUD 4(POST/GET/PATCH/DELETE) + 작품이동 전용 PATCH /projects/{id}/category(null=미분류) + 응답 categoryId 추가(additive). 신규 에러코드 0. R1 BE(GREEN·미배포)→R2 FE(GREEN). FE 컴포넌트=components/library/{LibraryBoard,CategoryTile,DraggableWorkCard,MoveMenu}. 목업 docs/research/2026-06-22-series-tile-and-drop.html](specs/032-project-categories/plan.md)
- [031 출판 방식 선택 기반 에디터 레이아웃 (종이/웹) + 종이 출판 판형 — 작품(Project)에 layoutMode(paper/web) 추가, 작품 생성 시 작가 강제 선택 + 양방향 전환(텍스트 무손실: DocModel 이 렌더와 독립). paper=기존 페이지 분할 집필실 + 출판 판형 4종(신국판 152×225/국판 148×210/46판 128×188/문고판 105×148, ASCII 식별자 sinkukpan/kukpan/pan46/mungopan)을 ISO 4종과 병행(총 8종) + 실측 분량 근사(폰트·행간 공통, 크기·여백만 판형별, 신국판 1면≈원고지 3.5매 앵커, 화면은 userZoom 흡수). web=페이지 분할 우회한 연속 표시 경로(layout(∞) 단일 페이지 + CustomEditor 렌더/좌표계 분기, R2 PoC 선행 — 가장 불확실) + 글자수 지표(charCount.ts 신규, model.buffer 기반). 기존 작품 layout_mode='paper' 마이그레이션(V17) + paper_size CHECK 8종 확장(V18). 신규 status/에러코드 0(409 오분류 회귀 없음). R1 데이터모델·모드선택/R2 웹연속(PoC)/R3 판형·조판·zoom/R4 분량지표. R1·R3·R4 BE선행→FE후행, R2 FE단독. 레거시 pageLayout.ts 미접촉, 집필실은 geometry.ts 기준](specs/031-publish-layout-modes/plan.md)
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
