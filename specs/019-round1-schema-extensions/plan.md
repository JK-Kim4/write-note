# Implementation Plan: Round 1 스키마 확장 기능 — 곁쪽지 삭제·설정 영속·등장인물 확장

**Branch**: `019-round1-schema-extensions` | **Date**: 2026-06-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/019-round1-schema-extensions/spec.md`

## Summary

Web 런칭 V1 의 Round 1 — DB 스키마 확장을 동반하는 독립 기능 3종을 한 spec 의 User Story 3개로 묶는다.
- **US1(P1) 곁쪽지 버리기/되돌리기**: `memos.deleted_at` 추가(V9), DELETE 를 hard→soft 전환(연결행 보존), `POST /restore` 신설, 목록 7개 표면에 deleted 제외 필터. FE 는 desktop MemoInboxScreen 패턴(낙관적 제거 + Toast) 1:1 이식.
- **US2(P2) 설정 서버 영속**: `user_settings` key-value 테이블(V10) + `GET/PUT /api/settings`. FE 는 zustand persist 를 캐시로 두고 서버를 SoT 로 하는 동기화 레이어 추가(FOUC 스크립트·기존 store 소비자 무변경).
- **US3(P3) 등장인물 확장**: `characters` 에 age(자유 텍스트)·gender(코드+CHECK)·traits(자유 텍스트) 추가(V11), 6개 endpoint DTO 확장, CharacterForm 입력 확장 + Rail 진입 메뉴.

기술 접근은 전부 기존 코드 실측(research.md)에 근거하며, 신규 에러 코드·신규 HTTP status 분기 없음. 마이그레이션은 로컬 dev DB 한정, 운영은 Round 4 일괄.

## Technical Context

**Language/Version**: Kotlin 2.2 (백엔드, Java 24 toolchain) / TypeScript 5.9 + React 19.2 (프론트, Next.js 16.2 App Router)

**Primary Dependencies**: Spring Boot 4.0.6 (Web/Security/Data JPA/Validation), Flyway / React Query + Zustand(persist), TipTap

**Storage**: PostgreSQL (로컬 dev = docker compose / 테스트 = Testcontainers). 신규 마이그레이션 V9·V10·V11

**Testing**: JUnit 5 + AssertJ + MockK + Spring Boot Test + Testcontainers (백엔드) / Vitest + RTL (프론트)

**Target Platform**: web (Vercel 프론트 / Render 백엔드 — 운영 배포는 Round 4)

**Project Type**: web application (backend + frontend 분리)

**Performance Goals**: 표준 웹 응답성. soft-delete 필터는 `idx_memos_user_active` 부분 인덱스로 정상행 커버

**Constraints**:
- 마이그레이션 로컬 dev 한정 — 운영 Supabase 쓰기는 사용자 컨펌(external-infra-safety HARD-GATE)
- FOUC(테마 깜빡임) 0회 — 서버 동기화가 localStorage 캐시를 갱신, blocking inline script 무변경
- 기존 데이터 무손상 — 곁쪽지·기존 인물·기존 설정 유실 0
- 세 US 상호 의존 0 — 독립 구현·검증·dogfooding

**Scale/Scope**: 백엔드 마이그레이션 3 + 신규 엔티티 1(UserSetting) + 기존 엔티티 2 확장(Memo·Character) + 신규 endpoint 3(restore·GET/PUT settings) + DTO 확장. 프론트 신규 컴포넌트 2(Toast·PreferencesSync) + 화면 3 확장(memos·settings 동기화·CharacterForm) + Rail 1

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

프로젝트 constitution(`.specify/memory/constitution.md`)은 템플릿 플레이스홀더 상태(미비준)다. 대신 본 프로젝트의 실효 게이트인 **CLAUDE.md HARD-GATE + `.claude/rules/`** 를 적용한다:

| 게이트 | 적용 | 상태 |
|---|---|---|
| 외부 인프라 안전(external-infra-safety) | 마이그레이션 로컬 dev 한정, 운영 적용은 Round 4 사용자 컨펌 | ✅ plan 에 명시 |
| 빌드/테스트 포어그라운드 실행 | `./gradlew test`·`pnpm build` foreground | ✅ quickstart 명시 |
| TS code-quality (RSC 경계·any 금지·status 분기) | Toast/PreferencesSync `'use client'`, 신규 status 분기 없음 | ✅ research D2·D8 |
| Kotlin code-quality (`[Exception::class]`·생성자 주입) | 신규 service 기존 패턴 정합 | ✅ research D3 |
| 한국어 영역 검증 cadence | TipTap/폰트 변경 없음 — 해당 없음 | ✅ N/A |
| 명세 정합성 검증(agent-workflow-discipline §5·§6) | spec/plan 의 파일명·endpoint·시그니처를 실측 grep 으로 확정 | ✅ research 전반 |

**위반 없음** — Complexity Tracking 불요.

## Project Structure

### Documentation (this feature)

```text
specs/019-round1-schema-extensions/
├── plan.md              # 본 파일
├── spec.md              # /speckit-specify 산출
├── research.md          # Phase 0 — D1~D11 결정
├── data-model.md        # Phase 1 — 엔티티 3 + 마이그레이션 3
├── contracts/
│   └── api-contracts.md # Phase 1 — endpoint 계약(US별)
├── quickstart.md        # Phase 1 — 구현·검증 진입점
├── checklists/
│   └── requirements.md  # spec 품질 체크리스트
└── tasks.md             # Phase 2 — /speckit-tasks 산출(미생성)
```

### Source Code (repository root)

```text
backend/src/main/kotlin/com/writenote/
├── entity/
│   ├── Memo.kt                    # deletedAt 추가
│   ├── Character.kt               # age·gender·traits 추가
│   └── UserSetting.kt             # 신규
├── repository/
│   ├── MemoRepository.kt          # 6 쿼리 deleted 필터 + findByIdAndUserIdAndDeletedAtIsNull
│   ├── MemoProjectRepository.kt   # findAllByProjectIdWithMemo deleted 필터
│   └── UserSettingRepository.kt   # 신규
├── service/
│   ├── MemoEditService.kt         # deleteMemo soft 전환 + restoreMemo 신설
│   ├── MemoQueryService.kt        # 단건 경로 deleted 필터
│   ├── MemoPinService.kt          # 조회 경로 deleted 필터
│   ├── CharacterService.kt        # 3필드 매핑
│   └── SettingsService.kt         # 신규(allowlist 검증 + upsert)
├── controller/
│   ├── MemoController.kt          # POST /{id}/restore
│   └── SettingsController.kt      # 신규 GET/PUT /api/settings
├── mapper/CharacterMapper.kt      # 3필드 매핑
└── model/
    ├── request/{Create,Update}CharacterRequest.kt   # 3필드
    ├── response/CharacterResponse.kt                 # 3필드
    └── (settings request/response 신규)
