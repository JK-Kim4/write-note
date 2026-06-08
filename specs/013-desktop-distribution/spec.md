# Feature Specification: Desktop 앱 공개 배포 (Windows + macOS)

**Feature Branch**: `013-desktop-distribution`

**Created**: 2026-06-08

**Status**: Draft

**Input**: 설계 SoT — `docs/superpowers/specs/2026-06-08-desktop-distribution-design.md`. Desktop 앱(Electron, `desktop/`)을 Windows + macOS로 공개 배포. 비개발자가 최대한 간단히 설치. 양 OS 무서명 + 설치 안내문으로 시작(서명·자동 업데이트는 향후 확장). GitHub Actions 매트릭스 빌드 → GitHub Releases. Vercel 프론트에 다운로드 페이지.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 자동 릴리스 파이프라인 (Priority: P1)

릴리스 담당자(개발자)가 새 버전 번호를 정해 버전 태그를 게시하면, 사람의 추가 개입 없이 Windows용 설치파일과 macOS용 설치파일이 각각 생성되어 공개 다운로드 위치에 게시된다.

**Why this priority**: 배포할 산출물(설치파일) 자체가 없으면 다운로드 페이지도, 사용자 설치도 성립하지 않는다. 모든 것의 토대이며, macOS에서 Windows 설치파일을 만들 수 없는 제약을 해결하는 핵심.

**Independent Test**: 테스트 버전 태그를 게시한 뒤, 사람이 파일을 만들거나 올리지 않았는데도 공개 다운로드 위치에 양 OS 설치파일이 나타나는지로 단독 검증 가능.

**Acceptance Scenarios**:

1. **Given** 빌드 가능한 desktop 소스, **When** 릴리스 담당자가 버전 태그를 게시, **Then** Windows·macOS 설치파일이 자동 생성되어 공개 다운로드 위치에 게시된다.
2. **Given** 자동 생성된 macOS 설치파일, **When** Apple Silicon Mac에서 실행, **Then** "손상됨/서명 없음" 즉시 실행 거부가 발생하지 않는다(보안 경고 우회 절차로 실행 가능).
3. **Given** 자동 생성된 Windows 설치파일, **When** 일반 사용자 계정에서 설치, **Then** 관리자 권한 프롬프트 없이 설치가 완료된다.

---

### User Story 2 - 비개발자 다운로드·설치 경험 (Priority: P1)

기술을 모르는 사용자가 다운로드 페이지에 접속하면, 자기 운영체제에 맞는 설치파일을 한 번의 클릭으로 받고, 같은 페이지의 한국어 안내문을 따라 첫 실행 시 뜨는 보안 경고를 통과해 앱을 사용할 수 있다.

**Why this priority**: "비개발자가 최대한 간단히 설치"가 본 작업의 본질 목표. 무서명이라 첫 실행에 보안 경고가 뜨므로, 안내문이 설치 성공의 핵심 장치다.

**Independent Test**: 비개발자 사용자에게 다운로드 페이지 링크만 주고, 추가 구두 설명 없이 페이지 안내문만으로 설치·실행을 완료하는지로 단독 검증 가능.

**Acceptance Scenarios**:

1. **Given** Windows 사용자가 다운로드 페이지 접속, **When** 페이지가 열림, **Then** Windows용 다운로드가 우선 안내되며 macOS 버튼도 함께 보인다.
2. **Given** macOS 사용자가 다운로드 페이지 접속, **When** 페이지가 열림, **Then** macOS용 다운로드가 우선 안내되며 Windows 버튼도 함께 보인다.
3. **Given** 다운로드한 설치파일, **When** 사용자가 페이지의 OS별 안내문(Windows SmartScreen / macOS 시스템 설정)을 따름, **Then** 보안 경고를 통과해 앱이 실행된다.

---

### User Story 3 - 버전 갱신 (Priority: P2)

새 버전이 게시된 뒤에도 사용자는 변하지 않는 동일한 다운로드 링크에서 항상 최신 버전을 받을 수 있다.

**Why this priority**: 자동 업데이트가 범위 밖이므로, 사용자의 갱신 수단은 "같은 링크 재다운로드"다. 링크가 버전마다 바뀌면 안내문·외부 공유 링크가 매번 깨진다.

**Independent Test**: 두 번 연속 버전을 게시한 뒤, 동일한 다운로드 링크가 두 번째(최신) 설치파일을 내려주는지로 단독 검증 가능.

**Acceptance Scenarios**:

1. **Given** 이전 버전이 게시된 상태, **When** 새 버전을 게시, **Then** 다운로드 페이지의 링크를 바꾸지 않아도 새 버전이 내려받아진다.

---

### Edge Cases

