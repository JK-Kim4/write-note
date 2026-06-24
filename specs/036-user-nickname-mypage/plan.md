# Implementation Plan: 사용자 닉네임 + 마이페이지

**Branch**: `036-user-nickname-mypage` | **Date**: 2026-06-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/036-user-nickname-mypage/spec.md`

## Summary

사용자 계정에 **고유·필수·변경 가능한 닉네임**을 추가한다. 신규 가입(이메일·카카오) 시 시스템이 큐레이션된 한글 단어 조합(수식어+명사+숫자)으로 닉네임을 자동 부여하고, 기존 회원은 마이그레이션에서 `사용자<id>` 단순값으로 백필해 닉네임 미보유 계정이 없게 한다. 사용자는 신설 마이페이지(`/mypage`, 기존 `/settings`와 분리)에서 닉네임을 변경(중복·형식·금칙어 검증)하고 계정정보(이메일·가입방식·가입일)를 확인한다. 닉네임은 추후 공유/첨삭 기능의 식별자 토대다.

기술 접근: 단일 마이그레이션(V23)으로 컬럼 추가→백필→NOT NULL+UNIQUE. 닉네임 생성은 외부 의존성 없이 큐레이션 단어사전 상수 + 충돌 시 재추첨. 직접 입력은 금칙어 사전으로 사전 차단. 에러는 기존 `AuthErrorCode`/`AuthException`/`Result` envelope 재사용.

## Technical Context

**Language/Version**: Kotlin 2.2 (백엔드, Java 24 toolchain) / TypeScript 5.9 + React 19.2 (프론트, Next.js 16 App Router)

**Primary Dependencies**: Spring Boot 4.0.6 (Web/Security/Data JPA/Validation), Flyway / React Query + Zustand, TipTap 무관

**Storage**: PostgreSQL — `users` 테이블에 `nickname` 컬럼 추가(V23)

**Testing**: JUnit 5 + AssertJ + MockK + Testcontainers (BE) / Vitest + RTL (FE)

**Target Platform**: 웹 (Vercel 프론트 + OCI 백엔드)

**Project Type**: Web application (backend + frontend)

**Performance Goals**: 닉네임 자동 생성 충돌 재추첨이 실질적으로 1~2회 내 수렴(조합 공간 수천만). 닉네임 변경은 일반 CRUD 수준 응답.

**Constraints**: 닉네임 2~16자 / 한글·영문·숫자·밑줄 / 정확일치 중복판정. 신규 status·에러코드 envelope 변경 0(기존 재사용). 회원가입 요청 폼 무변경.

**Scale/Scope**: 백엔드 — 마이그레이션 1, 엔티티 필드 1, 신규 컴포넌트 2(생성기·금칙어검증), 신규 컨트롤러 1(닉네임 변경), DTO 확장 1, 에러코드 +3. 프론트 — 신규 라우트 1(`/mypage`), 신규 컴포넌트 소수, 헤더 진입점 1.

## Constitution Check

*프로젝트 constitution.md 는 빈 템플릿 → CLAUDE.md + `.claude/rules/` 룰 준용(033·034 plan 과 동일 관례).*

| 게이트 | 판정 | 근거 |
|---|---|---|
| 추측 금지 (HARD-GATE) | ✅ | User 엔티티·마이그레이션 버전(V22→V23)·에러처리 패턴·me() 매핑·검증 패턴 전부 실제 코드 확인 완료 |
| 단정 금지 | ✅ | 닉네임 생성 라이브러리 유무 WebSearch 검증(ko-nickname=JS 전용 확인), 직접 단어사전 결정 |
| 단순성 (Simplicity First) | ✅ | 외부 의존성 0, 마이그레이션 1개, 기존 에러 enum/envelope 재사용, 신규 enum 미생성 |
| Surgical Changes | ✅ | 회원가입 요청 DTO·폼 무변경(닉네임 부여는 User 생성 시 1줄). me() 매핑에 필드 2개 추가 |
| TDD (Red-Green-Refactor) | ✅ | R1 BE 생성기·검증·중복은 행위 단위 테스트 우선. R2 FE 폼 검증 RTL |
| 한국어 | ✅ | 에러 메시지·UI 한국어 |
| 배포 순서 (방향 의존) | ✅ | BE 선행→FE 후행 (FE 가 nickname 을 기대하므로 BE 가 먼저 내려야 함) |

위반 없음 → Complexity Tracking 불필요.

## Project Structure

### Documentation (this feature)

```text
specs/036-user-nickname-mypage/
├── plan.md              # 본 파일
├── research.md          # Phase 0 — 결정 기록(생성방식·백필·제약순서·에러코드)
├── data-model.md        # Phase 1 — User.nickname·V23·검증규칙·DTO 확장
├── contracts/           # Phase 1 — 닉네임 변경 endpoint·me 확장 계약
│   ├── nickname-change.md
│   └── auth-me-extension.md
├── quickstart.md        # Phase 1 — dogfooding 시나리오
├── checklists/
│   └── requirements.md  # spec 품질 체크리스트(완료)
└── tasks.md             # Phase 2 — /speckit-tasks 산출(본 명령 아님)
```

### Source Code (repository root)

```text
backend/src/main/kotlin/com/writenote/
├── entity/User.kt                          # nickname: String 필드 추가
├── enums/AuthErrorCode.kt                  # NICKNAME_INVALID_FORMAT / NICKNAME_ALREADY_REGISTERED / NICKNAME_FORBIDDEN_WORD 추가
├── nickname/                               # (신규 패키지) 닉네임 도메인 헬퍼
│   ├── NicknameGenerator.kt                # 큐레이션 단어 조합 생성 + 충돌 재추첨
│   ├── NicknameWords.kt                    # 안전 큐레이션 수식어·명사 상수
│   ├── NicknamePolicy.kt                   # 형식 검증(정규식 2~16자) + 정규화(trim)
│   └── ForbiddenWords.kt                   # 직접 입력 금칙어 사전 + 포함 검사
├── service/
│   ├── AuthService.kt                      # signupEmail 에서 nickname 자동 부여
│   ├── UserService.kt                      # (신규) 닉네임 변경 유스케이스
│   └── ...
├── auth/KakaoUserRegistrar.kt              # 카카오 가입 시 nickname 자동 부여
├── components/UserAuthConverter.kt         # toAuthMeResponse 에 nickname·createdAt 매핑
├── controller/UserController.kt            # (신규) PATCH /api/users/me/nickname
├── model/request/SetNicknameRequest.kt     # (신규) @Size(2..16) + NotBlank
└── model/response/AuthMeResponse.kt        # nickname·createdAt 필드 추가

