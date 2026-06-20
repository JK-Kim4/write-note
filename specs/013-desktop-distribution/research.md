# Research: Desktop 앱 공개 배포 (013)

설계 SoT: `docs/superpowers/specs/2026-06-08-desktop-distribution-design.md`. 본 문서는 plan 단계의 기술 결정·검증 결과를 통합한다. 모든 결정은 검증(웹 출처 / 코드베이스)을 거쳤다.

## R1. 빌드 인프라 = GitHub Actions 매트릭스

- **Decision**: `macos-latest`(→ universal dmg) + `windows-latest`(→ NSIS exe) 매트릭스. `v*` 태그 push 트리거. 산출물은 GitHub Releases에 게시.
- **Rationale**: electron-builder는 **macOS에서 Windows 설치파일을 네이티브로 못 만든다**(크로스빌드 불가). OS별 네이티브 러너가 정공법. 로컬 빌드의 함정(룰 #8: nvm 전환 시 pnpm PATH 누락, arm64 서명)도 CI가 통째로 우회.
- **Alternatives**: Docker+Wine(로컬, Wine 의존·취약) / 로컬 빌드(룰 #8 함정 재현, Windows는 별도 PC 필요) — 모두 기각.
- **출처**: [electron-builder Multi Platform Build](https://www.electron.build/multi-platform-build.html)

## R2. macOS 아키텍처 = universal

- **Decision**: `mac.arch: [universal]` 단일 dmg(Intel + Apple Silicon).
- **Rationale**: 공개 배포라 Intel Mac 사용자 배제 불가. 단일 dmg면 다운로드 페이지 링크·안내문이 단순.
- **Alternatives**: arm64만(Intel 배제) / arch별 dmg 2개(다운로드 선택 혼란) — 기각.

## R3. macOS 무서명 서명 전략 = ad-hoc(`identity: "-"`) + `hardenedRuntime: false` ⚠️ 검증 게이트

- **Decision**: `mac.identity: "-"`(ad-hoc 서명) + `mac.hardenedRuntime: false`. 현재 `identity: null`(서명 완전 생략)에서 전환.
- **Rationale**:
  - `identity: null`(서명 생략)은 Apple Silicon에서 실행 거부 위험(룰 #8 재현 사례). `identity: "-"`는 electron-builder가 패키징 중 ad-hoc 서명을 직접 박아 universal 양 슬라이스를 한 번에 처리 → 룰 #8의 수동 `codesign --force --deep --sign -` + dmg 재생성 dance 불필요.
  - 서명을 끄면 Hardened Runtime도 꺼야 함(무서명+Hardened Runtime 조합은 실행 차단 가능).
- **⚠️ 리스크 / 검증 게이트**: electron-builder 문서는 ad-hoc(`-`)을 "빌드한 기기에서만 실행"으로 경고. 실제 배포 맥락에서 ad-hoc + 비공증 앱은 다른 Mac에서 "확인 없이 열기"로 실행 가능하다는 출처가 다수이나, **단정 불가**. → **다른 Mac(또는 quarantine 속성 부여)에서 dmg 설치·실행을 반드시 검증**(quickstart 검증 절차 + tasks 게이트). 실패 시 fallback = macOS Apple Developer 서명+공증($99/년, 향후 확장으로 이미 문서화).
- **무서명 한계(확정 사실)**: 비공증 앱은 Gatekeeper가 "확인되지 않은 개발자"로 차단 → macOS Sequoia(15+)는 우클릭→열기 우회 제거 → **시스템 설정 → 개인정보 보호 및 보안 → "확인 없이 열기"** 경로 필수(앱당 1회). 매끄러운 1-click을 원하면 공증이 유일한 해법.
- **출처**: [electron-builder macOS](https://www.electron.build/docs/mac/), [Electron Code Signing](https://www.electronjs.org/docs/latest/tutorial/code-signing), [macOS Sequoia Gatekeeper 변경(iDownloadBlog)](https://www.idownloadblog.com/2024/08/07/apple-macos-sequoia-gatekeeper-change-install-unsigned-apps-mac/)

## R4. Windows 설치파일 = NSIS 1-click per-user

- **Decision**: `win.target: nsis`, `nsis.oneClick: true`, `nsis.perMachine: false`.
- **Rationale**: 비개발자 대상 → 마법사 없는 1-click + 사용자 단위 설치(관리자 권한 프롬프트 없음)가 가장 단순.
- **무서명 한계(확정 사실)**: SmartScreen "Windows의 PC 보호" 경고 → **추가 정보 → 실행**(1회). 서명해도 신규 앱은 평판 누적 전까지 경고 가능(EV조차 2024년부터 즉시 통과 혜택 제거).
- **출처**: [electron-builder Windows](https://www.electron.build/win.html), [SmartScreen 평판](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation)

## R5. 자산 게시 + 최신 링크 안정성 = GitHub Releases + `releases/latest/download/`

- **Decision**: 고정 `artifactName`(버전 미포함): `Soseolbi-Note.dmg` / `Soseolbi-Note-Setup.exe`. 다운로드 페이지는 `https://github.com/JK-Kim4/write-note/releases/latest/download/<고정명>`으로 링크.
- **Rationale**: GitHub의 `latest/download` 리다이렉트는 항상 최신 릴리스 자산을 가리킴 → 버전이 올라가도 링크 불변(FR-004 / SC-004). 무료 공개 호스팅.
- **Alternatives**: 버전 포함 파일명(매 릴리스 링크 갱신 필요) — 기각.

## R6. 다운로드 페이지 = `frontend/` Next.js `/download`

- **Decision**: `frontend/src/app/download/page.tsx`. OS 감지·버튼은 `'use client'` 컴포넌트(`navigator.userAgent`/`navigator.platform`). 안내문은 정적 표시.
- **Rationale**: 기존 프론트(Vercel)에 라우트 추가가 최소 비용. App Router 경계 룰(HARD-GATE): `navigator` 접근·클릭 핸들러 → `'use client'` 의무.
- **Alternatives**: 별도 랜딩 사이트(신규 호스팅) / GitHub Releases 페이지 그대로(비개발자 혼란) — 기각.

## R7. 자동 업데이트 보류 + 서명 향후 확장 구조

- **Decision**: 자동 업데이트 미도입. 새 버전 = 동일 링크 재다운로드.
- **Rationale**: **무서명 macOS는 자동 업데이트 불가**(Squirrel.Mac이 서명·공증 강제). 무서명 결정과 양립 불가 + 단순함 우선.
- **확장 구조(FR-011)**: 워크플로에 서명 secret(`CSC_LINK`/`APPLE_API_KEY` 등)만 추가 + `electron-builder.yml`에 `identity`/`notarize`/`afterSign` 추가하면 파이프라인 골격 변경 없이 서명·공증·자동 업데이트(zip 타깃 + `electron-updater`) 확장 가능.
- **출처**: [electron-builder Auto Update](https://www.electron.build/auto-update)

## R8. CI 설치/빌드 환경 정합

- **Decision**: Node `24.14.0`(`desktop/.nvmrc`), pnpm 8(corepack), `pnpm install`은 `desktop/.npmrc`의 `node-linker=hoisted`(Electron flat node_modules 필요) + `package.json` `onlyBuiltDependencies:[electron]`(electron postinstall 승인) 그대로 사용.
- **Rationale**: 로컬 환경 가정과 CI 정합(룰 #8 환경 선확인). desktop은 Next.js 프론트와 독립 → CI는 `desktop/`만 빌드(`tsc --noEmit && vite build`).
- **검증**: CI에서 `pnpm install` 후 electron 바이너리가 hoisted로 설치되는지 빌드 로그 확인.
```
```
