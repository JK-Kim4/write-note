# Implementation Plan: 에디터·원고지 + 메모 캡처 (Week 3+4 통합)

**Branch**: `006-phase-3-4-editor-memo` | **Date**: 2026-05-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-phase-3-4-editor-memo/spec.md`

## Summary

004(Project 메타+Character+Document 신설) + 005(인증 쿠키 전환 + 프로젝트/등장인물 frontend) 위에 **Week 3(에디터+원고지) + Week 4(메모 캡처)** 를 박는다. 본 spec 은 **backend+frontend 혼합**(005 패턴). 핵심:

- **Week 3**: 이미 존재하는 Document(entity/repo/V5)에 **자동 저장 흐름**(nested 조회 + optimistic lock 409 + word_count 서버 계산) + **TipTap 에디터**(PoC 0-1 기준선) + **분량 카운터** + **원고지 격자/매수** + 작성 모드 분기(preferences store 재사용) + 사이드 패널 실데이터.
- **Week 4**: **신규 4 entity**(Memo/MemoProject/MemoProjectCharacter/ApiToken) + V6 마이그레이션 + 메모 CRUD/캡처/큐레이션 + 모바일 캡처(ApiTokenFilter stub 결선 + 멱등) + 토큰 관리 + inbox/큐레이션 frontend.

신규 endpoint = **14**(본문 3+nested 1 = 4 / 메모 7 / 토큰 4 에서 본문 nested 포함). **scope 제외**: 메모 핀(#36/#37) + 세션 노트 + 미리보기 완성(Week 5~6). 진행 = **MVP 라운드 분해**(R1 본문+에디터 → 검증 → R2~R5, research R-16).

## Technical Context

**Language/Version**:
- backend: Kotlin 2.2.21 on Java 24 toolchain (host Corretto 25)
- frontend: TypeScript 5.9 / Next.js 16.2.6 (App Router) / React 19.2

**Primary Dependencies**:
- backend(기존 그대로, **신규 0**): Spring Boot 4.0.6 starter-{web,security,data-jpa,validation,actuator,oauth2-client,mail}, Flyway, springdoc, jjwt, PostgreSQL JDBC, Testcontainers, MockK/mockito-kotlin, ktlint/Checkstyle. ApiToken 해시 = JDK `MessageDigest`(SHA-256), base62 = 표준 라이브러리 조합(신규 의존 없음).
- frontend(**기존 그대로**): `@tiptap/{react,starter-kit,pm}@3.23.5`(이미 설치), React Query, Zustand, vitest3+vite5+jsdom26+msw(005 인프라). **신규 0**.

**Storage**: PostgreSQL 17(로컬 docker / prod Supabase). 신규 마이그레이션 = **`V6__create_memos_and_api_tokens.sql`**(4 테이블, 핀 컬럼 Week 5 이연). Document 스키마 무변경. 모든 FK `ON DELETE CASCADE`(memo 계열) / `SET NULL`(active_project). tags `TEXT[]` + GIN.

**Testing**:
- backend: JUnit5+AssertJ+MockK 단위 / Spring Boot Test+Testcontainers 통합. `any()` 금지(정확값). JPA 1차 캐시 우회(`flush()+clear()`). N+1 회피 = Hibernate Statistics 쿼리 카운트(004 Phase 8 재사용). 멱등 캐시·optimistic lock 충돌은 IT.
- frontend: vitest(단위 — 자수/매수 계산, debounce, 충돌 분기, 큐레이션 차이) + RTL 행위 기준 + msw HTTP mock. TipTap 한국어 IME = PoC 0-1 4 케이스 dogfooding(자동화 외).
- 검증 게이트: backend `ktlint*+checkstyleMain+test+build` / frontend `lint+typecheck+test+build` 둘 다 GREEN + 003/004/005 회귀.

**Target Platform**: Render(backend, cold start 감내) + Vercel(frontend) + Supabase(prod DB). 로컬 dev = macOS.

**Project Type**: Monorepo web application — `backend/` + `frontend/` 둘 다 변경. `docs/plan/02-progress.md` + vault 는 완료 시점 갱신. `docs/plan/00-stack`·`01-phase` 는 충돌 정책 정정으로 이미 갱신(커밋 `364485e`).

**Performance Goals**: 본인 1명 V1 dogfooding. 자동 저장 응답 < 300ms(단일 사용자), 메모 목록 N+1 = **0회**(HARD-GATE). 에디터 한국어 입력 지연 체감 0(PoC 통과 기준).

**Constraints**:
- **외부 인프라 안전(HARD-GATE)**: V6 작성·리뷰 OK, **적용은 사용자 명시 컨펌**.
- **RSC 경계(HARD-GATE)**: 에디터/원고지/모달/큐레이션 폼/토큰 UI = 모두 `'use client'`(hook·이벤트 핸들러). page 작성 직후 `pnpm build` 로 검출(`.claude/rules/typescript/code-quality.md`).
- **TipTap 한국어 IME 회귀(HARD-GATE)**: extension 변경 시 PoC 0-1 4 케이스 재검증.
- **트랜잭션**: 쓰기 `@Transactional(rollbackFor = [Exception::class])`(배열 인자), 읽기 `readOnly=true`. 큐레이션 차이 계산 = 단일 트랜잭션. 모든 연관 `LAZY`.
- **API contract**: `Result<T>` envelope 통일. DTO 네이밍 `Create/Update{Entity}Request`·`{Entity}Response`.
- **검증 minimize**: 라운드별 좁은 테스트 + 마지막 전체 1회(`long-running-bash.md`). 빌드/테스트 = 포어그라운드 의무(CLAUDE.md).

**Scale/Scope**:
- endpoint 14 / 신규 entity 4(+Document 동작) / 마이그레이션 1 / frontend view 갱신 다수(write 에디터·원고지·사이드, memos inbox·큐레이션, settings 토큰, ⌘+N 모달)
- LOC 추정 backend ~1800~2400(entity4+repo4+service~4+filter 결선+controller~4+DTO~20+migration+테스트) / frontend ~2000~2800(에디터·원고지·자동저장 hook·캡처·inbox·큐레이션·토큰 UI+테스트). **대형 — `multi-round-implementation.md` 적용, R-16 라운드 분해 의무**.

## Constitution Check

*GATE: Phase 0 전 통과, Phase 1 후 재확인.*

`.specify/memory/constitution.md` 는 placeholder. effective gates 는 프로젝트 SoT + 룰에서 도출(004 plan 양식 정합):

- **Backend SoT gate**: 모든 백엔드 정책은 `docs/plan/03-backend-requirements.md` 인용. 본 spec 의 신규 결정(nested document endpoint) 은 SoT §6 변경이력에 행 추가 의무.
- **Context persistence gate**: 모든 산출물 `specs/006-phase-3-4-editor-memo/`. 루트 `CLAUDE.md` SPECKIT 마커 본 plan 으로 갱신.
- **External infra safety(HARD-GATE)**: V6 적용은 사용자 컨펌. 로컬 docker postgres 선행.
- **Quality gate**: backend `ktlint*+checkstyleMain+test+build` / frontend `lint+typecheck+test+build` 단일 GREEN.
- **TDD HARD-GATE**: optimistic lock 충돌 분기, word_count 계산, 멱등 캐시, 큐레이션 차이 계산, 인물-프로젝트 무결성 검증, ApiToken 해시·해지 검증, 자수/매수 계산 = RED→GREEN 의무. 매핑/상태전이/분기 영역(`testing-strategy.md`).
- **JPA 1차 캐시 우회 + N+1(HARD-GATE)**: 신설 repository IT 는 `flush()+clear()`. 메모 목록 `@EntityGraph`/`JOIN FETCH` → 쿼리 카운트 검증(SC).
- **RSC 경계(HARD-GATE)**: 신규 client 컴포넌트 작성 직후 `pnpm build` 검출. `frontend/AGENTS.md` 가이드(`node_modules/next/dist/docs/` 존재 확인 완료) 정독.
- **TipTap 한국어 IME(HARD-GATE)**: PoC 0-1 4 케이스 회귀.
- **API contract gate**: `Result<T>` 통일. nested 조회·캡처·큐레이션·토큰 모두 envelope.
- **Subagent dispatch cost gate**: LOC 대형 → 라운드 분해 + 일부 위임 검토. dispatch prompt = 검증 2개 이하/commit 금지/tool_uses 50 cap/같은 에러 3회 금지(`subagent-delegation-cost.md`).
- **Context persistence(vault) gate**: 본 spec 완료/merge 시 vault `02-PROGRESS` §완료 + §진입점 + `03-ISSUES`(발견 시) 갱신.

**Initial gate status: PASS**. Complexity Tracking 위반 없음(신규 의존 0, 신규 프로젝트 0, 기존 패턴 재사용).

## Project Structure

### Documentation (this feature)

```text
specs/006-phase-3-4-editor-memo/
├── spec.md                 # specify+clarify 결과 (US1~5 / FR24 / SC8 / Out of Scope / Clarifications)
├── plan.md                 # 본 파일
├── research.md             # Phase 0 — R-1~R-16 (TipTap/원고지/충돌/nested/entity/멱등/토큰/라운드)
├── data-model.md           # Phase 1 — Memo/MemoProject/MemoProjectCharacter/ApiToken + V6 SQL + Document 재사용
├── quickstart.md           # Phase 1 — 로컬 dogfooding 라운드별 시나리오
├── contracts/
│   ├── document-endpoints.md   # 본문 4 (nested 조회 + 단건 + 자동저장 409 + title)
│   ├── memo-endpoints.md       # 메모 7 (CRUD + 데스크탑/모바일 캡처 + 큐레이션)
│   └── api-token-endpoints.md  # 토큰 4 (발급 1회표시/목록/label/해지)
├── checklists/requirements.md  # spec 품질 체크 (전 항목 통과)
└── tasks.md                # Phase 2 — /speckit-tasks (본 plan 에서 미생성)
```

### Source Code (repository root)

```text
backend/src/main/kotlin/com/writenote/
├── entity/          # Memo, MemoProject, MemoProjectCharacter, ApiToken 신규 (Document 재사용)
├── repository/      # MemoRepository(@EntityGraph), MemoProjectRepository, ApiTokenRepository 신규 (DocumentRepository 재사용)
├── service/         # DocumentService, MemoService, MemoCurationService, ApiTokenService 신규
├── controller/      # DocumentController, MemoController, CaptureController, ApiTokenController 신규
├── auth/            # ApiTokenAuthenticationFilter — stub → 실제 결선 (R-11)
├── model/request,response/  # DTO ~20 신규
├── components/      # IdempotencyCache(5분 TTL, R-9), 자수 계산기, 인물-프로젝트 무결성 validator
└── config/          # SecurityConfig — ApiTokenFilter 결선 확인 (기존 등록 재사용)
backend/src/main/resources/db/migration/
└── V6__create_memos_and_api_tokens.sql   # 신규

