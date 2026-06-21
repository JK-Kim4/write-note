# Quickstart: 운영 툴 (Admin Ops Tool) v1

## 로컬 구동·검증

### 1. 인프라 + 백엔드
```bash
docker compose up -d --wait postgres
cd backend && ./gradlew bootRun --args='--spring.profiles.active=local'
```
- `application-local.yml` 에 `app.admin.email` 설정(로컬 관리자 계정 이메일). 미설정 시 `/api/admin/**` 는 누구도 통과 못 함(안전 기본값).

### 2. 사용자 앱 (본 앱)
```bash
cd frontend && pnpm dev   # http://localhost:3000
```

### 3. 어드민 앱 (신규)
```bash
cd admin-site && pnpm install && pnpm dev   # 예: http://localhost:3100
```
- `admin-site/next.config.ts` 의 `BACKEND_ORIGIN` 기본값 `http://localhost:8080`.

### 4. 스모크 체크
```bash
# 공개 공지(비인증)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/api/announcements          # 200
# 어드민 비인증 → 401
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/api/admin/announcements     # 401
```
- 관리자 로그인(어드민 앱) → 공지 작성·발행 → 본 앱 홈 배너/`/notice` 노출 확인.
- 비관리자 계정으로 어드민 앱 로그인 시 진입 차단 + `/api/admin/*` 403 확인.

## 검증 게이트

### 백엔드
```bash
cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build
```
- 통합 테스트(Testcontainers): 공개 GET 200 / 어드민 401·403·200 / 비밀값 미노출 / 공지 CRUD·발행토글 / 통계 집계값.

### 프론트(본 앱)
```bash
cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

### 어드민 앱
```bash
cd admin-site && pnpm lint && pnpm typecheck && pnpm build   # RSC 경계 검출은 build
```

## dogfooding 게이트 (자동 테스트로 못 잡는 것)
- 본 앱 홈 배너 실제 렌더(라이트/다크, 모바일), `/notice` 목록·상세 한국어 표시.
- 어드민 공지 작성→발행→본 앱 노출→비공개→사라짐 왕복.
- 통계 카운트가 실제 DB 와 일치, 30일 그래프 표시(빈 날 0).
- 비관리자 차단 실제 확인(§16 — 버그 있던 surface 에서 직접 관찰).

## 배포 (Phase A 최초 1회 + 이후 자동)
- **BE 선행**: `cd backend && ./gradlew bootJar` → `scp ... oci:be-build/backend.jar` → `ssh oci 'sudo bash ~/be-build/blue-green-deploy.sh'`. prod env `ADMIN_EMAIL` 설정 필수.
- **어드민 앱 Vercel 신규 프로젝트**: Root Directory=`admin-site`, Production Branch=`main`, env `BACKEND_ORIGIN`(+필요시) 설정. 이후 `main` push 자동배포.
- **본 앱**: 기존 write-note 프로젝트 — `main` push 자동배포.
- 주의: 어드민 앱은 `download-site`(정적)와 달리 **빌드 필요** — Vercel 빌드 설정 확인.
