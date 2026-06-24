# Quickstart / Dogfooding: 사용자 닉네임 + 마이페이지

R2(FE) 완료 후, 로컬 3종 기동(DB → 백엔드 → 프론트)으로 검증한다. 인증 화면이라 프론트 단독 불가(메모리 [[local-dogfooding-needs-backend]]).

## 기동

```bash
# 1) DB
docker compose up -d --wait postgres
# 2) 백엔드 (마이그레이션 V23 자동 적용)
cd backend && ./gradlew bootRun --args='--spring.profiles.active=local'
# 3) 프론트
cd frontend && pnpm dev   # http://localhost:3000
```

## 검증 시나리오

### S1. 신규 가입 자동 닉네임 (US1)
1. 이메일로 신규 가입
2. 마이페이지 진입 → 닉네임이 한글 단어 조합(예: `푸른고래4821`)으로 자동 부여되어 있음
3. (가능하면) 카카오 가입도 동일 확인

### S2. 닉네임 변경 4케이스 (US2)
마이페이지 닉네임 변경 폼에서:
1. **정상**: `나의필명` 입력 → 저장 → 표시 갱신
2. **중복**: 다른 계정이 쓰는 닉네임 입력 → "이미 사용 중" 인라인 에러
3. **형식 위반**: `a`(1자) 또는 `별★`(특수문자) → "2~16자 한글·영문·숫자·밑줄" 인라인 에러
4. **금칙어**: 금칙어 사전의 단어 입력 → "사용할 수 없는 단어" 인라인 에러

### S3. 계정정보 표시 (US3)
- 마이페이지에서 이메일·가입 방식(카카오/이메일)·가입일이 읽기전용으로 정확히 표시
- 가입 방식 표기는 `kakaoLinked` 기준 근사(이메일 가입 후 카카오 연결 시 "카카오"로 보일 수 있음 — v1 허용)

### S4. 기존 회원 백필 (US1)
- 기능 도입 전부터 있던 계정으로 로그인 → 닉네임이 `사용자<id>` 로 채워져 있음 → 마이페이지에서 변경 가능

## 자동 게이트
- BE: `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build`
- FE: `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build`

## 통과 기준
- 닉네임 미보유 계정 0건(신규·기존)
- 중복/형식/금칙어 변경 시도 100% 거부
- 자동 생성 닉네임 표본에 비속어·문제 단어 0건
