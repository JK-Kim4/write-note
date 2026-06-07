# Implementation Plan: 관리자 문의·의견 보내기 (Desktop)

**Branch**: `011-desktop-contact-feedback` | **Date**: 2026-06-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/011-desktop-contact-feedback/spec.md` · 설계 문서 `docs/superpowers/specs/2026-06-08-desktop-contact-feedback-design.ko.md`

## Summary

Desktop(Electron) 로컬 앱에 **문의·의견 보내기**를 추가한다. 좌측 Rail 최하단의 상시 진입점 → 전용 5번째 화면(`contact`)에서 (1) 메일 폼으로 의견을 외부 폼-투-이메일 서비스(**Formsubmit**)에 전송하고, (2) 카카오 오픈채팅 버튼으로 기본 브라우저를 연다. 로컬 앱엔 서버가 없으므로 전송은 main 프로세스가 Formsubmit `https://formsubmit.co/ajax/<hash>`로 POST한다(renderer 직접 fetch 금지, 기존 IPC 경계 준수 — **main 호출 가능 실측 확정, research R1**). 본문엔 앱 버전·OS·전송 시각을 자동 첨부한다. 전송 로직은 `Store`(로컬 SQLite use-case) 밖 신규 모듈 `contactSender.ts`로 격리해 추후 백엔드로 swap할 수 있게 한다.

> **전송 서비스 정정(2026-06-08 실측)**: 당초 설계는 Web3Forms 였으나 **Web3Forms 는 main(서버사이드) 호출을 무료 플랜에서 차단**(curl 403 실측)함이 확인되어 **Formsubmit**(Referer 헤더로 main 호출 허용)으로 교체. IPC 경계(main 경유) 구조는 유지. 상세 research R1/R2.

## Technical Context

**Language/Version**: TypeScript 5 · React 19.2 (renderer) / Node (Electron 42 main, global `fetch` 가용)

**Primary Dependencies**: Electron 42, Vite 5 + vite-plugin-electron, TipTap(무관), Vitest 3 + @testing-library/react. **신규 런타임 의존성 0** — Formsubmit은 순수 HTTP POST(global fetch), SDK·API 키 불필요.

**Storage**: 해당 없음 — 문의는 로컬 DB에 영속 저장하지 않고 외부 서비스로 전달만(히스토리 범위 밖). 기존 node:sqlite/`Store`는 미변경.

**Testing**: Vitest 2 projects — `renderer`(jsdom, `src/**/*.test.tsx`, `vi.stubGlobal("electronAPI", …)`) + `main`(node, `electron/**/*.test.ts`, `fetch` mock).

**Target Platform**: Electron desktop (macOS arm64 우선 패키징).

**Project Type**: desktop-app (Electron main + React renderer, IPC 경계 분리).

**Performance Goals**: 사용자 체감 즉시(전송 중 로딩 표시). 정량 목표는 spec SC 기준(빈 의견 0건, 실패 시 내용 손실 0건).

**Constraints**: renderer는 외부 직접 호출 금지 — 모든 외부 호출은 main IPC 경유(기존 구조). Formsubmit 은 main 호출 시 `Referer` 헤더 필수(실측). 한국어 우선 UI(프로젝트 전제). 외부 API(Formsubmit)는 `external-infra-safety.md` 범위 밖(DB/redis 한정 룰)이므로 쓰기 컨펌 게이트 비적용.

**Scale/Scope**: 화면 1개 신설, IPC 채널 2개 추가(`contact:send`, `shell:openExternal`), 신규 모듈 1개(`contactSender.ts`), 화면 컴포넌트 1개(`ContactScreen.tsx`), Rail 진입점 1개. 초기 소수 사용자 피드백 수집.

> **전송 모듈 사전검증(2026-06-08)**: Formsubmit ajax 엔드포인트로 main(서버사이드) 호출이 `Referer` 헤더와 함께 `{"success":"true"}`(HTTP 200) 반환함을 curl 로 실측. `success` 는 **문자열** — 핸들러 분기 `=== "true"` 의무.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

프로젝트 `.specify/memory/constitution.md`는 미작성 템플릿이다. 따라서 **프로젝트 `CLAUDE.md` HARD-GATE 룰**을 사실상의 헌법으로 적용한다.

