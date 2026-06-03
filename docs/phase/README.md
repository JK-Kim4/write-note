# Desktop MVP Phase Index

이 디렉터리는 desktop MVP 구현을 큰 phase 단위로 추적하기 위한 작업 지침 모음이다.

기준 문서:

- 설계: `docs/superpowers/specs/2026-05-31-desktop-mvp-design.ko.md`
- phase 계획: `docs/superpowers/plans/2026-05-31-desktop-mvp-phases.md`

## Phase 목록

| Phase | 디렉터리 | 목표 | 상태 |
|---|---|---|---|
| 0 | `00-web-pause/` | WEB 개발 일시 중단과 desktop 트랙 기준선 명시 | ✅ 완료 |
| 0.5 | `00-5-desktop-design-definition/` | 구현 전 desktop MVP 디자인 기준 확정 | ✅ 완료 (2026-06-03 승인) |
| 1 | `01-desktop-scaffold/` | Electron/Vite desktop app 최소 실행 환경 구축 | ✅ 완료 (2026-06-03, PR #27) — Electron shell 결선, 자동화 GREEN, dogfooding 대기 |
| 2 | `02-local-persistence/` | 로컬 저장 경계와 Project/Document/Memo persistence 확정 | ⬜ 대기 |
| 3 | `03-projects-workspace/` | 프로젝트 생성/선택 workspace 구현 | ⬜ 대기 |
| 4 | `04-write-studio-autosave/` | 일반 에디터와 로컬 자동 저장 구현 | ⬜ 대기 |
| 5 | `05-memo-capture-inbox/` | 빠른 메모 캡처와 inbox 구현 | ⬜ 대기 |
| 6 | `06-memo-linking-side-panel/` | 메모-프로젝트 연결과 작성 화면 side panel 구현 | ⬜ 대기 |
| 7 | `07-prototype-usability/` | 실제 사용 가능한 prototype polish | ⬜ 대기 |
| 8 | `08-mvp-review/` | desktop MVP review gate와 다음 phase 결정 | ⬜ 대기 |

## 운용 원칙

- Phase 0.5가 완료되고 사용자 승인을 받기 전에는 Phase 1 구현에 들어가지 않는다.
  - **예외(2026-06-01)**: 디자인 확정 중 '실제 에디터 확인' 필요로 사용자 동의 하에 Phase 1 렌더러 부분(`desktop/` Vite+React+TipTap)에 선진입. Electron 패키징·persistence는 미진입.
- Phase 7까지 완료되면 “사용 가능한 데스크탑 앱 프로토타입”으로 판정한다.
- 각 phase는 독립 커밋 단위로 남긴다.
- 기존 `frontend/`와 `backend/`는 desktop MVP 구현 중 기능 수정하지 않는다.
- 첫 MVP에서는 원고지 모드, 모바일 캡처, 인증, 서버 동기화, 태그, 이유 노트, 등장인물, 검색, export, AI를 구현하지 않는다.
