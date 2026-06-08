# Implementation Plan: Desktop 앱 공개 배포 (Windows + macOS)

**Branch**: `013-desktop-distribution` | **Date**: 2026-06-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/013-desktop-distribution/spec.md` / 설계 SoT `docs/superpowers/specs/2026-06-08-desktop-distribution-design.md`

## Summary

Electron desktop 앱(`desktop/`)을 Windows + macOS로 공개 배포한다. **GitHub Actions 매트릭스**(macos-latest → universal dmg, windows-latest → 1-click per-user NSIS)가 `v*` 태그 push에 반응해 양 OS 설치파일을 빌드하고 **GitHub Releases**에 게시한다. 사용자는 **Vercel 프론트의 `/download` 페이지**에서 OS 자동 감지로 설치파일을 받고, 한국어 설치 안내문으로 무서명 보안 경고를 통과한다. 코드 서명·자동 업데이트는 범위 밖(향후 확장 구조 유지). 최대 리스크는 무서명 macOS 앱의 타 기기 실행 가능성 → 검증 게이트로 관리.

## Technical Context

**Language/Version**: TypeScript 5 / Node 24.14.0(`desktop/.nvmrc`) / React 19.2.4
**Primary Dependencies**: Electron 42, electron-builder 26.8.1, Vite 5, vite-plugin-electron 0.29, TipTap 3 (desktop) / Next.js 16 App Router (frontend `/download`)
**Storage**: `node:sqlite`(Node 내장, 앱 로컬 DB) — 배포에 영향 없음(asarUnpack/rebuild 불필요)
**Testing**: Vitest(desktop 단위) / 실제 설치 dogfooding(quickstart 검증 게이트)
**Target Platform**: Windows 10+ / macOS(Intel + Apple Silicon, Sequoia 15+ 포함)
**Project Type**: Electron desktop 앱 배포 + 프론트 정적 다운로드 페이지
**Performance Goals**: 비개발자 설치 완료 5분 이내(SC-001) / 태그 push → 자동 게시(SC-002)
**Constraints**: 무서명 시작(서명·자동 업데이트 범위 밖) / electron-builder 크로스빌드 불가 → CI OS별 네이티브 빌드 / 한국 소재(Azure Artifact Signing 불가)
**Scale/Scope**: 신규 워크플로 1개 + electron-builder.yml 확장 + 프론트 `/download` 페이지 1개. 신규 코드 소량.

## Constitution Check

`.specify/memory/constitution.md`는 미작성 템플릿 → 실제 거버넌스는 프로젝트 `CLAUDE.md` + `.claude/rules/`가 대체.

| 게이트 | 상태 |
|---|---|
| 추측 금지 / 단정 금지 (글로벌 CLAUDE.md) | ✅ 빌드·서명·배포 사실을 웹 출처 + 코드베이스로 검증(research). 무서명 macOS 타기기 실행은 단정 대신 **검증 게이트**로 분리. |
| Electron·패키징 환경 선확인 (룰 #8) | ✅ Node 24.14.0 핀 / node-linker=hoisted / onlyBuiltDependencies:[electron] / nvm PATH(CI corepack) / arm64 서명(ad-hoc identity:"-") 전부 plan 반영. |
| 화면 표시값 출처 명시 (룰 #9) | ✅ 다운로드 페이지 표시값 = 정적/감지값, 링크는 GitHub latest/download 외부 조회(data-model 명시). |
| 양보 불가 핵심 우선 (룰 #10) | ✅ 핵심 = "비개발자가 실제로 설치 성공". 첫 검증 게이트가 실제 설치(G2/G3)를 직접 친다(주변 인프라만 쌓고 미루지 않음). |
| TS 코드 퀄리티 — RSC 경계 (HARD-GATE) | ✅ `/download`의 navigator·클릭 핸들러 컴포넌트 `'use client'` 의무 명시 + 작성 직후 `pnpm build`. |
| 외부 인프라 안전 (DB 쓰기 컨펌) | ✅ 본 작업은 DB 쓰기 없음(배포 파이프라인). 해당 없음. |

위반 없음 → Phase 0/1 진입 가능.

## Project Structure

### Documentation (this feature)

```text
specs/013-desktop-distribution/
├── plan.md              # 본 파일
├── research.md          # 기술 결정·검증 (R1~R8)
├── data-model.md        # Release / Installer Asset / Download Page 엔티티
├── quickstart.md        # 릴리스 절차 + 검증 게이트(G1~G5)
├── contracts/
│   └── release-pipeline.md  # 워크플로/electron-builder/다운로드 링크 계약
└── tasks.md             # /speckit-tasks 산출 (본 명령 범위 밖)
```

### Source Code (repository root)

```text
.github/
└── workflows/
    └── release.yml              # (신규) v* 태그 → 매트릭스 빌드 → Releases

