# Quickstart — Web 포팅 Front 이식 (015)

## 사전 준비 (backend 014 + DB)

```bash
docker compose up -d --wait postgres            # local DB
cd backend && ./gradlew bootRun --args='--spring.profiles.active=local'   # 014 API 서빙 (별도 터미널)
```
- frontend 는 `/api/*` 를 `next.config.ts` rewrites 로 `localhost:8080`(backend) 프록시. backend 가 떠 있어야 연동 동작.

## frontend 구동

```bash
cd frontend && pnpm install && pnpm dev          # localhost:3000
```

## ⚠️ 첫 단계 — 페이지 분할 + 한글 PoC (작업 규율 §10, 핵심 선증명)

광범위 화면 이식 **이전**, Next 브라우저에서 핵심 리스크부터 dogfooding:
1. desktop `Editor.tsx`+`pageLayout.ts`+`app.css` 의 `.prose/.paper/.sheet` 규칙을 frontend 로 이식, `'use client'` + `immediatelyRender:false`.
2. 임시 라우트(예: `/poc/write`)에 에디터만 띄움.
3. **브라우저 dogfooding**:
   - 한 페이지(26줄) 넘는 한글 본문 입력 → 페이지(원고지) 단위 분할 렌더 확인
   - 한글 IME 4케이스(빠른 타자 / 조합 중 bold 토글 / 한자 변환 / Backspace 분해) — `docs/poc/0-1-tiptap-korean.md` SoT
   - 라이트/다크 + (가능하면) iOS Safari·Android Chrome 한글 폰트 fallback
4. 통과해야 US1 본 이식 진입. 실패 시 column-wrap 대안을 별도 트랙 surfacing.

## 검증 cadence

| 영역 | 방법 |
|---|---|
| 데이터 계층(shim·훅)·컴포넌트 | `pnpm test`(Vitest+RTL+msw — 014 응답 mock) |
| 타입 | `pnpm typecheck` |
| 린트·RSC 경계 | `pnpm lint` + **`pnpm build`**(RSC server/client 경계 위반은 build 에서만 검출 — code-quality HARD-GATE) |
| 페이지 분할·한글 IME·폰트 | **브라우저 dogfooding**(수동, 한국어 영역 검증 cadence) |

## 도메인별 연동 dogfooding (US1→US4)

- **US1**: 로그인 → 작품 생성(작품 벽) → 집필실 진입(`/projects/[id]/write`) → 한글 본문 + 페이지 분할 → 자동저장 → 새로고침 보존 → 뒤로가기.
- **US2**: 곁쪽지 캡처 → 서랍 표시 → 고정(작품당 1개 전환) → 곁쪽지 책상 연결/필터.
- **US3**: 집필실 진입 시 세션 시작 → "작업 종료+기록" → 기록 화면 카드(최근 기록·누적 시간). 탭 닫기 시 `sendBeacon` 종료.
- **US4**: 문의 폼 전송(web 메타) → 카카오 링크 `window.open`.

## 완료 정의(DoD)

- US1~US4 화면이 014 연동으로 동작 + 데이터 서버 영속(타 기기 동일)
- 페이지 분할 + 한글 IME 4케이스 브라우저 dogfooding 통과(SC-002/003)
- 모든 주요 화면 딥링크 URL + 새로고침/뒤로가기(SC-005), 미로그인 리다이렉트(SC-006)
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` GREEN
- 006 폐기 화면 제거, contracts/web-electron-api.md ✅/♻️ 행 실제 결선 일치(계약 공백 0)
- vault `02-PROGRESS.md` 갱신(Phase 완료)
