# Data Model: Desktop 앱 공개 배포 (013)

본 기능은 DB 엔티티가 없다(빌드·배포 파이프라인 + 정적 다운로드 페이지). "엔티티"는 배포 산출물·설정 구조를 가리킨다.

## 1. Release (릴리스)

하나의 버전 태그에 대응하는 GitHub Release.

| 속성 | 값 / 규칙 |
|---|---|
| 태그 | `v<semver>` (예: `v0.1.0`) — `desktop/package.json` `version`과 일치 |
| 트리거 | 태그 push → GitHub Actions 워크플로 |
| 구성 자산 | macOS 설치파일 1 + Windows 설치파일 1 (양 OS 빌드 성공 시) |
| 상태 | 양 OS 빌드 성공 후 자산 업로드 완료 = 게시 완료 |

## 2. Installer Asset (설치파일 자산)

OS별 단일 설치파일. **버전 미포함 고정 파일명**으로 최신 링크를 불변 유지.

| OS | 파일명(고정) | 형식 | 특성 |
|---|---|---|---|
| macOS | `Narae-Note.dmg` | dmg, universal(x64+arm64) | ad-hoc 서명(`identity:"-"`), 비공증 |
| Windows | `Narae-Note-Setup.exe` | NSIS | 1-click, per-user(관리자 권한 불필요), 무서명 |

- 최신 링크: `https://github.com/JK-Kim4/write-note/releases/latest/download/<파일명>`
- `productName`: `Narae Note` (`electron-builder.yml` 기존 값 유지), `appId`: `com.naraenote.desktop`

## 3. Download Page (다운로드 페이지)

사용자 진입점. `frontend/src/app/download/page.tsx`.

| 요소 | 표시값 출처 | 동작 |
|---|---|---|
| OS 감지 배지 | `navigator.userAgent`/`navigator.platform` (client) | 방문자 OS 우선 강조 |
| Windows 다운로드 버튼 | 고정 링크(`...releases/latest/download/Narae-Note-Setup.exe`) | 항상 노출 |
| macOS 다운로드 버튼 | 고정 링크(`...releases/latest/download/Narae-Note.dmg`) | 항상 노출 |
| 설치 안내문(Windows) | 정적 텍스트 | SmartScreen → 추가 정보 → 실행 |
| 설치 안내문(macOS) | 정적 텍스트 | 시스템 설정 → 개인정보 보호 및 보안 → 확인 없이 열기 |

> 표시값 출처 명시(룰 #9): 모든 표시값은 **정적/감지값**이며 backend·DB 조회 없음. 다운로드 링크는 GitHub `latest/download` 리다이렉트(외부 조회)에 의존.

## 4. 상태 전이 (릴리스 흐름)

```
desktop/package.json version 상향
  → git tag v<semver> + push
    → [GitHub Actions] macos-latest: build → ad-hoc 서명 → Narae-Note.dmg
    → [GitHub Actions] windows-latest: build → Narae-Note-Setup.exe
      → 양 OS 자산을 Release v<semver>에 업로드 (= 게시 완료)
        → 다운로드 페이지 고정 링크가 자동으로 최신 가리킴
```

- 한쪽 OS 빌드 실패 시: 해당 job 실패로 표면화. 릴리스에 깨진 자산이 올라가지 않도록 처리(contracts 참조).
