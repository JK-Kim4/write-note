# Implementation Plan: 마이페이지 계정 셸 재구성

**Branch**: `037-mypage-account-shell` | **Date**: 2026-06-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/037-mypage-account-shell/spec.md`

## Summary

036 마이페이지를 **좌측 사이드 메뉴를 가진 계정 셸**로 재구성한다. 중첩 라우트 `/mypage/{섹션}`(profile·settings·connections·withdraw)로 각 섹션이 독립 URL을 갖고, 사이드 메뉴는 마이페이지 layout 으로 공유한다. 기존 `/settings`(테마·용지·목표·탈퇴)를 환경설정 섹션으로 흡수하고 `/settings`는 `/mypage/settings`로 리다이렉트, 헤더 nav 의 "설정"을 제거해 마이페이지 단일 진입점으로 통합한다. "계정 연결" 섹션은 신규로, 로그인 수단 연결 상태(이메일/비밀번호·카카오)를 표시하고 미연결 수단을 추가 연결(기존 `/link/kakao`·`/link/email` 재사용)한다. 해제는 백엔드 미지원이라 범위 밖.

대부분 프론트 IA 재배치이며, 백엔드 변경은 계정 연결 UI 가 "비밀번호 설정 여부"를 판단할 수 있도록 `AuthMeResponse` 에 `passwordSet`(additive) 1개를 더하는 것뿐이다.

## Technical Context

**Language/Version**: TypeScript 5.9 + React 19.2 (Next.js 16 App Router) 주축 / Kotlin 2.2 + Spring Boot 4.0.6 (additive 1)

**Primary Dependencies**: Next.js 중첩 라우트(layout)·`next.config` redirects / React Query·Zustand(preferences) / 기존 `/link/*` 인증 흐름

**Storage**: 변경 없음(기존 User·user_settings 재사용). 신규 마이그레이션 0.

**Testing**: Vitest + RTL(FE) / JUnit + MockK(BE additive)

**Target Platform**: 웹 (Vercel 프론트 + OCI 백엔드)

**Project Type**: Web application (frontend 주축 + backend additive)

**Performance Goals**: 섹션 전환은 클라이언트 네비게이션 수준. 마이페이지 데이터는 기존 `["auth","me"]`·`["settings"]` 쿼리 재사용(신규 fetch 최소).

**Constraints**: 신규 status·에러코드 0. 마이그레이션 0. 기존 기능(환경설정·탈퇴·닉네임) 동작 보존(회귀 0). 계정 연결 해제 미제공(백엔드 부재).

**Scale/Scope**: 프론트 — 신규 라우트 4(profile·settings·connections·withdraw) + mypage layout + 헤더/리다이렉트 정리 + 컴포넌트 추출 다수. 백엔드 — `AuthMeResponse.passwordSet` additive 1 + 매핑.

**NEEDS CLARIFICATION (구현 시 실측)**: 카카오 추가 연결 시작(POST `/api/auth/link/kakao` → 302 `/api/auth/oauth/kakao`)의 **브라우저 트리거 방식** — fetch(redirect:'manual') 후 `window.location` 이동 vs 직접 네비게이션. CsrfDefenseFilter(X-WriteNote-Client 헤더 요구)·session(linkUserId) 동작을 R2 에서 실측해 확정한다(dogfooding 게이트).

## Constitution Check

*constitution.md 빈 템플릿 → CLAUDE.md + `.claude/rules/` 준용(036 동일 관례).*

| 게이트 | 판정 | 근거 |
|---|---|---|
| 추측 금지 (HARD-GATE) | ✅ | `/link/*` 흐름·unlink 부재·온보딩 투어 무영향·`/settings` 참조 2곳·next docs 존재 전부 코드 확인. 카카오 시작 흐름은 불확실로 **명시**(실측 위임, 추측 안 함) |
| 단순성 | ✅ | 기존 컴포넌트 재사용·재배치 중심, BE additive 1, 마이그레이션 0 |
| Surgical Changes | ✅ | 설정 내용은 동작 보존하며 위치만 이동. 헤더는 nav 항목 제거 + 리다이렉트 |
| TDD | ✅ | FE 섹션 RTL(딥링크·기능 보존)·BE passwordSet 단위 |
| 한국어 | ✅ | UI·안내 한국어 |
| 배포 순서 | ✅ | R1(FE 단독, BE 0) / R2(BE passwordSet 선행 → FE 계정 연결) |

위반 없음 → Complexity Tracking 불필요.

## Project Structure

### Documentation (this feature)

```text
specs/037-mypage-account-shell/
├── plan.md
├── research.md          # 라우트 구조·리다이렉트·계정연결 흐름·passwordSet 결정
├── data-model.md        # AuthMeResponse.passwordSet additive·연결상태 파생
├── contracts/
│   ├── account-link-ui.md       # 기존 /link/* 재사용 + 카카오 시작 흐름(실측)
│   └── auth-me-passwordset.md    # AuthMeResponse additive
├── quickstart.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
frontend/src/app/(main)/
├── mypage/
│   ├── layout.tsx              # (신규) 사이드 메뉴 셸 — 좌 메뉴 + 우 children, 활성 강조
│   ├── page.tsx                # (변경) /mypage → /mypage/profile 리다이렉트
│   ├── profile/page.tsx        # (신규) 닉네임(036)+계정정보(036) 재사용
│   ├── settings/page.tsx       # (신규) 환경설정 — 기존 settings 내용 이동
│   ├── connections/page.tsx    # (신규) 계정 연결
│   └── withdraw/page.tsx       # (신규) 회원 탈퇴(기존 모달 이동)
├── settings/page.tsx           # (제거) — next.config redirects 로 /mypage/settings 대체
└── layout.tsx                  # (변경) NAV_ITEMS 에서 "설정" 제거, 마이페이지 진입점 유지

frontend/src/app/auth/link-success/page.tsx  # (변경) 연결 성공 후 목적지 /settings → /mypage/connections

frontend/src/components/mypage/
├── MypageSidebar.tsx           # (신규) 사이드 메뉴(섹션 링크+활성 강조, 탈퇴 하단 분리)
├── NicknameSection.tsx         # (재사용, 036)
├── AccountInfoSection.tsx      # (재사용, 036)
├── PreferencesSections.tsx     # (신규 추출) 테마·기본 용지·일일 목표(기존 settings page 에서)
├── WithdrawSection.tsx         # (신규 추출) 회원 탈퇴 모달
└── ConnectionsSection.tsx      # (신규) 계정 연결 — 상태 표시 + 카카오 연결/비밀번호 추가

frontend/next.config.ts          # (변경) redirects() 에 /settings → /mypage/settings 추가
frontend/src/types/api.ts        # (변경) AuthMeResponse 에 passwordSet 추가

backend/src/main/kotlin/com/writenote/
├── model/response/AuthMeResponse.kt   # (변경) passwordSet: Boolean additive
└── components/UserAuthConverter.kt    # (변경) passwordSet = user.passwordHash != null
```

**Structure Decision**: Next App Router 중첩 라우트 — `mypage/layout.tsx` 가 사이드 메뉴 셸을 제공하고 각 섹션은 하위 라우트 세그먼트. 기존 `settings/page.tsx` 의 4블록(테마·용지·목표·탈퇴)을 컴포넌트로 추출해 마이페이지 섹션에 재배치(중복 구현 회피·동작 보존). `/settings` 는 `next.config` 정적 리다이렉트(기존 redirects() 사용 중과 일관).

## 라운드 분해 (배포 단위)

### R1 — 마이페이지 셸 + 환경설정 흡수 (FE 단독, BE 0) — US1·US2

1. **mypage layout 셸 + MypageSidebar** → verify: RTL — 5개 메뉴 렌더·활성 강조·탈퇴 하단 분리
2. **profile 섹션**(NicknameSection+AccountInfoSection 재사용) + **/mypage→profile 리다이렉트** → verify: 딥링크·새로고침
3. **PreferencesSections·WithdrawSection 추출** + settings/withdraw 섹션 페이지 → verify: 테마·용지·목표 변경 동작 보존(회귀)·탈퇴 모달 보존
4. **/settings 리다이렉트**(next.config) + **헤더 nav "설정" 제거** + **link-success 목적지 변경** → verify: /settings 진입 시 /mypage/settings, 헤더 중복 진입점 0
5. **문의 메뉴**(사이드 메뉴 → /contact 링크) → verify: 링크 존재

