# 운영 툴 (Admin Ops Tool) v1 설계

- 작성일: 2026-06-21
- 상태: 설계 확정 (구현 plan 작성 대기)
- 맥락: 2026-06-21 오후 소설비(soseolbi.com) 웹 런칭 후 홍보 시작. 사용자 유입에 따라 공지·회원·통계 운영이 필요해짐. 솔로 운영자가 빠르게 수정·사용할 수 있는 경량 운영 툴.

## 결정 요약

| 항목 | 결정 |
|---|---|
| 형식 | 별도 Next.js 어드민 앱 (별도 Vercel 프로젝트, 스택 통일) |
| 운영자 | 나 혼자 — 단일 관리자, `role` 권한 체계 미도입 |
| 문의·신고 | 외부 채널로 시작 (인앱 폼/테이블 없음, "문의하기" 링크만) |
| 공지사항 | 홈 상단 배너(최신 1개) + `/notice` 목록·상세 + 어드민 CRUD |
| 회원 관리 | 조회 전용 (목록·검색·상세). 쓰기 액션 없음 |
| 통계 | 카운트 카드 + 최근 30일 가입 추이 그래프 |
| Vercel 플랜 | Hobby 유지. 런칭 후 사용자 추이 보고 Pro 전환 검토 (별도 트랙) |

### 형식 선택 근거 (A안)
- 네 기능 중 공지·문의는 어차피 백엔드+사용자앱 작업이 필수라 로우코드 도구로 절약되는 범위가 제한적.
- 이미 Next.js + Kotlin/Spring 에 숙련 → 새 도구 학습 비용 0, 기존 인증·CSRF·인프라 재사용.
- 사용자 앱과 코드·번들·배포가 완전히 분리되어 보안 경계가 깔끔하고, 운영 툴 배포가 사용자 앱에 영향 없음.
- 데이터(작가들의 글)가 민감해 외부 SaaS에 프로덕션 DB를 연결하는 부담을 피함.

## 아키텍처

```
soseolbi.com (본 앱, 기존 Vercel 프로젝트 write-note)
  ├─ 홈 상단 공지 배너 (최신 공개 공지 1개)
  ├─ /notice 공지 목록·상세
  └─ "문의하기" 외부 채널 링크
        │  GET /api/announcements (공개)
        ▼
api.soseolbi.com (백엔드, OCI Docker — 기존)
  ├─ GET /api/announcements, /api/announcements/{id}   (공개)
  └─ /api/admin/**                                      (관리자 전용)
        ▲
        │  관리자 JWT + same-origin 프록시
admin.soseolbi.com (어드민 앱, 신규 Vercel 프로젝트)
  ├─ 로그인
  ├─ 대시보드 (통계)
  ├─ 공지 관리 (CRUD)
  └─ 회원 조회 (목록·상세)
```

## 1. 데이터 모델

신규 테이블은 `Announcement` 1개뿐. Flyway 마이그레이션 1개 추가.

```
Announcement
  id            PK
  title         공지 제목
  body          공지 본문 (텍스트/마크다운)
  isPublished   공개 여부 (false면 본 앱 비노출)
  isPinned      배너 고정 여부 (홈 배너 노출 대상 선별)
  publishedAt   공개 시각 (정렬·표시용, nullable)
  createdAt     생성 시각
  updatedAt     수정 시각
```

- 회원·통계는 기존 `User` / `WorkSession` / `Project` / `Document` 재사용 → 신규 테이블 없음.
- 문의는 외부 채널 → 테이블 없음.

## 2. 백엔드 엔드포인트

### 공개 (비인증) — 본 앱이 호출
- `GET /api/announcements` — 공개된(`isPublished=true`) 공지 목록, 최신순
- `GET /api/announcements/{id}` — 공지 상세
- `SecurityConfig` 공개 경로에 위 2개 GET 등록

### 어드민 (`/api/admin/**`, 관리자 전용)
- 공지 CRUD: `GET / POST / PUT / DELETE /api/admin/announcements`
- 회원 조회: `GET /api/admin/users` (목록·검색·페이지네이션), `GET /api/admin/users/{id}` (상세)
  - 응답에 `passwordHash` 절대 미포함. 노출 필드 예: email, kakao 연동 여부, emailVerifiedAt, lastLoginAt, createdAt, (작품 수)
- 통계: `GET /api/admin/stats/summary` (총 가입자 / 신규 가입 오늘·이번주 / 활성 사용자(최근 N일 로그인) / 총 작품 수)
- 통계: `GET /api/admin/stats/signups?days=30` (일별 가입 수 시계열)

## 3. 인증 / 보안 (핵심)