desktop/
├── electron-builder.yml         # (확장) win nsis + mac universal/ad-hoc + 고정 artifactName
├── package.json                 # (수정) version 관리 (릴리스 시 상향)
└── assets/icon.png              # (기존) 1024×1024 → .ico/.icns 자동 생성

frontend/
└── src/app/download/
    └── page.tsx                 # (신규) OS 감지 + 다운로드 버튼 2개 + 안내문 ('use client' 경계)
```

**Structure Decision**: 기존 모노레포 구조 유지. 배포 인프라는 repo 루트 `.github/workflows/`, 빌드 설정은 `desktop/`, 사용자 진입점은 `frontend/`(Vercel). 세 영역은 독립적이며 desktop은 프론트 빌드에 의존하지 않는다.

## Phase 0: research (완료)

→ `research.md` 참조. R1 GitHub Actions 매트릭스 / R2 universal / R3 ad-hoc 서명+검증게이트 / R4 NSIS 1-click per-user / R5 고정 artifactName + latest/download / R6 `/download` 페이지 / R7 자동업데이트 보류+확장구조 / R8 CI 환경 정합. NEEDS CLARIFICATION 0.

## Phase 1: design & contracts (완료)

→ `data-model.md`, `contracts/release-pipeline.md`, `quickstart.md` 참조.
- 엔티티: Release / Installer Asset / Download Page (DB 없음, 배포 산출물).
- 계약: (A) 워크플로 트리거·매트릭스·단계 (B) electron-builder.yml diff (C) 다운로드 링크 불변식.
- 검증: quickstart G1~G5 — 특히 G2(macOS 타기기 실행)가 최대 리스크 게이트.

## 구현 순서 개요 (tasks 상세는 /speckit-tasks)

1. **electron-builder.yml 확장** — win nsis + mac universal/ad-hoc + 고정 artifactName (로컬 1회 빌드로 산출물명·실행 확인)
2. **GitHub Actions release.yml** — 매트릭스 빌드 + Releases 업로드 (테스트 태그로 G1 검증)
3. **실제 설치 검증** — G2(macOS 타기기) / G3(Windows) / G4(기능 회귀) ⚠️ 핵심 게이트
4. **다운로드 페이지** — `/download` (OS 감지 + 버튼 + 안내문, `'use client'`, 작성 직후 `pnpm build`)
5. **릴리스 문서화** — quickstart 절차를 desktop README 또는 docs에 반영 (FR-010)

## 리스크 / 미해결

- **R3 검증 게이트(G2)**: 무서명/ad-hoc macOS 앱의 타 기기 실행은 단정 불가 — 실제 설치 검증 필수. 실패 시 macOS 서명+공증($99/년) fallback(별도 트랙, 이미 문서화).
- **무서명 마찰(확정)**: 양 OS 첫 실행 수동 단계. 안내문으로 보완하되 1-click은 서명 도입 시.
- **artifactName 공백**: `productName`에 공백(`Narae Note`) → 다운로드 URL 인코딩 이슈 회피 위해 산출물명은 하이픈(`Narae-Note*`)으로 고정, 링크와 정확히 일치(contracts C).
