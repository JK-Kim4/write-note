# Quickstart / Dogfooding: 마이페이지 계정 셸 재구성

R1·R2 완료 후 로컬 3종 기동(DB→백엔드→프론트)으로 검증. 인증 화면이라 프론트 단독 불가.

## 기동

```bash
docker compose up -d --wait postgres
cd backend && ./gradlew bootRun --args='--spring.profiles.active=local'
cd frontend && pnpm dev   # http://localhost:3000
```

## 검증 시나리오

### S1. 사이드 메뉴 셸 (US1)
1. 로그인 → 헤더 "마이페이지" → `/mypage` 진입 시 프로필로 안내
2. 좌측 메뉴: 프로필·환경설정·계정 연결·문의·도움말·회원 탈퇴 — 회원 탈퇴 맨 아래 빨간 톤 분리
3. 각 메뉴 클릭 → URL `/mypage/{섹션}` 변경 + 활성 강조
4. 특정 섹션 URL 직접 입력·새로고침 → 그 섹션 열림(딥링크)

### S2. 프로필·문의·탈퇴 보존 (US1)
- 프로필: 닉네임 변경(036) + 계정정보 정상
- 문의: 사이드 메뉴 → `/contact` 이동
- 회원 탈퇴: 확인 문구 모달 그대로(우발 방지)

### S3. 환경설정 흡수 (US2)
- `/mypage/settings`: 테마·기본 용지·일일 목표 변경 동작 보존
- 브라우저에 `/settings` 직접 입력 → `/mypage/settings` 로 리다이렉트
- 헤더 nav 에 "설정" 중복 진입점 없음

### S4. 계정 연결 (US3)
- 이메일 가입 계정: 이메일=연결됨, 카카오=미연결 + "카카오 연결" 액션
- 카카오 가입 계정: 카카오=연결됨, 비밀번호=미설정 + "비밀번호 추가 등록" 폼
- **카카오 연결 시작(실측 핵심)**: "카카오 연결" → OAuth 진입 → 콜백 → 연결 성공 → `/mypage/connections`
- 비밀번호 추가: 폼 제출 → 성공 → 이후 연결됨 표시 (이미 설정 시 `PASSWORD_ALREADY_SET` 안내)
- 둘 다 연결된 계정: 추가 액션 없음

## 자동 게이트
- BE(R2): `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build`
- FE: `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build`

## 통과 기준
- 5개 섹션 딥링크·새로고침 100% 동작
- /settings → /mypage/settings 끊긴 링크 0
- 환경설정·탈퇴·닉네임 동작 회귀 0
- 계정 연결 상태 정확 + 미연결 수단만 액션