- 단일 관리자. 백엔드 `SecurityConfig`에서 `/api/admin/**` 는 **인증 필수 + 환경변수 `ADMIN_EMAIL` 과 일치하는 사용자만** 통과.
- 기존 JWT 인증을 그대로 재사용 — 어드민 앱에서 관리자 계정으로 로그인 → 발급 JWT 로 `/api/admin/*` 호출.
- 어드민 프론트도 로그인 게이트 — 관리자가 아니면 진입 차단(클라이언트 가드 + 서버가 최종 권위).
- `GET /api/announcements` 는 비인증 공개.
- CSRF: 기존 정책(`X-WriteNote-Client` 헤더) 재사용 — 어드민 앱도 본 앱과 같은 공용 fetch 래퍼 패턴 사용.

## 4. 본 앱 (soseolbi.com) 추가 화면

- 홈 상단 **공지 배너**: 최신 공개 공지 1개(없으면 미표시). 클릭 시 `/notice` 또는 상세로 이동.
- **`/notice`**: 공지 목록 + 상세.
- 헤더/푸터에 **"문의하기"** 외부 채널 링크. (채널 = 이메일/카카오 채널/구글폼 중 별도 확정 — 미정 항목)

## 5. 어드민 앱 (별도 Vercel 프로젝트)

- 모노레포에 `admin-site/` 디렉토리. 새 Vercel 프로젝트, **Root Directory=`admin-site`, Production Branch=`main`** (`download-site` 와 동일 패턴).
- 스택: Next.js (App Router) + TypeScript — 기존과 동일. UI 는 **shadcn/ui** 로 테이블·폼 빠르게 구성.
- 백엔드 연결: 본 앱과 **같은 same-origin 프록시 패턴**(`/api/*` → `BACKEND_ORIGIN`=`https://api.soseolbi.com` rewrite) + CSRF 헤더 재사용.
- 화면 4개:
  1. 로그인 (관리자 계정)
  2. 대시보드 — 통계 카운트 카드 + 30일 가입 추이 그래프
  3. 공지 관리 — 목록 + 작성/수정 폼 (CRUD)
  4. 회원 조회 — 목록(검색) + 상세
- 서브도메인 `admin.soseolbi.com` (Cloudflare DNS → Vercel). 초기엔 Vercel `*.vercel.app` 주소로 시작 가능.

## 6. 배포 순서

- **BE 선행** (신규 엔티티 + 마이그레이션 + 공개·어드민 엔드포인트 + 어드민 가드) → **FE 후행** (본 앱 배너/notice + 어드민 앱).
- 근거: 백엔드가 새 계약(엔드포인트)을 먼저 받아들여야 프론트가 호출 가능.
- 어드민 Vercel 프로젝트는 최초 1회 설정 후 git push 자동배포.

## 7. 권장 구현 단계 (런칭 후 필요해질 때)

1. **1단계 (가장 급함)**: 공지 — 백엔드(엔티티+공개/어드민 엔드포인트) + 본 앱 배너/notice + 어드민 공지 CRUD. "문의하기" 외부 링크 동시 포함(작업 0).
2. **2단계**: 회원 조회 + 통계 대시보드.

## 비용 / 한도 메모

- 어드민 프로젝트 추가 자체는 비용·한도 부담 없음 (프로젝트 한도 Hobby 200개, 한도는 팀 전체 합산이며 어드민 트래픽은 운영자 본인뿐).
- 별개 리스크: 본 앱이 Hobby 플랜 — 상업적 사용 약관 + 월 한도(Fast Data Transfer 100GB / 함수 호출 100만 / 배포 100회·일)에 유입 증가 시 도달 가능. Hobby 는 초과분 자동 과금이 없어 막힘. 런칭 후 추이 보고 Pro 전환 검토 (별도 트랙).

## 미정 / 후속

- "문의하기" 외부 채널 종류 (이메일 vs 카카오 채널 vs 구글폼) — 구현 1단계 전 확정.
- 어드민 서브도메인 확정 (`admin.soseolbi.com` vs 임시 `*.vercel.app`).
- `role` 권한 체계 — 운영자 다인화 시점에 도입 (현재 미도입).
- 회원 문제 계정 조치(잠금·삭제) — v1 제외, 필요 시 DB 직접 또는 후속 라운드.

## 범위 밖 (v1 제외, YAGNI)

- 인앱 문의·신고 폼/테이블/받은편지함.
- 회원 쓰기 액션(잠금·삭제·이메일 발송).
- 상세 통계 대시보드(리텐션·WorkSession 집계 등).
- 다중 관리자 / 역할 구분.
- 공지 팝업 모달.