backend/src/main/resources/db/migration/
├── V9__add_memos_deleted_at.sql        # 신규
├── V10__create_user_settings.sql       # 신규
└── V11__expand_characters_age_gender_traits.sql  # 신규

frontend/src/
├── components/ui/Toast.tsx        # 신규(desktop 포팅)
├── components/projects/CharacterForm.tsx  # 나이·성별·특징
├── components/workspace/Rail.tsx  # 등장인물 메뉴
├── components/PreferencesSync.tsx # 신규(서버↔store 동기화)
├── lib/api/memo.ts                # restoreMemo
├── lib/api/settings.ts            # 신규(fetch/put)
├── lib/api/characters.ts          # 입력 타입 확장
├── lib/electron-api/memos.ts      # delete/restore(보류 해소)
├── stores/preferences.ts          # 캐시 유지(소비 무변경)
└── app/memos/page.tsx             # 삭제 버튼 + Toast
```

**Structure Decision**: 기존 web application 구조(backend + frontend) 그대로. 신규 디렉토리 없음 — 기존 레이어(entity/repository/service/controller, components/lib/api)에 파일 추가·확장. US별로 파일이 거의 겹치지 않아(Memo / UserSetting / Character) 병렬 구현 가능.

## Complexity Tracking

위반 없음 — 비움.
