# 소설비 (Soseolbi)

> 컨텍스트가 안 죽는 작가용 작업공간

**[soseolbi.com](https://soseolbi.com)**

소설비는 취미로 소설·단막극·시를 쓰는 사람들을 위한 글쓰기 작업공간입니다. 일상의 영감과 글쓰기 세션 사이에서 잃어버리기 쉬운 *맥락*을 살려주는 것이 목표입니다. 메모와 글쓰기 에디터가 *같은 시스템*에 살면서, 세션이 끊겨도 작업 맥락이 영속하게 만듭니다.

## 주요 기능

- **작품·챕터 관리** — 작품 단위로 메타데이터(장르·로그라인·등장인물)를 모으고, 본문을 여러 챕터로 나눠 집필
- **집필실 에디터** — 실제 종이처럼 페이지가 나뉘는 자체 에디터 엔진. 출판 방식(종이/웹)과 판형(신국판·국판·46판·문고판 등)을 선택해 실측에 가까운 분량을 가늠하며 집필
- **등장인물·곁쪽지** — 집필 화면 옆에서 인물 설정과 메모를 바로 참조. 글의 흐름을 끊지 않고 맥락 유지
- **집필 리듬·분량 지표** — 글자 수, 일일 목표 진행률, 주간 집필 리듬을 한눈에 확인
- **내보내기** — 완성한 원고를 PDF·DOCX로 출력
- **모바일 지원** — 웹 브라우저와 모바일에서 어디서든 집필

## 기술 스택

| 레이어 | 기술 |
|---|---|
| 프론트엔드 | Next.js (App Router) + TypeScript + React |
| 에디터 | 자체 페이지 분할 에디터 엔진 |
| 상태 관리 | React Query + Zustand |
| 백엔드 | Kotlin + Spring Boot (Web · Security · Data JPA) |
| 데이터베이스 | PostgreSQL |
| 인증 | Spring Security + JWT + Kakao OAuth2 |
| 호스팅 | Vercel (프론트) · OCI Compute (백엔드) |

## 로컬 실행

### 사전 요구사항

- Node.js 20+ / pnpm 8+
- Java 24 (Gradle toolchain 자동 처리)
- Docker (PostgreSQL 컨테이너)

### 실행

```bash
# 1. PostgreSQL 컨테이너 기동
docker compose up -d --wait postgres

# 2. 백엔드 (새 터미널)
cd backend
./gradlew bootRun --args='--spring.profiles.active=local'   # http://localhost:8080

# 3. 프론트엔드 (새 터미널)
cd frontend
pnpm install
pnpm dev                                                    # http://localhost:3000
```

## 라이선스

개인 사이드 프로젝트입니다.
