# Phase 1 Data Model: 마이페이지 계정 셸 재구성

본 기능은 **새 영속 데이터를 만들지 않는다**(마이그레이션 0). 기존 User·user_settings 를 표시·관리한다.

## 응답 DTO 변경 — AuthMeResponse (additive)

```kotlin
data class AuthMeResponse(
    val userId: Long,
    val email: String,
    val nickname: String,
    val kakaoLinked: Boolean,
    val emailVerifiedAt: Instant?,
    val activeApiTokenCount: Int,
    val createdAt: Instant?,
    val passwordSet: Boolean,   // ← 추가 (계정 연결 UI 판단용)
)
```

`UserAuthConverter.toAuthMeResponse`: `passwordSet = user.passwordHash != null`. 해시값 자체는 노출하지 않는다(boolean 만).

프론트 `types/api.ts` 의 `AuthMeResponse` 에 `passwordSet: boolean` 동기.

## 연결 상태 파생 (프론트, 신규 데이터 없음)

| 로그인 수단 | 연결됨 판정 | 미연결 시 액션 |
|---|---|---|
| 이메일/비밀번호 | `passwordSet === true` | "비밀번호 추가 등록"(POST `/api/auth/link/email`) |
| 카카오 | `kakaoLinked === true` | "카카오 연결"(POST `/api/auth/link/kakao` → OAuth) |

- 둘 다 연결됨 → 추가 액션 없음(FR-009).
- 해제 액션 없음(FR-010, 백엔드 미지원).

## 라우트 구조 (URL 모델)

| URL | 섹션 | 내용 |
|---|---|---|
| `/mypage` | (리다이렉트) | → `/mypage/profile` |
| `/mypage/profile` | 프로필 | 닉네임 변경 + 계정정보(이메일·가입방식·가입일) |
| `/mypage/settings` | 환경설정 | 테마·기본 용지·일일 목표 |
| `/mypage/connections` | 계정 연결 | 연결 상태 + 미연결 수단 연결 |
| `/mypage/withdraw` | 회원 탈퇴 | 확인 문구 모달 |
| `/settings` | (리다이렉트) | → `/mypage/settings` (next.config) |

- 문의·도움말 = 사이드 메뉴에서 `/contact` 로 이동(섹션 페이지 아님).
- 알 수 없는 하위 세그먼트 → 기본(`/mypage/profile`)로 안전 처리(FR-015).

## 기존 자산 재사용 (변경 없음)

- `NicknameSection`·`AccountInfoSection`(036) — 프로필 섹션
- preferences 스토어(Zustand: theme·paperSize·dailyGoalMinutes) — 환경설정
- 회원 탈퇴 로직(`withdraw()`·확인 문구) — 위치만 이동
- `["auth","me"]`·`["settings"]` React Query — 재사용
