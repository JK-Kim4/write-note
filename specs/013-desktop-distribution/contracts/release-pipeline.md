# Contract: 릴리스 파이프라인 인터페이스 (013)

본 기능의 "외부 인터페이스"는 (A) 릴리스 트리거 계약, (B) electron-builder 산출물 계약, (C) 다운로드 링크 계약이다. 구현은 본 계약을 만족해야 한다.

## A. 릴리스 트리거 계약 — GitHub Actions 워크플로

`.github/workflows/release.yml`

```yaml
# 입력(트리거)
on:
  push:
    tags: ['v*']

# 권한
permissions:
  contents: write   # Release 생성·자산 업로드

# 매트릭스
jobs:
  build:
    strategy:
      fail-fast: false        # 한 OS 실패가 다른 OS 빌드를 죽이지 않음
      matrix:
        include:
          - os: macos-latest
            target: --mac
          - os: windows-latest
            target: --win
    runs-on: ${{ matrix.os }}
    defaults:
      run:
        working-directory: desktop
```

**단계 계약(각 job)**:
1. checkout
2. Node 설정 — `desktop/.nvmrc`(24.14.0) 사용
3. `corepack enable` → pnpm 8
4. `pnpm install` (working-directory `desktop`; `.npmrc` node-linker=hoisted + onlyBuiltDependencies:[electron] 적용)
5. `pnpm build` (`tsc --noEmit && vite build`)
6. `pnpm exec electron-builder ${{ matrix.target }} --publish always` (GH_TOKEN으로 Release 업로드)
   - 또는 빌드 후 `softprops/action-gh-release`로 `desktop/release/*` 업로드
7. macOS job: ad-hoc 서명은 `electron-builder.yml`의 `mac.identity: "-"`로 패키징 중 처리(추가 수동 codesign 불필요가 목표 — R3 검증 게이트 통과 조건)

**불변식**:
- `fail-fast: false` → 한쪽 OS 실패 시 다른 OS 자산은 정상 게시, 실패는 job 빨강으로 표면화(Edge case: 한쪽 빌드 실패).
- 트리거는 `v*` 태그만 — 일반 push/PR은 릴리스 빌드 안 함.

## B. electron-builder 산출물 계약

`desktop/electron-builder.yml` (현재 → 목표 diff)

```yaml
appId: com.naraenote.desktop
productName: Narae Note
directories:
  output: release
files:
  - dist/**/*
  - dist-electron/**/*
asar: true
artifactName: ${productName}.${ext}        # 버전 미포함 고정명 → Narae Note.dmg
mac:
  target: dmg
  arch: [universal]                         # (신규) Intel + Apple Silicon
  icon: assets/icon.png
  identity: "-"                             # (변경) null → ad-hoc 서명
  hardenedRuntime: false                    # (신규) 무서명 시 실행 차단 회피
win:
  target: nsis                              # (신규)
  icon: assets/icon.png
nsis:
  oneClick: true                            # (신규) 마법사 없는 1-click
  perMachine: false                         # (신규) 관리자 권한 불필요
```

> 파일명 주의: `artifactName`에 공백이 들어가면 URL 인코딩 이슈 가능 → 실제 값은 `Narae-Note.${ext}` / `Narae-Note-Setup.${ext}` 형태로 하이픈 사용 권장(다운로드 링크와 정확히 일치시킬 것). NSIS는 기본이 `${productName} Setup.${ext}`이므로 win 산출물명을 `Narae-Note-Setup.exe`로 고정.

**산출물 불변식**:
- macOS: `Narae-Note.dmg` (universal, ad-hoc 서명)
- Windows: `Narae-Note-Setup.exe` (NSIS, 무서명)
- `node:sqlite`는 Node 내장 → asarUnpack/rebuild 불필요(기존 유지).

## C. 다운로드 링크 계약

다운로드 페이지가 의존하는 안정 URL(불변):

| OS | URL |
|---|---|
| Windows | `https://github.com/JK-Kim4/write-note/releases/latest/download/Narae-Note-Setup.exe` |
| macOS | `https://github.com/JK-Kim4/write-note/releases/latest/download/Narae-Note.dmg` |

**불변식**:
- 파일명이 바뀌면 본 링크가 깨진다 → `artifactName`(계약 B)과 **반드시 일치**.
- 게시된 릴리스가 0개면 `latest`가 404 → 페이지는 첫 릴리스 게시 후 노출하거나, 링크 부재를 우아하게 처리(Edge case: 릴리스 부재 접근).
