# Desktop 앱 배포 설계 — Windows + macOS 공개 배포 (무서명 + 안내문)

- 일자: 2026-06-08
- 대상: `desktop/` (Electron + Vite + React 19 + TipTap, `node:sqlite`)
- 산출 경로: 본 문서 → 구현 계획(writing-plans)

## 1. 목표 / 제약

- **목표**: Windows + macOS 공개 배포. 비개발자가 최대한 간단히 설치.
- **결정(사용자 확정)**:
  - 공개 배포(불특정 다수).
  - **양 OS 무서명 + 설치 안내문**으로 시작. 나중에 서명을 쉽게 추가할 수 있는 구조.
  - 빌드/배포 = **GitHub Actions 매트릭스 → GitHub Releases**.
  - 다운로드 창구 = **Vercel 프론트의 다운로드 페이지**(OS 자동 감지 + 버튼 2개 + 안내문).
  - 자동 업데이트 = **보류**.
  - macOS = **universal**(Intel + Apple Silicon), Windows = **1-click per-user NSIS**(관리자 권한 불필요).
- **소재**: 대한민국 → Azure Artifact Signing(개인/조직) 대상국 미포함. 향후 서명 시 macOS는 Apple Developer($99/년), Windows는 전통적 OV 인증서(하드웨어 토큰).

### 검증된 핵심 제약 (2026)

1. **크로스 빌드 불가**: electron-builder는 macOS에서 Windows 설치파일을 네이티브로 못 만듦 → OS별 네이티브 빌드(GitHub Actions 러너) 필요.
2. **무서명 macOS 자동 업데이트 불가**: Squirrel.Mac이 서명 강제 → 자동 업데이트 보류와 정합.
3. **무서명 설치 마찰**:
   - Windows: SmartScreen "Windows의 PC 보호" → 추가 정보 → 실행(1회). 서명해도 신규 앱은 평판 누적 전까지 경고 가능.
   - macOS Sequoia(15+): 우클릭→열기 우회 **제거** → 시스템 설정 → 개인정보 보호 및 보안 → "확인 없이 열기" 경로 필수(앱당 1회).
