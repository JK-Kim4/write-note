# Implementation Plan: 집필실 3단 (Studio 3-panel)

**Branch**: `feat/studio-three-panel` | **Date**: 2026-06-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/017-studio-three-panel/spec.md`

## Summary

집필실 `/projects/[id]/write`의 본문 영역을 3열 [아웃라인 ~240px | 원고 1fr | 우측 ~320px]로 재구성한다. 좌측은 본문 heading(level 1·2) **클라이언트 순수 파생** 목차(클릭 점프 + 현재 섹션 하이라이트), 우측은 인물 노트(기존 등장인물 API 재사용, 보기 + 빠른 추가) + 곁쪽지(기존 `MemoPanel` 불변)의 세로 스택이다. 좌·우 각각 접기 토글, 진입 기본은 아웃라인만 펼침.

기술 접근(research.md 확정):
- **에디터 노출** = 콜백(`onEditorReady`) — `PaperEditor`의 `useEditor` 소유 유지, 참조만 상위 공유(IME·자동저장·페이지분할 무변경).
- **점프** = 커서 이동 + 스크롤(선택 변경은 자동저장 비트리거, reduced-motion 시 즉시 이동).
- **인물 동기화** = invalidate(기존 `useMemos` 패턴 일관).
- **백엔드 변경 0.**

## Technical Context

**Language/Version**: TypeScript 5.9 + React 19.2 / Next.js 16(App Router)

**Primary Dependencies**: TipTap(`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/pm`) · React Query(`@tanstack/react-query`) · 기존 `apiFetch` 클라이언트

**Storage**: N/A(영속 변경 없음). 아웃라인은 비영속 파생, 인물·메모는 기존 백엔드

**Testing**: Vitest + React Testing Library(행위 중심), 순수함수 단위 테스트. HTTP 경계만 mock

**Target Platform**: 웹(Next.js, Vercel 호스팅). 데스크탑 톤(`desktop-app.css`) 집필실

**Project Type**: Web frontend(백엔드 무변경)

**Performance Goals**: 아웃라인 재파생 디바운스 — 본문 입력 체감 무손상. 한국어 IME 조합 안정

**Constraints**: 백엔드 변경 0 · AI/Ambience 영구 제외 · WCAG 2.1 AA · 한국어 1차 · 신규 패널 `'use client'` · 회귀 0(IME·자동저장·페이지분할·곁쪽지)

**Scale/Scope**: 신규 컴포넌트 ~4 + 신규 query 훅 1 + 순수함수 1, `PaperEditor`/page/CSS 최소 변경. 화면 1개(집필실)

## Constitution Check

*GATE: Phase 0 전 통과, Phase 1 후 재점검.*

`.specify/memory/constitution.md`는 채워지지 않은 템플릿(placeholder)이다. 따라서 프로젝트 de-facto 게이트는 `CLAUDE.md` + `.claude/rules/`를 적용한다:

| 게이트 | 상태 |
|---|---|
| 추측 금지(코드 사실 확인) | ✅ page/PaperEditor/characters API/CSS/타입 grep·Read 완료. 핸드오프 경로 오기(`electron-api/characters.ts`) 정정 |
| Surgical Changes | ✅ `useEditor` lift 기각(회귀 위험), 콜백 채택. `.studio`·`MemoPanel`·`PaperEditor` 내부 불변 |
| TDD(순수함수 먼저) | ✅ `outlineFromDoc` RED→GREEN 우선, 그다음 패널 RTL |
| RSC 경계(HARD-GATE) | ✅ 신규 패널 `'use client'` + 작성 직후 `pnpm build` 게이트 |
| 백엔드 변경 0 | ✅ 클라이언트 파생·기존 API 재사용 |
| 접근성 AA / 한국어 | ✅ 대비·aria·reduced-motion·한국어 heading 파생 명시 |
| 양보불가 핵심 우선(룰 §10) | ✅ US1(아웃라인) = P1 = 첫 dogfoodable 슬라이스 |

**위반 없음** — Complexity Tracking 불필요.

## Project Structure

### Documentation (this feature)

```text
specs/017-studio-three-panel/
├── plan.md              # 본 파일
├── spec.md              # /speckit-specify 산출
├── research.md          # Phase 0 — 미해결 3건 + 레이아웃/반응형/접근성 결정
├── data-model.md        # Phase 1 — OutlineItem/Character 매핑/UI 상태/쿼리 키
├── quickstart.md        # Phase 1 — 게이트·TDD 순서·시각 검증
├── contracts/
│   └── client-contracts.md   # 순수함수·훅·컴포넌트 prop 계약(외부 API 신규 없음)
├── checklists/
│   └── requirements.md  # spec 품질 체크리스트
└── tasks.md             # /speckit-tasks 산출(아직)
```

### Source Code (repository root)

```text
frontend/src/
├── app/projects/[id]/write/page.tsx        # 변경 — 3단 결선·토글 2개·에디터 참조 보유
├── components/
│   ├── editor/
│   │   ├── PaperEditor.tsx                  # 변경(최소) — onEditorReady prop + effect
│   │   ├── StudioOutline.tsx                # 신규 'use client' — 목차·점프·하이라이트
│   │   └── StudioOutline.test.tsx           # 신규 RTL
│   └── workspace/
│       ├── CharacterPanel.tsx               # 신규 'use client' — 인물 보기+빠른추가
│       ├── CharacterPanel.test.tsx          # 신규 RTL(HTTP mock)
│       ├── StudioRightStack.tsx             # 신규 — 우측 스택(인물+곁쪽지) 개별 접기
│       └── MemoPanel.tsx                    # 불변 — 우측 스택 하단 배치만
├── lib/
│   ├── editor/
│   │   ├── outline.ts                       # 신규 — OutlineItem + outlineFromDoc(순수)
│   │   └── outline.test.ts                  # 신규 — 단위 테스트(TDD 시작점)
│   ├── query/useCharacters.ts               # 신규 — useProjectCharacters/useCreateCharacter
│   └── api/characters.ts                    # 불변 — 기존 API 재사용
└── styles/desktop-app.css                   # 변경 — .screen-body 3열화 + 패널 클래스 + 반응형
```

**Structure Decision**: Web frontend 단일. 백엔드(`backend/`) 무변경. `.screen-body` 그리드 확장 + 신규 클라이언트 컴포넌트/순수함수 추가, 에디터·메모는 결선만.

## 미해결 3건 확정 (설계 §10 → plan)

| # | 결정 | 근거(research) |
|---|---|---|
| 에디터 인스턴스 노출 | **콜백 `onEditorReady`** | D1 — lift는 IME/자동저장/페이지분할 재배선 회귀 위험. 콜백은 prop 1개 추가 |
| 점프 시 커서 이동 | **커서 이동 + 스크롤**(사용자 확정) | D2 — 선택 변경은 자동저장 비트리거(검증). reduced-motion 즉시 이동 |
| 인물 빠른추가 동기화 | **invalidate**(코드 일관성) | D3 — 기존 `useMemos` 전부 invalidate. 저빈도라 낙관적 불필요 |

추가 확정(사용자 인터뷰): 진입 기본 = **아웃라인만 펼침**(`leftOpen=true`, `rightOpen=false`).

## Phase 2 진입(다음: /speckit-tasks)

tasks.md는 TDD 의존 순서로:
1. `outline.ts` 순수함수(RED→GREEN, 케이스별)
2. `useCharacters.ts` 쿼리/뮤테이션 훅
3. `StudioOutline` / `CharacterPanel` / `StudioRightStack`(RTL 행위)
4. `PaperEditor` `onEditorReady` + `.screen-body` 3열 CSS + 반응형
5. page 결선(토글 2개·에디터 참조·우측 스택·MemoPanel 이전)
6. 게이트(vitest/tsc/eslint/`pnpm build`) + 시각 검증 + 회귀 0 확인

## Complexity Tracking

위반 없음 — 비움.