backend/src/main/resources/db/migration/
└── V23__add_users_nickname.sql             # 컬럼 추가→백필→NOT NULL+UNIQUE

frontend/src/
├── app/(main)/
│   ├── mypage/page.tsx                      # (신규) 마이페이지
│   └── layout.tsx                           # 헤더에 마이페이지 진입점 추가
├── components/mypage/
│   ├── NicknameSection.tsx                  # (신규) 닉네임 표시·변경 폼(client)
│   └── AccountInfoSection.tsx               # (신규) 이메일·가입방식·가입일 읽기전용
├── lib/api/users.ts                         # (신규) setNickname()
└── types/api.ts                             # AuthMeResponse 에 nickname·createdAt 추가
```

**Structure Decision**: 기존 web application 구조(backend Kotlin/Spring + frontend Next.js) 유지. 닉네임 도메인 헬퍼는 `com.writenote.nickname` 신규 패키지로 응집(생성·정책·사전 분리). 프론트는 `(main)` 라우트 그룹에 `/mypage` 신설.

## 라운드 분해 (배포 단위)

> 통합 브랜치 전략: `036-user-nickname-mypage`(develop 분기). R1 GREEN → BE 배포 → R2 GREEN → FE 배포. **buffer 통합 후 develop merge**.

### R1 — Backend (BE 선행)

데이터·생성·검증·변경 endpoint·응답 확장. **양보 불가 핵심(US1 닉네임 존재 보장)이 R1 첫 산출**에서 실현된다.

1. **V23 마이그레이션** → verify: Testcontainers 부팅 + 기존 회원 백필 후 NOT NULL+UNIQUE 적용
2. **User.nickname 필드** + 엔티티 매핑 → verify: 저장·조회 통합 테스트
3. **NicknamePolicy(형식)·NicknameWords·NicknameGenerator(충돌 재추첨)·ForbiddenWords** → verify: 생성값이 형식·고유성 만족, 금칙어 사전 포함 검사, 큐레이션 단어에 문제어 부재(표본 단위 테스트)
4. **가입 2경로 자동 부여**(signupEmail·KakaoUserRegistrar) → verify: 신규 User 가 닉네임 보유
5. **PATCH /api/users/me/nickname**(UserController·UserService·SetNicknameRequest) → verify: 정상 변경 / 중복 409 / 형식 400 / 금칙어 400 / 비로그인 401
6. **AuthMeResponse 확장**(nickname·createdAt) + UserAuthConverter 매핑 → verify: me() 응답에 필드 포함
7. **AuthErrorCode +3** → verify: 에러 응답 envelope code 정확

**R1 게이트**: `./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build` GREEN. **로컬 dev DB 적용 금지(IT/Testcontainers 만)**.

### R2 — Frontend (FE 후행, R1 BE 배포 후)

1. **types/api.ts** AuthMeResponse 확장 → verify: typecheck
2. **lib/api/users.ts setNickname()** → verify: 단위(msw)
3. **/mypage page + NicknameSection + AccountInfoSection** → verify: RTL 행위 — 현재 닉네임 표시·변경 성공·중복/형식/금칙어 에러 인라인 표시
4. **헤더 진입점**(layout.tsx) → verify: build(RSC 경계) + 진입 동선
5. **변경 성공 시 `["auth","me"]` invalidate** → verify: 변경 후 표시 갱신

**R2 게이트**: `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build` GREEN. **client.ts 409 분기는 code 기준**이라 신규 NICKNAME_ALREADY_REGISTERED(409)는 일반 ApiError 흐름으로 폼에서 처리(code-quality §409 회귀 주의).

### dogfooding 게이트 (R2 후, 로컬 BE+DB+FE 3종 기동)

- 신규 가입 → 한글 닉네임 자동 부여 확인
- 마이페이지 진입 → 닉네임 변경(정상/중복/형식위반/금칙어) 4케이스
- 계정정보(이메일·가입방식·가입일) 표시 확인
- 기존 회원(백필값) 로그인 → `사용자<id>` 표시 + 변경 가능 확인

## Complexity Tracking

해당 없음(Constitution Check 위반 0).