| 게이트(룰) | 적용/준수 |
|---|---|
| TDD Red-Green-Refactor (`CLAUDE.md` §5) | 준수 — `contactSender` 매핑/전송 분기·ContactScreen 행위를 실패 테스트 우선. tasks 단계에서 테스트→구현 순서 강제. |
| Mock 경계 = 시스템 경계만 (§5-2) | 준수 — `fetch`(외부 API)만 mock. 내부 collaborator mock 금지. |
| 외부 인프라 안전 (`external-infra-safety.md`) | 범위 밖 — 본 룰은 DB(PostgreSQL)·redis 한정. Formsubmit은 외부 API → 미적용. **API 키 없음(무가입). 엔드포인트 해시만 main 상수로 관리, `.env` 불필요.** |
| TS 코드 퀄리티 (`typescript/code-quality.md`) | 준수 — `any` 금지, named export, type-only import, 이벤트 핸들러 컴포넌트는… (아래 주: 본 앱은 **Next.js App Router 아님** → `'use client'` 불요. RSC 경계 룰 비적용). |
| 한국어 우선 검증 | 준수 — 안내·라벨 한국어. 단 본 기능은 폼 입력이라 TipTap IME 회귀 영역 아님(에디터 미변경). |
| 추측 금지 (§금지1) | 준수 — 전송 가능 서비스를 **curl 실측**으로 확정(Web3Forms 차단 → Formsubmit, research R1/R2). 잔여 추측(회신 주소 매핑)은 구현 시 1회 확인으로 명시. |

**위반 없음** → Phase 0 진입 허용. Complexity Tracking 불요.

> **RSC 경계 주의**: `typescript/code-quality.md`의 `'use client'` HARD-GATE는 **Next.js App Router**(`frontend/`) 전용이다. 본 작업은 `desktop/`(Vite + React SPA)이므로 `'use client'` 지시어가 존재하지 않으며 적용 대상이 아니다. 대신 검증 게이트는 `pnpm typecheck`(`tsc --noEmit`) + `pnpm test`(Vitest)다.

## Project Structure

### Documentation (this feature)

```text
specs/011-desktop-contact-feedback/
├── plan.md              # This file
├── research.md          # Phase 0 — 전송 서비스 실측(Web3Forms 차단→Formsubmit) + UI/경계 결정
├── data-model.md        # Phase 1 — 문의 메시지(transient) + Formsubmit payload
├── quickstart.md        # Phase 1 — 사용자 준비물 + 수동 검증 흐름
├── contracts/
│   └── ipc-and-formsubmit.md   # IPC 계약 추가분 + Formsubmit 요청/응답 계약
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

기존 desktop 구조를 확장한다(신규 디렉토리 없음).

```text
desktop/
├── electron/
│   ├── contactSender.ts          # 신설 — Formsubmit payload 매핑(순수) + 전송(fetch+Referer). Store 밖 격리.
│   ├── contactSender.test.ts     # 신설 — 매핑/전송 성공·실패 (fetch mock, node project)
│   ├── ipc/
│   │   ├── contract.ts           # 수정 — ElectronAPI 에 contact.send + shell.openExternal, CHANNELS 2개 추가
│   │   └── registerHandlers.ts   # 수정 — contact:send / shell:openExternal 핸들러 등록(메타 결선)
│   └── preload.ts                # 수정 — electronAPI.contact / electronAPI.shell 화이트리스트 노출
└── src/
    ├── types.ts                  # 수정 — Screen 에 "contact" 추가
    ├── App.tsx                   # 수정 — initialParam allowed 배열 + screen==="contact" 렌더 분기
    ├── components/
    │   └── Rail.tsx              # 수정 — 최하단 문의 진입점(동급 화면 전환)
    └── screens/
        ├── ContactScreen.tsx     # 신설 — 메일 폼 + 카카오 버튼 + 인라인 상태
        └── ContactScreen.test.tsx# 신설 — 빈 본문 비활성/전송 성공·실패/카카오 (renderer project)
```

**Structure Decision**: 기존 desktop-app 레이아웃을 그대로 확장. IPC 3계층(contract→preload→registerHandlers)에 채널 2개를 더하고, 외부 HTTP 전송은 `Store`(로컬 DB use-case)에 넣지 않고 `contactSender.ts`로 분리해 책임 경계를 유지한다. 화면은 기존 `src/screens/*Screen.tsx` 패턴을 따른다.

## Complexity Tracking

> Constitution Check 위반 없음 — 비움.