**R1 게이트**: `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build`(RSC 경계). BE 변경 0 → FE 단독 배포.

### R2 — 계정 연결 (BE additive 선행 → FE) — US3

1. **BE**: `AuthMeResponse.passwordSet`(additive) + `UserAuthConverter` 매핑(`passwordHash != null`) → verify: me() 응답 passwordSet, 기존 테스트 회귀 0
2. **FE types**: `AuthMeResponse.passwordSet` → verify: typecheck
3. **ConnectionsSection + connections 섹션**: 연결 상태 표시(kakaoLinked·passwordSet) + 미연결 수단 액션 → verify: RTL — 이메일가입자=카카오 연결 노출 / 카카오가입자=비밀번호 추가 노출 / 둘다연결=액션 없음
4. **비밀번호 추가 등록**(POST `/api/auth/link/email`, 공용 client) → verify: 폼 제출·PASSWORD_ALREADY_SET 처리
5. **카카오 추가 연결 시작**(POST `/api/auth/link/kakao` → 302 OAuth) → ⚠️ **R2 실측**: 브라우저 트리거 방식 확정(fetch manual + window.location vs 직접). CSRF 헤더·session 동작 dogfooding 검증

**R2 게이트**: BE `./gradlew ... test build` + FE 게이트. **BE passwordSet 선행 배포 → FE**.

### dogfooding 게이트 (R1·R2 후, 로컬 3종 기동)

- 사이드 메뉴 5개 전환·딥링크·새로고침
- 환경설정(테마·용지·목표) 동작 보존 + /settings → /mypage/settings
- 회원 탈퇴 모달 보존
- 계정 연결: 연결 상태 정확 + 카카오 연결 시작(실측 핵심)·비밀번호 추가

## Complexity Tracking

해당 없음(Constitution Check 위반 0).
