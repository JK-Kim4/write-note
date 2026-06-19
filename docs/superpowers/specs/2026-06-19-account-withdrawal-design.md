# 회원 탈퇴 (Account Withdrawal) — 설계

- 일자: 2026-06-19
- 브랜치: 028-beta-prep-reconcile (develop 통합)
- 상태: 설계 승인 → plan 대기

## 1. 목적 / 배경

베타 출시 정리 중, 설정 화면에 **회원 탈퇴 메뉴가 없음**을 확인(FE·BE 모두 미구현). 한국 베타 서비스로서 사용자가 직접 계정과 데이터를 파기할 수 있어야 한다(개인정보보호법 — 탈퇴 시 지체없이 파기 원칙).

## 2. 확정 결정

| 항목 | 결정 | 근거 |
|---|---|---|
| 삭제 전략 | **즉시 완전 삭제(hard delete cascade)** | 단순·확실, 개인정보 즉시 파기로 법 부합. 결제 기능 없는 베타라 법정 보존 의무 없음 |
| 본인 확인 | **확인 문구 타이핑** (`"탈퇴합니다"`) | 이메일/카카오 가입 경로 무관 통일·단순. 실수 방지에 효과적 |
| cascade 방식 | **A: 마이그레이션으로 FK 통일 + User row 삭제 한 방** | 원자적, 다른 FK와 일관. 엔티티 추가 시 누락 위험 없음 |
| 카카오 unlink | **생략**(DB User만 삭제) | 베타 범위 축소. 카카오측 앱 연결은 사용자가 카카오 설정에서 관리 |

## 3. 영향 범위 — User 삭제 시 cascade 대상

User(`users`)를 FK로 참조하는 엔티티 (탐색 결과):

| 엔티티 | 테이블 | 현재 FK `ON DELETE` |
|---|---|---|
| Project | projects | **없음 → V15에서 CASCADE로 교체 필요** |
| └ Document(챕터) | documents | CASCADE (projects 경유, V5) |
| └ Character(인물) | characters | CASCADE (projects 경유, V5) |
| Memo(곁쪽지) | memos | CASCADE (V6) |
| ApiToken(캡처 토큰) | api_tokens | CASCADE (V6) |
| AuthToken(인증토큰) | auth_tokens | CASCADE (V4) |
| UserSetting(설정) | user_settings | CASCADE (V10) |
| WorkSession(작업세션) | work_sessions | CASCADE (V13) |
| ProjectLog(작품로그) | project_logs | CASCADE (V13) |

→ **projects FK만 cascade로 바꾸면** User 삭제 시 projects가 cascade 삭제되고, 그 아래 documents·characters도 연쇄 cascade. 나머지는 이미 cascade. 전체가 DB 레벨에서 원자적 삭제된다.

## 4. Backend 설계

### 4-1. 마이그레이션 V15 (다음 번호; 최신 = V14)

`projects → users` FK를 `ON DELETE CASCADE`로 교체.

```sql
-- V15__projects_user_fk_cascade.sql
ALTER TABLE projects DROP CONSTRAINT fk_projects_user;
ALTER TABLE projects ADD CONSTRAINT fk_projects_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
```

> 적용은 외부 인프라 안전 룰에 따라 사용자 컨펌(로컬 dev/프로덕션 모두). 작성·리뷰는 본 설계 범위.

### 4-2. Endpoint — `DELETE /api/auth/me`

AuthController(`/api/auth`)에 추가, 기존 `GET /me` 옆.

- 요청 body: `{ "confirmation": "탈퇴합니다" }`
- 인증: 쿠키(현재 로그인 사용자) — 기존 인증 흐름 재사용
- 검증: `confirmation`이 상수 문구와 불일치 → **400** `WITHDRAWAL_CONFIRMATION_MISMATCH`
- 성공: `UserService.withdraw(userId)` → User 삭제(cascade) → 쿠키(access/refresh) 무효화 → **logout 과 동일 패턴**(만료 쿠키 set + 200 성공 응답). 정확한 status/응답 envelope 는 기존 `POST /logout` 구현을 plan 에서 grep 해 정합)

### 4-3. Service — `UserService.withdraw(userId)`

- `@Transactional(rollbackFor = [Exception::class])`
- `userRepository.deleteById(userId)` (cascade)
- 외부 API 호출 없음(카카오 unlink 생략)

### 4-4. 에러 코드

`WITHDRAWAL_CONFIRMATION_MISMATCH` (400) — 확인 문구 불일치. `docs/plan/03-backend-requirements.md` 에러 매트릭스에 추가.

## 5. Frontend 설계

### 5-1. 설정 "계정" 섹션 하단

기존 계정 섹션(이메일·카카오 연결 표시) 하단에 **"회원 탈퇴" 버튼**(위험 톤 — 빨강 계열).

### 5-2. 확인 모달

- 경고문: "탈퇴하면 모든 작품·메모·설정이 영구 삭제되며 되돌릴 수 없습니다."
- 입력란: `"탈퇴합니다"` 정확히 입력해야 삭제 버튼 활성(그 전엔 disabled)
- 삭제 버튼 클릭 → `DELETE /api/auth/me { confirmation }`

### 5-3. 탈퇴 후 흐름

성공 → 서버가 쿠키 만료 → FE에서 React Query 캐시 클리어(`queryClient.clear()`) → `/welcome`(랜딩) 이동.

- 400(문구 불일치)은 모달에서 입력 가드로 사전 차단되지만, 방어적으로 에러 표시.

## 6. 테스트 전략

### Backend (TDD)
- `UserService.withdraw` — 탈퇴 후 User 및 연관 데이터(project/memo/token/setting)가 모두 삭제됨을 통합 테스트(Testcontainers, cascade 실제 검증)
- `AuthController DELETE /me` — 확인 문구 일치 시 삭제+쿠키만료 / 불일치 시 400 / 미인증 시 401

### Frontend
- 탈퇴 모달 — 문구 미입력 시 버튼 disabled, 정확 입력 시 활성(RTL 행위 검증)
- 탈퇴 성공 시 `/welcome` 이동 + 캐시 클리어(msw mock)

## 7. 비범위 (이번에 안 함)

- 카카오 OAuth unlink API 호출
- soft-delete / 유예기간 / 익명화
- 탈퇴 사유 수집, 재가입 제한
- 탈퇴 데이터 export(백업 다운로드)

## 8. 배포 순서

BE(마이그레이션 V15 + endpoint) 선행 가능, FE(탈퇴 UI) 후행 — FE가 없는 endpoint를 호출하지 않으므로 BE 먼저 배포해도 무회귀. 단 마이그레이션 적용은 사용자 컨펌(OCI).
