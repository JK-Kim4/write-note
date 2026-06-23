# Quickstart: 온보딩 가이드 고도화 — 검증·dogfooding

## 1. 검증 명령 (FE)

```bash
cd frontend
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```
- `pnpm test`: OnboardingTour 단계 전이·분기 라우팅·완료 저장 호출·핸드오프 set/read 행위(driver.js·router·설정 client mock).
- `pnpm build`: RSC 경계(`'use client'`) 검출 — OnboardingTour·LibraryOnboardingTour client 의무.

## 2. dogfooding (배포 전 필수 — 사용자 명시)

인증 화면이라 자동 테스트만으로 단정 불가(§19). 로컬 풀스택으로 신규 사용자 흐름을 직접 확인.

### 준비 — 온보딩 리셋(본인 계정 다시 신규처럼)

로컬 DB 에서 완료 플래그 삭제(쓰기 — 본인 로컬 dev DB):
```bash
docker exec write-note-postgres psql -U writenote -d writenote -c "DELETE FROM user_settings WHERE setting_key='onboardingCompleted' AND user_id=(SELECT id FROM users WHERE email='jongbell4@gmail.com');"
```
서버 기동: 백엔드 `bootRun`(local) + 프론트 `pnpm dev`(:3000) → 로그인 → 홈 진입.

### 체크 케이스

| # | 흐름 | 기대 |
|---|---|---|
| 1 | 홈 진입 | 가이드 자동 시작 — 인트로 카드 3장(시리즈 생성→작품 포함→단위 내보내기) 중앙 표시, 순차 |
| 2 | 계속 | 작품 → 메모 → 인물 메뉴가 순서대로 강조 + 설명 |
| 3 | 인물 단계 | "더 보기" / "바로 시작" 2지선다 표시 |
| 4 | "바로 시작" | 즉시 종료, 곧장 서비스 |
| 5 | (리셋 후) "더 보기" | /library 이동 → 시리즈 버튼 → 작품 버튼 순서로 강조·설명(빈 강조/깜빡임 없음) |
| 6 | 완료/건너뛰기/ESC/배경 | 어느 경로든 종료 + 완료 저장 |
| 7 | 재진입(홈) | 가이드 자동으로 안 뜸 |
| 8 | "더 보기" 라이브러리 가이드 중 이탈 → 재진입 | 긴 인트로 다시 안 뜸(이탈 내성) |
| 9 | 문구 | 모두 한국어, "시리즈" 용어 일관 |

- "더 보기" 케이스를 다시 보려면 케이스마다 위 리셋 재실행.

## 3. 배포 (FE 단독)

- dogfooding 통과 후: `develop` 병합 → (사용자 승인 시) `main` push → Vercel production 자동배포(soseolbi.com). 백엔드·env·마이그레이션 0.
- §19: prod authed 온보딩은 로그인 제약으로 배포 후 자동 검증 제한 → 로컬 dogfooding 이 1차 게이트.
