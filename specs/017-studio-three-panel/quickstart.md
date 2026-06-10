# Quickstart — 집필실 3단 (Studio 3-panel)

## 환경 (핸드오프 §5)

- Node 24.14.0 + pnpm 8.15.5(corepack). 작업 디렉터리 `frontend/`.
- dev: `pnpm dev`(port 3000, 이미 떠 있을 수 있음 → 충돌 시 3001). 백엔드 `:8080` 가동(401=정상, 인증 필요).

## 게이트 (포어그라운드 실행 의무 — CLAUDE.md)

`frontend/`에서 — pnpm lockfile 충돌 회피 위해 `node_modules/.bin` 직접 실행 권장:

```bash
node_modules/.bin/vitest run                 # 단위/RTL (현재 83 pass 기준 회귀 0)
node_modules/.bin/tsc --noEmit               # 타입 (기존 documents.test.ts version 에러 1건은 무관 — 무시)
node_modules/.bin/eslint src                 # lint
pnpm build                                   # RSC 경계 — 신규 'use client' 패널 검출(필수)
```

- **빌드/테스트는 포어그라운드**(`run_in_background=false`). 결과(GREEN/RED) 직접 확인 후 다음 단계.
- 신규 패널 작성 **직후 `pnpm build`** — `Event handlers cannot be passed to Client Component props` 회귀 검출(lint만으론 안 잡힘).

## TDD 순서 (설계 §9 / tasks 진입점)

1. **순수함수 먼저**: `outline.test.ts`(RED) → `outline.ts` `outlineFromDoc`(GREEN). 한 번에 한 케이스.
2. **패널 컴포넌트**: `StudioOutline`·`CharacterPanel` RTL(행위: 렌더·클릭 점프 호출·빈 상태·빠른 추가). HTTP만 mock.
3. **그리드 CSS**: `.screen-body` 3열화 + 반응형.
4. **결선**: page에 토글 2개·에디터 참조·우측 스택.
5. **게이트**: 위 4종 + 시각 검증.

## 시각 검증 (인증 게이트 우회)

집필실은 인증 게이트라 헤드리스로 직접 못 봄. 핸드오프 §5 방식:
- 실제 `desktop-app.css`를 `<link>`한 **정적 하니스 HTML**(3단 마크업 더미)을 만들어 headless Chrome으로 스크린샷.
- 라이트 강제: `--blink-settings=preferredColorScheme=1`. 라이트/다크·패널 4조합(둘 다/좌만/우만/몰입)·좁은 폭 반응형 확인.

## 회귀 0 체크(SC-005)

- 본문 작성·한국어 IME 조합(PoC 0-1 4케이스)·자동저장·페이지 분할·곁쪽지(연결 메모 고정/해제)가 3단 도입 후에도 동일 동작.
- `MemoPanel` 컴포넌트·`PaperEditor` 내부 로직 무변경 확인.

## 주의 (HARD-GATE)

- **백엔드 변경 금지** — 아웃라인=클라이언트 파생, 인물=기존 API, 곁쪽지=기존.
- **AI·Ambience 추가 금지**.
- `PaperEditor`의 `e.view.composing` IME 가드 **건드리지 말 것**.
- `documents.test.ts` typecheck 에러(016 부채)는 본 작업과 무관 — 고치지 말 것.
