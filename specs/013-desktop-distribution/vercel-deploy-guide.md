# 다운로드 페이지(`download-site/`)를 Vercel에 띄우는 방법

이 가이드를 끝내면 `https://<당신의-vercel-주소>/` 에서 나래 노트 다운로드 페이지가 인터넷에 공개됩니다.

> **구조:** 다운로드 페이지는 웹앱(`frontend/`)과 **완전히 분리된 정적 사이트**입니다. `download-site/index.html` 한 장(프레임워크·빌드·백엔드 없음)이라, 멈춰둔 웹앱(로그인·집필 등)은 **공개되지 않습니다.** 설치파일(dmg/exe)은 GitHub Releases에서 받아지고, 이 페이지는 그 링크를 안내할 뿐입니다.

## 전제 조건

- GitHub 계정 (저장소 `JK-Kim4/write-note`, public 상태) — 이미 완료
- Vercel 계정 (없으면 1단계에서 GitHub으로 가입, 무료)

## 단계

### 1. Vercel에 GitHub으로 로그인

[vercel.com](https://vercel.com) 에서 **Continue with GitHub** 으로 로그인/가입합니다.

→ 대시보드(프로젝트 목록)가 보입니다.

### 2. 새 프로젝트로 저장소 가져오기

우측 상단 **Add New… → Project** → "Import Git Repository" 목록에서 **`write-note`** → **Import**.

→ "Configure Project" 설정 화면으로 넘어갑니다.

> 목록에 없으면 **Adjust GitHub App Permissions** 로 `write-note` 접근 권한을 부여한 뒤 다시 확인합니다.

### 3. ⚠️ Root Directory를 `download-site`로 지정 (핵심)

Configure Project 화면의 **Root Directory → Edit → `download-site`** 선택.

→ 이 폴더 안의 `index.html` 만 배포됩니다. (`frontend/`·`backend/`·`desktop/`는 배포 대상에서 제외)

### 4. Framework Preset을 `Other`로

**Framework Preset** 이 자동으로 안 잡히거나 Next.js로 잡히면 **Other** 로 바꿉니다(정적 HTML이라 빌드 불필요).

- Build Command: 비움 (없음)
- Output Directory: 비움 (루트의 `index.html` 그대로 서빙)

### 5. 배포

**Deploy** 를 누릅니다.

→ 수 초 내 "Congratulations" 화면 + 미리보기가 뜹니다.

### 6. 배포 브랜치를 `main`으로 확인

**Settings → Git → Production Branch = `main`** 인지 확인합니다.

→ 이후 `main`의 `download-site/`가 바뀌면 자동 재배포됩니다.

## 확인

브라우저에서 **`https://<프로젝트이름>.vercel.app/`** 접속.

→ "나래 노트 다운로드" 화면 + Windows/Mac 버튼 + 설치 안내문이 보이고, 방문 OS 버튼이 강조되며, 버튼을 누르면 GitHub Releases에서 설치파일이 받아지면 성공입니다.

## 문제 해결

- **빈 화면 / 404**: Root Directory가 `download-site`인지(3단계), Framework가 `Other`인지(4단계) 확인.
- **다운로드 버튼이 404**: GitHub Release가 **게시(Publish)** 상태이고 저장소가 **public**인지 확인. (현재 `v0.1.0` 게시·public 완료)
- **새 버전인데 옛 버전 받아짐**: 새 릴리스를 **Publish**(draft 해제)했는지 확인. 링크는 항상 "최신 게시 릴리스"를 가리킵니다.
- **OS 감지가 틀림**: 두 버튼 다 항상 노출되므로 사용자가 다른 버튼으로 직접 받을 수 있습니다(문제 아님).

## 참고

- 페이지 파일: `download-site/index.html` (정적 1장, 자기완결)
- 다운로드 대상: `https://github.com/JK-Kim4/write-note/releases/latest/download/Narae-Note.dmg` · `…/Narae-Note-Setup.exe`
- 새 릴리스 내는 법: [`desktop/README.md`](../../desktop/README.md) "릴리스 절차"
- 웹앱(`frontend/`)은 이 배포와 무관하며 공개되지 않습니다.