frontend/src/
├── app/write/           # page.tsx(에디터/원고지 실구현), layout.tsx(사이드 실데이터)
│   └── preview/         # (미리보기 완성은 Week 6 — 본 spec 골격 유지)
├── app/memos/           # page.tsx(inbox 실데이터 + 큐레이션)
├── app/settings/        # 토큰 관리 UI 추가
├── components/editor/   # TipTap 에디터, 원고지 격자 오버레이 (신규)
├── components/memos/    # 큐레이션 카드, 필터 칩, ⌘+N 모달 (신규)
├── components/shell/    # TopBar/SidePanel/ProgressRing (재사용 + 실데이터)
├── lib/api/             # document.ts, memo.ts, apiToken.ts (신규 — React Query 훅)
├── hooks/               # useAutoSave(800ms debounce + 409), useGlobalShortcut(⌘+N) (신규)
├── stores/              # preferences(writingMode/manuscriptSize 재사용), ui(활성 프로젝트 — R-7 search param 병용)
└── types/               # api 타입 확장
```

**Structure Decision**: 기존 monorepo(`backend/`+`frontend/`) 그대로. 신규 디렉토리 = `components/editor`, `components/memos`, `hooks`(없으면 신설). 나머지는 기존 패턴 확장. 신규 프로젝트·의존성 0.

## Complexity Tracking

> Constitution Check 위반 없음 — 본 표 비움.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (없음) | — | — |