- **무서명 보안 차단**: Windows SmartScreen("Windows의 PC 보호"), macOS Sequoia(우클릭→열기 우회 제거 → 시스템 설정 경로) → 안내문으로 단계별 우회 제공.
- **한쪽 OS 빌드 실패**: 한 OS 빌드가 실패해도 다른 OS 산출물이 잘못 게시되어 사용자가 깨진 파일을 받는 일이 없어야 한다(실패는 릴리스 담당자에게 드러나야 함).
- **릴리스 부재 상태 접근**: 아직 게시된 릴리스가 없을 때 다운로드 링크 접근 → 사용자가 깨진(404) 경험을 하지 않도록 처리.
- **Apple Silicon ad-hoc 서명 누락**: 무서명 빌드가 ad-hoc 서명조차 없으면 Apple Silicon이 실행을 거부 → 빌드 단계에서 ad-hoc 서명 보장 필요.
- **잘못된 OS 파일 다운로드**: OS 자동 감지가 틀려도 사용자가 다른 OS 버튼으로 직접 받을 수 있어야 한다.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 시스템은 버전 태그 게시 시 Windows용·macOS용 설치파일을 사람의 추가 개입 없이 생성해야 한다.
- **FR-002**: 생성된 설치파일은 인증 없이 접근 가능한 공개 위치에 게시되어야 한다.
- **FR-003**: 다운로드 페이지는 방문자의 운영체제를 감지해 해당 OS 설치파일을 우선 안내하되, Windows·macOS 두 다운로드 수단을 모두 제공해야 한다.
- **FR-004**: 다운로드 링크는 버전이 올라가도 변경 없이 항상 최신 설치파일을 가리켜야 한다.
- **FR-005**: 다운로드 페이지는 각 OS의 첫 실행 보안 경고 우회 절차를 한국어 안내문으로 제공해야 한다(Windows SmartScreen, macOS Sequoia 시스템 설정 경로 포함).
- **FR-006**: macOS 설치파일은 Intel·Apple Silicon 양쪽 Mac에서 실행 가능해야 한다.
- **FR-007**: macOS 설치파일은 Apple Silicon에서 서명 누락으로 인한 즉시 실행 거부가 발생하지 않아야 한다.
- **FR-008**: Windows 설치는 관리자 권한 없이 사용자 단위로 완료되어야 한다.
- **FR-009**: 설치된 앱은 기존 desktop 기능(집필실·메모·기록 등)을 회귀 없이 동일하게 제공해야 한다.
- **FR-010**: 릴리스 절차는 문서화되어 릴리스 담당자가 반복 가능해야 한다.
- **FR-011**: 향후 코드 서명·자동 업데이트를 추가할 때 배포 파이프라인 구조를 갈아엎지 않고 확장할 수 있어야 한다.

### Key Entities

- **릴리스(Release)**: 하나의 버전 태그에 대응하는 게시 단위. OS별 설치파일 자산 묶음을 포함한다.
- **설치파일 자산(Installer Asset)**: OS별 단일 설치파일. 버전과 무관한 고정 파일명을 가져 최신 링크를 안정적으로 유지한다.
- **다운로드 페이지(Download Page)**: 사용자 진입점. OS 감지, 다운로드 버튼, 설치 안내문을 담는다.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 비개발자 사용자가 다운로드 페이지 접속부터 앱 첫 실행까지를 외부 구두 설명 없이 페이지 안내문만으로 5분 이내에 완료한다.
- **SC-002**: 버전 태그 게시 후 양 OS 설치파일이 자동으로 게시 완료된다(릴리스당 수동 파일 업로드 0회).
- **SC-003**: 다운로드 페이지 방문자는 자기 OS 설치파일을 1회 클릭으로 받을 수 있다.
- **SC-004**: 새 버전을 게시한 뒤에도 기존 다운로드 링크 갱신 작업이 0회다(링크 불변).
- **SC-005**: 설치 후 앱이 Windows·macOS 양쪽에서 정상 실행된다(첫 실행 보안 경고 우회 후 크래시 0건).

## Assumptions

- 대상 사용자는 Windows 10 이상 또는 macOS(최신 Sequoia 포함)를 사용한다.
- 공개 저장소 기준 무료 CI/배포 호스팅을 사용할 수 있다.
- **무서명으로 시작**한다(사용자 결정) — 첫 실행 보안 경고는 안내문으로 감수한다.
- 한국 소재라 향후 서명은 macOS는 Apple Developer($99/년), Windows는 전통적 OV 인증서(하드웨어 토큰) 경로다(현 범위 밖).
- desktop 앱은 자체 완결적이며 Next.js 프론트 빌드에 의존하지 않는다.
- 다운로드 페이지는 기존 프론트(`frontend/`, Vercel) 안에 추가한다.

## Out of Scope

- 코드 서명(macOS 공증 / Windows 인증서) — 향후 확장.
- 자동 업데이트 — 무서명 macOS에서 불가 + 단순함 우선. 서명 도입 후 검토.
- Linux 빌드/배포.
- 다운로드 통계·텔레메트리.
