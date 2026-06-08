# PoC 0-1 — TipTap 한국어 IME 회귀 4 케이스 검증

**일자:** 2026-05-19
**상태:** ✅ 통과
**연관:** [01-phase-breakdown.md §2](../plan/01-phase-breakdown.md), [00-stack §5-2](../plan/00-stack-and-schedule.md), [DESIGN.md L183](../../DESIGN.md)

---

## 1. 검증 대상

- `01-phase §2 Phase 0-1`: TipTap 한국어 입력 회귀 4 케이스 검증
- `00-stack §5-2`: 4가지 회귀 케이스 (빠른 타자 / 조합 중 마크 적용 / 한자 변환 / Backspace 분해) 모두 정상
- `DESIGN.md L183` (미해결 #2): 에디터 한국어 IME — TipTap/Plate 의 한국어 입력 안정성. PoC 에서 먼저 검증
- **실패 시 결정** (`01-phase §2`): Lexical fallback 재검토

## 2. 환경

| 항목 | 값 |
|---|---|
| Frontend | Next.js 16.2.6 (Turbopack dev) on Node v20.10 |
| React | 19.2.4 |
| TipTap | `@tiptap/react@3.23.5` + `@tiptap/starter-kit@3.23.5` + `@tiptap/pm@3.23.5` |
| 검증 페이지 | `frontend/src/app/poc/tiptap/page.tsx` — `"use client"` + `useEditor({ extensions: [StarterKit], immediatelyRender: false })` |
| 검증 환경 | macOS, 시스템 한글 IME |
| dev server 컴파일 | 288ms (Turbopack) |

## 3. 통과 결과

사용자 수동 검증 — 4 케이스 모두 ✅ 통과 보고.

| 케이스 | 검증 방법 | 결과 |
|---|---|---|
| 1. 빠른 타자 | "안녕하세요" 연속 빠른 입력 — 글자 누락 / 자모 분리 / 순서 어긋남 확인 | ✅ |
| 2. 조합 중 mark 적용 | "ㅎㅏ" 조합 도중 `⌘+B` / `⌘+I` — 글자 깨짐 / mark 위치 확인 | ✅ |
| 3. 한자 변환 | "한국" → `Option+Enter` (macOS) — 변환 메뉴 노출 / 정상 삽입 / 원본 유지 | ✅ |
| 4. Backspace 분해 | "한" 입력 후 `Backspace` — 자모 vs 글자 단위 일관성 | ✅ |

## 4. 산출물

| 파일 | 역할 |
|---|---|
| `frontend/src/app/poc/tiptap/page.tsx` | TipTap 에디터 + 4 케이스 가이드 UI |
| `frontend/package.json` | `@tiptap/react` / `@tiptap/starter-kit` / `@tiptap/pm` 의존성 추가 |
| `frontend/pnpm-lock.yaml` | lock 갱신 |

## 5. 의외 결정 / 함정

본 PoC 에서 의외 결정 없음. 함정 없음. TipTap 3.23.5 + Next.js 16 App Router 의 default 동작이 한국어 IME 4 케이스 모두 통과.

특기 사항:
- `immediatelyRender: false` 명시 — Next.js SSR + TipTap hydration mismatch 회피를 위한 공식 권장 옵션. PoC 단순 페이지에서도 박음. Phase 3 본격 에디터 구현 시도 유지
- `default export` 사용 — Next.js page 의 표준. 글로벌 TypeScript 룰 §Import/Export 의 "default export 금지" 예외 (Next.js page/layout 명시 예외)
- 인라인 스타일 사용 — PoC 페이지 한정 minimal. Phase 3 본격 화면은 DESIGN.md 디자인 시스템 + Tailwind 4 토큰 기반

## 6. 폐기 시점

본 PoC 산출물 1개 (`frontend/src/app/poc/tiptap/page.tsx`) 는 **Phase 3 (Week 3) 진입 시 폐기**:

- `01-phase §3 Week 3` 의 3-2 (TipTap 기본 셋업 + 한국어 IME 통과 extensions만 bold/italic/heading/list/blockquote) 가 본격 에디터 구현
- PoC 페이지 → 본격 에디터 화면 (`src/app/editor/` 또는 `src/app/projects/[id]/editor/` 등 — Phase 2 Project CRUD 진입 후 라우팅 결정)으로 swap

`@tiptap/*` 의존성 3개는 유지 — 본격 에디터에서 그대로 사용.

## 7. 다음 단계

- Phase 0-3 (PWA manifest + service worker) — `01-phase §2` 의 마지막 PoC. 0-1 산출물 (frontend/) 위에 진행
- Phase 0 PoC 3종 완료 후 Phase 1A (Spring Boot 스캐폴드 본격) 진입
