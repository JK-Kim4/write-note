# Narae Note Desktop

작가용 작업공간 데스크탑 앱 (Electron + Vite + React 19 + TipTap, 로컬 `node:sqlite`).

## 개발

```bash
pnpm install         # node-linker=hoisted (.npmrc), electron postinstall 승인 (onlyBuiltDependencies)
pnpm dev             # vite + electron
pnpm build           # tsc --noEmit && vite build
pnpm test            # vitest
```

Node 버전은 `.nvmrc`(24.14.0) 고정. `node:sqlite`(Node 내장) 사용 → 네이티브 모듈 rebuild 불필요.

## 배포 (Windows + macOS 공개 배포)

설계·계획 SoT: [`specs/013-desktop-distribution/`](../specs/013-desktop-distribution/) (plan / contracts / quickstart).

**현재 무서명 배포** — 첫 실행 시 OS 보안 경고가 뜨며, 다운로드 페이지 안내문으로 우회한다. (서명·자동 업데이트는 향후 확장.)

### 릴리스 절차

```bash
# 1. 버전 상향: desktop/package.json "version" 수정 (예: 0.0.0 → 0.1.0)
# 2. 커밋 + 태그 + push
git commit -am "chore(desktop): release v0.1.0"
git tag v0.1.0
git push origin <branch>
git push origin v0.1.0
```

`v*` 태그 push → GitHub Actions(`.github/workflows/release.yml`)가:
- `macos-latest` → `Narae-Note.dmg` (universal, ad-hoc 서명)
- `windows-latest` → `Narae-Note-Setup.exe` (NSIS 1-click, per-user)
- 두 자산을 **draft** GitHub Release 에 자동 업로드

→ Actions 통과 후 **자산 2종을 확인하고 검증(아래 게이트)을 거친 뒤 draft Release 를 게시(Publish)** 하면 다운로드 페이지의 `releases/latest/download` 링크가 최신을 가리킨다.

### 릴리스 검증 게이트 (게시 전)

- **macOS** ⚠️: 빌드 기기가 아닌 다른 Mac(또는 quarantine 속성)에서 dmg 설치 → 시스템 설정 → 개인정보 보호 및 보안 → “확인 없이 열기” → 실행 확인. 무서명이라 실행 중 **키체인 암호 프롬프트**(Chromium Safe Storage)도 1회 뜸 → 로그인 암호 입력 후 “허용”(업데이트 시 재발 가능). 두 마찰 모두 코드서명+공증 도입 시 제거. (실패 시 macOS 서명 검토 — [[../obsidian]] ISSUE-025)
- **Windows**: exe 실행 → SmartScreen “추가 정보 → 실행” → 관리자 권한 없이 설치·실행 확인.
- **기능 회귀**: 집필실·메모·기록 + 로컬 `node:sqlite` DB 동작 확인.

상세 게이트: [`specs/013-desktop-distribution/quickstart.md`](../specs/013-desktop-distribution/quickstart.md).

### 향후 (서명 도입 시)

- macOS: Apple Developer($99/년) → `electron-builder.yml` `mac.identity`/`notarize` + 워크플로 secret → Gatekeeper 차단 제거 + 자동 업데이트 가능.
- Windows: OV 인증서(하드웨어 토큰) → SmartScreen 경고 완화(평판은 다운로드 누적).
