# Implementation Plan: 홈(메인) 페이지 개선

**Branch**: `develop` (전용 브랜치 미생성 — 사용자 지시) | **Date**: 2026-06-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/028-home-page-improvements/spec.md`

## Summary

홈(`/`) 페이지 3개 개선을 한 묶음으로 처리한다.

1. **US1 (P1) 집필 리듬 즉시 반영 + 오늘 강조 + 임계 완화** — 집필 세션 종료 후 홈 복귀 시 작업시간이 곧바로 갱신되도록 React Query 무효화/재요청을 결선하고, 오늘 막대를 날짜와 함께 강조하며, 빈 주 안내를 추가한다. 세션 최소 인정 시간 임계를 15초→10초로 완화(`application.yml`). **빈 막대 근본 원인은 구현 1단계에서 라이브 관찰로 확정**한다(추측 금지).
2. **US2 (P2) 오늘 작업시간 원통형 게이지 + 일일 목표 설정** — 기존 주간 요일별 집계의 `dayMs[today]`(신규 fetch 0)로 게이지를 그리고, 일일 목표를 사용자 환경설정 신규 키 `dailyGoalMinutes`(이산값, 기본 60)로 추가해 설정 페이지에서 변경·다기기 동기화한다.
3. **US3 (P3) 인사 문학 인용구 회전** — 인사 부제 뒷문구를 repo 내장 정적 큐레이션 인용구의 무작위 회전으로 교체한다("안녕하세요."·날짜·저자 표기 유지).

**배포 순서(HARD-GATE)**: 설정 키 추가는 BE 선행 → FE 후행. FE가 모르는 키를 PUT하면 BE가 설정 PUT 전체를 400으로 거부한다.

## Technical Context

**Language/Version**: TypeScript 5.9 / React 19.2 / Next.js 16 (App Router) · Kotlin 2.2 / Spring Boot 4.0.6 (Java 24 toolchain)

**Primary Dependencies**: React Query(@tanstack/react-query 5), Zustand(preferences store), Tailwind. 백엔드는 신규 의존 없음.

**Storage**: 기존 `user_settings`(key-value) 테이블 재사용 — **신규 마이그레이션 없음**(신규 키는 행 추가일 뿐 스키마 변경 0). 작업시간은 기존 `work_sessions` 집계 재사용.

**Testing**: Vitest + RTL(프론트), JUnit5 + AssertJ(백엔드 SettingsService allowlist). dogfooding 게이트(라이브 즉시 반영·게이지·인용구).

**Target Platform**: Web(Vercel FE + OCI BE), 데스크톱/모바일 웹 브라우저.

**Project Type**: Web application (frontend + backend 분리, same-origin 프록시).

**Performance Goals**: 신규 네트워크 비용 최소 — US2 게이지는 기존 weekly 쿼리 재사용(추가 fetch 0). US1 즉시 반영은 홈 mount 시 weekly 재요청(요일별 ≤7 GET, 기존과 동일).

**Constraints**: 백엔드 변경 2줄(application.yml 임계 1줄 + SettingsService ALLOWED 1줄). 신규 endpoint·신규 테이블 0. 기존 한국어/접근성/RSC 경계 룰 준수.

**Scale/Scope**: 단일 사용자 집필 도구. 홈 1화면 + 설정 1항목 + 인용구 데이터 1파일.

## Constitution Check

`.specify/memory/constitution.md`는 미작성 템플릿 → 프로젝트 게이트는 `CLAUDE.md` + `.claude/rules/*`가 실질 규율. 본 계획의 자가 점검:

- **추측 금지(HARD-GATE)**: 빈 막대 원인은 구현 1단계 라이브 관찰로 확정. 코드 정독으로 데이터 흐름·임계값(15초)·캐싱(60초, 무효화 없음) 사실 확정 완료. ✅
- **TDD 규율(§5)**: SettingsService allowlist(행위), `pickRandom`/게이지 채움 계산/빈 상태(순수함수·RTL)는 Red→Green. 설정파일(application.yml)·데이터 파일(인용구 목록)은 §5-5 완화 영역. ✅
- **Surgical change(§3)**: 기존 컴포넌트(`BRhythmCard`)·훅(`useWorkSession`)·스토어(`preferences`)·동기화(`PreferencesSync`)에 최소 결선. 인접 리팩토링 금지. ✅
- **TS 코드 퀄리티**: `'use client'` 경계(이벤트/훅) 준수, `enum` 회피(이산값은 union/const), `error.code` 분기 무관(신규 status 분기 없음). ✅
- **배포 순서 HARD-GATE**: BE 선행 → FE 후행 명시(FR-012). ✅
- **외부 인프라 안전**: 로컬/운영 DB 쓰기 없음(신규 행은 런타임 사용자 PUT으로 생성, migrate 불필요). OCI env `WORK_SESSION_MIN_SECONDS` override 가능성은 사용자 영역으로 surfacing. ✅

게이트 위반 없음 → Phase 0 진행.

## Project Structure

### Documentation (this feature)

```text
specs/028-home-page-improvements/
├── plan.md              # 본 파일
├── research.md          # Phase 0 — 데이터 흐름·결정·대안
├── data-model.md        # Phase 1 — dailyGoalMinutes / 인용구 / 게이지 파생
├── quickstart.md        # Phase 1 — 구현 순서·검증·dogfooding
├── contracts/
│   └── ui-and-settings.md  # 설정 키 계약 + 홈 UI 계약
├── checklists/
│   └── requirements.md  # spec 품질 체크리스트(완료)
└── tasks.md             # /speckit-tasks 산출 (본 명령 아님)
```

### Source Code (repository root)

```text
backend/src/main/
├── resources/application.yml                         # [수정] work-session.min-session-seconds 15→10
└── kotlin/com/writenote/service/SettingsService.kt   # [수정] ALLOWED 에 dailyGoalMinutes 1줄
backend/src/test/kotlin/com/writenote/service/
└── SettingsServiceTest.kt                            # [수정/신규] dailyGoalMinutes allowlist 검증

frontend/src/
├── lib/
│   ├── literaryQuotes.ts            # [신규] 정적 인용구 목록 + pickRandom 순수함수
│   ├── todayGauge.ts                # [신규] 게이지 채움/표시 계산 순수함수 (또는 dashboardView 에 합류)
│   └── query/
│       ├── useSessions.ts           # [수정] useWeeklyByDay refetchOnMount: "always"
│       └── (invalidate 헬퍼)        # sessionKeys.all 무효화 결선
├── hooks/useWorkSession.ts          # [수정] end/endWithLog 후 sessions 쿼리 invalidate
├── stores/preferences.ts            # [수정] dailyGoalMinutes 필드+세터+기본값
├── components/
│   ├── PreferencesSync.tsx          # [수정] toMap/hydrate/시딩에 dailyGoalMinutes 포함
│   └── b/dashboard/
│       ├── BRhythmCard.tsx          # [수정] 오늘 날짜+강조, 빈 상태 안내
│       └── BTodayGauge.tsx          # [신규] 오늘 작업시간 원통형 게이지
└── app/(main)/
    ├── page.tsx                     # [수정] 인용구 부제, 게이지 배치, 오늘 강조 데이터 전달
    └── settings/page.tsx            # [수정] 일일 목표 select 추가
```

**Structure Decision**: 기존 web application 구조 그대로. 신규 파일은 프론트 3개(`literaryQuotes.ts`, `todayGauge.ts`, `BTodayGauge.tsx`), 나머지는 기존 파일 최소 수정. 백엔드는 2줄 수정 + 테스트.

## Complexity Tracking

> 게이트 위반 없음 — 비움.