4. **arm64 ad-hoc 서명**: `identity: null` 무서명 빌드는 ad-hoc 서명조차 누락될 수 있어 Apple Silicon에서 실행 거부됨(룰 #8) → 빌드에 ad-hoc 재서명 단계 내장.

## 2. 컴포넌트

### 2-1. `desktop/electron-builder.yml` 확장

현재(mac dmg, arm64, identity:null)에서 확장:

- `mac`:
  - `target: dmg`
  - `arch: [universal]` (Intel + Apple Silicon 단일 dmg)
  - `identity: null` 유지(무서명) — **CI에서 빌드 후 ad-hoc 재서명**(`codesign --force --deep --sign - <app>`) + dmg 재생성으로 Apple Silicon 실행 거부 회피
  - `icon: assets/icon.png` (1024×1024 → `.icns` 자동 생성)
- `win`:
  - `target: nsis`
  - `icon: assets/icon.png` (→ `.ico` 자동 생성)
- `nsis`:
  - `oneClick: true` (마법사 없는 1-click 설치)
  - `perMachine: false` (사용자 단위 설치 → 관리자 권한 프롬프트 없음)
- **고정 `artifactName`** (버전 미포함) → 다운로드 페이지가 `releases/latest/download/<고정명>`으로 항상 최신 링크:
  - 예: mac `Narae-Note.dmg`, win `Narae-Note-Setup.exe`
- `node:sqlite`는 Node 내장 → asarUnpack/rebuild 불필요(기존 주석 유지).

> 참고: ad-hoc 재서명은 빌드 자산이 universal(.app)이라 `--deep`로 양 슬라이스 서명. dmg를 electron-builder가 만든 뒤 재서명이 깨지지 않도록, .app 재서명 → dmg 재생성 순서를 CI에서 보장.

### 2-2. `.github/workflows/release.yml` (신규)

- 트리거: `push: tags: ['v*']`
- 권한: `contents: write` (Release 생성·자산 업로드)
- 매트릭스:
  - `macos-latest` → `electron-builder --mac` → ad-hoc 재서명 → `Narae-Note.dmg`
  - `windows-latest` → `electron-builder --win` → `Narae-Note-Setup.exe`
- 공통 단계: checkout → Node 24 setup → corepack(pnpm 8) → `pnpm install`(`desktop/`) → `pnpm build`(`tsc --noEmit && vite build`) → electron-builder → Release 업로드
- 작업 디렉토리: `desktop/` (Next.js 프론트와 독립 — 자체 React+TipTap, 프론트 빌드 불필요)
- Release 업로드: `softprops/action-gh-release` 또는 electron-builder `--publish`(GH_TOKEN). 태그명 = 릴리스.

### 2-3. 다운로드 페이지 (`frontend/` — `/download`)

- Next.js App Router 라우트(정적). 이벤트 핸들러/감지 로직 → `'use client'`.
- `navigator.userAgent` / `navigator.platform`로 OS 감지 → 해당 OS 버튼 강조(둘 다 표시).
- 버튼 링크(고정):
  - Windows → `https://github.com/JK-Kim4/write-note/releases/latest/download/Narae-Note-Setup.exe`
  - macOS → `https://github.com/JK-Kim4/write-note/releases/latest/download/Narae-Note.dmg`
- 설치 안내문(§2-4) 인라인. 한국어 우선(DESIGN.md 전제 #5).

### 2-4. 설치 안내문 (무서명이라 필수)

- **Windows**:
  1. `Narae-Note-Setup.exe` 다운로드 후 실행
  2. "Windows의 PC 보호" 창 → **추가 정보** → **실행**(1회)
  3. 설치 완료 → 시작 메뉴/바탕화면 아이콘
- **macOS (Sequoia 15+)**:
  1. `Narae-Note.dmg` 열어 **Narae Note**를 **응용 프로그램**으로 드래그
  2. 첫 실행 시 "확인할 수 없어 열 수 없음" → **완료**
  3. **시스템 설정 → 개인정보 보호 및 보안** 하단 → **"확인 없이 열기"** → 암호 입력(앱당 1회)
  4. 이후 정상 실행

### 2-5. 릴리스 절차(사용자)

```
# desktop/package.json version 상향 (예: 0.0.0 → 0.1.0)
git commit -am "chore(desktop): release v0.1.0"
git tag v0.1.0
git push origin <branch> --tags
# → GitHub Actions가 양 OS 빌드 + Release 자동 생성
```

## 3. 향후 확장(서명 도입 경로)

- **macOS 서명+공증**(효과 큼, 권장 1순위): Apple Developer($99/년). 워크플로에 `CSC_LINK`/`CSC_KEY_PASSWORD` + `APPLE_API_KEY` 등 secret 추가 + `electron-builder.yml` `mac.identity`/`notarize` 설정 → Gatekeeper 차단 완전 제거 + 자동 업데이트 활성화 가능.
- **Windows 서명**: 한국 소재 → 전통적 OV 인증서(하드웨어 토큰/HSM, ~$200~400/년). 서명해도 SmartScreen 평판은 다운로드 누적으로 형성됨.
- **자동 업데이트**: macOS 서명 도입 후 `electron-updater` + `latest.yml`/`latest-mac.yml`(zip 타깃 추가)로 활성화.

## 4. 범위 밖 (YAGNI)

- Linux 빌드(AppImage 등) — 요구 없음.
- 자동 업데이트(현 단계) — 무서명 제약 + 단순함.
- 코드 서명(현 단계) — 사용자 "우선 무서명" 결정.
- 다운로드 통계/텔레메트리.

## 5. 알려진 한계

- 무서명이라 양 OS 첫 실행에 수동 단계 존재(특히 macOS Sequoia의 시스템 설정 경로). "간단 설치" 목표의 가장 약한 지점 — 안내문으로 보완하되, 1-click을 원하면 macOS 서명이 가장 효과적.
- Windows: 서명 전까지 SmartScreen 경고 가능.

## 6. 출처(검증)

- Azure Artifact Signing(구 Trusted Signing) 가격·대상국: [Microsoft Azure 가격](https://azure.microsoft.com/en-us/pricing/details/artifact-signing/), [개인 개발자 공개 프리뷰](https://techcommunity.microsoft.com/blog/microsoft-security-blog/trusted-signing-is-now-open-for-individual-developers-to-sign-up-in-public-previ/4273554)
- Windows 서명 2026(하드웨어 토큰/EV SmartScreen 변경): [Microsoft Learn 코드 서명 옵션](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options), [SmartScreen 평판](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation)
- 크로스 빌드 제약: [electron-builder Multi Platform Build](https://www.electron.build/multi-platform-build.html)
- 무서명 macOS 자동 업데이트 불가: [electron-builder Auto Update](https://www.electron.build/auto-update), [Electron autoUpdater](https://www.electronjs.org/docs/latest/api/auto-updater)
- macOS Sequoia Gatekeeper 변경: [iDownloadBlog](https://www.idownloadblog.com/2024/08/07/apple-macos-sequoia-gatekeeper-change-install-unsigned-apps-mac/), [Macworld](https://www.macworld.com/article/2457844/what-to-do-when-you-cant-open-an-app-you-just-installed-in-macos-sequoia.html)
