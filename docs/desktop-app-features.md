# write-note Desktop 앱 — 제공 기능 정리

> **문서 목적**: 현재 코드베이스(`desktop/`) 기준으로 데스크톱(Electron) 앱이 사용자에게 제공하는 기능을 정리한다.
> **작성일**: 2026-06-09 · **앱 버전**: v0.1.0 (MVP)
> **출처**: `desktop/electron/`(main·IPC·SQLite) · `desktop/src/`(React renderer) · `desktop/electron-builder.yml` 직접 분석.
> **대비 문서**: 웹 버전은 [`web-app-features.md`](./web-app-features.md) 참조.

write-note Desktop 은 **로컬 우선(local-first) SQLite 기반 오프라인 집필 도구**다. 네트워크·로그인 없이 본인 PC 안에서 **본문 집필 + 곁쪽지(메모) 정리 + 작업 기록 추적**을 한다. Electron의 IPC 샌드박스를 통해 renderer(React UI)가 main 프로세스의 로컬 DB에 안전하게 접근하는 구조다.

---

## 한눈에 보기

| 영역 | 사용자가 할 수 있는 일 | 상태 |
|---|---|---|
| **작품 관리** | 작품 생성·수정·삭제, 카드 벽(마지막 문장·다음 장면), 작품당 본문 1개 자동 생성 | 구현 |
| **본문 집필** | TipTap 에디터, 자동저장(700ms), 글자수, 페이지(A4) 시뮬레이션, 줌 | 구현 |
| **곁쪽지(메모)** | 빠른 캡처, 쪽지 책상, 작품 다중 연결, 곁쪽지 고정, soft-delete 복구 | 구현 |
| **재진입 한 장** | 집필 재개 시 마지막 문장 + 다음 장면 + 곁쪽지 1장 자동 표시 | 구현 |
| **기록/진척 추적** | 작업 세션 자동 추적, 기록 메모, 진척%·총 작업시간 기록 화면 | 구현 |
| **설정/보기** | 테마(종이/촛불), 자동저장 토글, 줌 — 설정 로컬 영속 | 구현 |
| **문의** | 인앱 문의 폼 전송, 카카오 채널 링크 | 구현 |

> 💡 **웹 버전과의 가장 큰 차이**: ① **로그인/인증이 없다**(로컬 단일 사용자). ② 모든 데이터가 **로컬 SQLite 파일**에 저장된다(서버·동기화 없음). ③ 웹에서 **미구현**이던 "기록(Log)"·"문의(Contact)" 화면이 데스크톱에서는 **완전히 구현**되어 있다.

---

## 1. 작품 관리 (작품 화면)

작품을 카드 핀보드 형태로 관리한다. 작품을 만들면 본문 문서가 함께 자동 생성된다.

**제공 기능**
- 작품 생성 — 제목(필수) + 요약·장르·톤·목표 글자수(선택). 생성 시 빈 본문 document 원자적 동시 생성
- 작품 벽(카드 목록) — 카드마다 **마지막 문장**(본문에서 파생) + **다음에 쓸 장면**(작가가 적는 한 줄) 표시
- 작품 수정 — 제목·요약·장르·톤·목표 글자수·다음 장면
- 작품 삭제 — 확인 다이얼로그(연결된 본문·기록·세션 CASCADE 삭제)
- 작품 0개일 때 입구 안내 + 시작 CTA

---

## 2. 본문 집필 (집필 화면)

"종이가 주인공"인 집필 공간. 작품당 본문 문서 1개를 편집한다.

**제공 기능**
- **TipTap(ProseMirror) 에디터** — 굵게·기울임·제목·인용·리스트. 선택 시에만 BubbleMenu 서식 도구 노출
- **자동저장** — 기본 ON, 700ms 디바운스 후 저장. 상태 표시("저장됨/저장 중…/저장 실패"). OFF 시 수동 저장 버튼
- **실시간 글자수** — 공백·줄바꿈 제외
- **페이지 시뮬레이션** — A4 크기, 줄노트 선택
- **줌 레벨 조정** — 페이지 시각 보정
- **고정 타이포그래피** — 글꼴/크기 고정(고운바탕 18px), "순도" 컨셉으로 변경 불가
- **곁쪽지 서랍(MemoPanel)** — 현재 작품에 연결된 쪽지 목록, 연결 해제, 곁쪽지 고정 토글
- **작업 종료 버튼** — 기록 메모 본문 입력 → 세션 종료 + 기록 저장(원자적)

---

## 3. 재진입 한 장 (집필 재개)

세션이 끊겨도 컨텍스트가 이어지게 하는 핵심 기능. 집필 진입 직후 한 번 표시된다.

**표시 내용 (우선순위)**
- **마지막 문장** — 본문 plainText에서 파생
- **다음에 쓸 장면** — 작가가 저장한 한 줄
- **곁에 둘 쪽지 1장** — 우선순위: 고정(pinned) → 연결된 쪽지 중 최신 → 캡처 시각 최신

> 다시 열면 초기화되어, 매 집필 진입 시 "어디서 멈췄는지"를 한 장으로 되짚게 한다.

---

## 4. 곁쪽지(메모)

떠오른 생각을 최소 마찰로 캡처하고 작품과 연결해 정리한다.

**제공 기능**
- **빠른 캡처("잉크 한 방울")** — 어느 화면에서나 모달 캡처. 활성 작품 있으면 자동 연결. 초안 보존(내용 있으면 Escape 무시·취소 확인), 포커스 트랩 + 직전 포커스 복귀
- **쪽지 책상(메모 화면)** — 전체 쪽지 목록(캡처 최신순), 상대 날짜 라벨(오늘/어제/N일 전), 연결 작품 목록 표시
- **작품별 추림 필터** — "전부" 또는 특정 작품 연결 쪽지만
- **인라인 캡처** — 책상에서 직접 쪽지 추가(미연결)
- **붙이기 팝오버(LinkPopover)** — 작품 체크박스로 다대다 연결/해제, 낙관적 UI(실패 시 롤백)
- **곁쪽지 고정** — 작품당 1개만(setPin 시 기존 고정 자동 해제)
- **삭제/복구** — soft delete + 최근 1건 되돌리기(Toast)
- 통계·미연결 카운터를 노출하지 않는 부드러운 UX

---

## 5. 기록 & 진척 추적 (기록 화면)

작업 시간과 진척을 자동 추적한다. 데스크톱 고유의 세션 기반 기능이다.

**제공 기능**
- **자동 세션 추적**
  - 집필 진입 시 세션 자동 시작
  - 화면 이탈/작품 전환 시 자동 종료(짧은 세션은 폐기되어 과대 합산 방지)
  - 앱 시작 시 비정상 종료된 세션 정리(dangling 폐기), 앱 종료 시 열린 세션 일괄 종료
- **기록 메모** — 작업 종료 버튼으로 "이번에 한 일" 메모 저장(세션 종료와 원자적 처리)
- **기록 카드(작품별)** — 작품 제목 + 마지막 문장, 진척%(글자수 ÷ 목표), 최신 기록 메모 1개, 총 작업 시간(종료된 세션 합산), "집필하기" 바로가기

---

## 6. 설정 & 보기

**제공 기능**
- 테마 전환 — 종이(light) / 촛불(dark)
- 자동저장 ON/OFF — 로컬 설정으로 영속(`app_settings.autosave_enabled`)
- 줌 레벨 조정
- 좌측 Rail(작품/집필/메모/기록/문의 + 잉크 버튼), 우측 Dock(설정, 기본 접힘) 레이아웃

---

## 7. 문의 & 피드백 (문의 화면)

**제공 기능**
- 인앱 문의 폼 — 회신 이메일(선택, 형식 검증) + 의견 본문(필수)
- 전송 시 main 프로세스가 메타(앱 버전·OS·전송 시각)를 자동 부여 → Formsubmit 외부 전송
- 카카오 채널 "실시간 대화" 외부 링크(`shell.openExternal`, https만 허용)
- 성공/실패 토스트

---

## 부록 A. IPC API (renderer ↔ main)

renderer는 `window.electronAPI`(preload contextBridge 화이트리스트)로만 기능에 접근한다. Node·파일시스템 직접 접근은 차단된다.

| 네임스페이스 | 메서드 |
|---|---|
| `projects` | create · list · listCards · get · update · delete |
| `documents` | getByProject · update |
| `memos` | create · list · listByProject · pickReentry · addLink · removeLink · setPin · delete · restore |
| `settings` | get(key) · set(key, value) |
| `logs` | list · listByProject |
| `sessions` | start · end · endWithLog |
| `contact` | send |
| `shell` | openExternal (https만) |
| `platform` | OS 식별값(darwin/win32/linux) |

## 부록 B. 로컬 데이터 모델 (SQLite, schema v6)

저장 위치: `${userData}/write-note.db` (플랫폼별 자동 경로). `foreign_keys=ON`, `journal_mode=WAL`.

| 테이블 | 의미 |
|---|---|
| `projects` | 작품(제목, 요약, 톤, 장르, 목표 글자수, **next_scene**) |
| `documents` | 본문(작품당 1개, ProseMirror JSON + plainText + 글자수) |
| `memos` | 쪽지(본문, 캡처 시각, source, **deleted_at** soft delete) |
| `memo_projects` | 쪽지↔작품 다대다 연결(+ **pinned** 곁쪽지) |
| `app_settings` | 앱 설정(key-value) |
| `project_logs` | 작업 종료 시 남기는 기록 메모 |
| `work_sessions` | 작업 세션(started_at, ended_at) |

**Store 레이어 주요 use-case**: `createProjectWithDocument`(작품+본문 원자 생성) · `captureMemo`(쪽지+연결) · `listProjectCards`(벽 카드 집계) · `listLogCards`(기록 카드 집계) · `endSessionWithLog`(세션 종료+로그, 트랜잭션) · `closeDangling`/`endAllOpenSessions`(세션 정리).

---

## 부록 C. 데스크톱 고유 특성 & 패키징

**런타임 특성**
- **로컬 우선** — 모든 쿼리가 로컬 SQLite 동기 호출(네트워크 지연 없음, 완전 오프라인)
- **인증 없음** — 단일 로컬 사용자(로그인·세션·OAuth 불필요)
- **IPC 샌드박스** — `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. main만 화이트리스트 IPC로 기능 노출
- **앱 라이프사이클 훅** — 시작 시 마이그레이션 + dangling 세션 정리, 종료 직전 열린 세션 종료, macOS dock 재활성화 대응

**패키징/배포 (electron-builder)**
- macOS: universal DMG(`Narae-Note.dmg`), 현재 ad-hoc 서명
- Windows: NSIS 1-click 설치(사용자 권한, `Narae-Note-Setup.exe`)
- 배포: `v*` 태그 push → GitHub Actions가 macOS·Windows 빌드 → Release **draft** 업로드 → 수동 검증 후 publish (설계: `specs/013-desktop-distribution/`)

---

## 부록 D. 웹 버전과의 차이 (확인된 사실 기준)

| 구분 | Desktop (Electron) | Web (Next.js) |
|---|---|---|
| 데이터 저장 | 로컬 SQLite 파일 | 백엔드 PostgreSQL |
| 접근 방식 | IPC → main → `node:sqlite`(동기) | `fetch` → REST API(비동기) |
| 인증 | **없음**(로컬 단일 사용자) | 이메일/카카오 + JWT·쿠키 세션 |
| 오프라인 | 완전 지원 | 서버 연결 필요 |
| 기록·문의 화면 | **구현** | **미구현**(네비 링크만 존재) |
| 등장인물 관리 | **없음** | 구현 |
| 모바일 캡처 토큰 | 없음 | 있음(API 토큰) |
| 배포 | DMG/NSIS 패키징 | 브라우저(배포 불필요) |

> **등장인물 기능 확인 결과**: desktop에는 등장인물 관리가 **없다**. IPC 계약(`contract.ts`)에 character 네임스페이스가 없고, `electron/db/`에 characterRepository도 없다(`projects`/`documents`/`memos`/`settings`/`logs`/`sessions`/`contact`만 존재). 코드 내 `character` 참조는 폐기된 PoC(`src/poc/editcontext/`, 브라우저 EditContext API의 `characterboundsupdate` 이벤트)뿐으로 도메인 기능이 아니다. 등장인물은 웹 버전에만 있는 기능이다.

---

## 기술 스택 (참고)

- **셸**: Electron (main/preload/renderer 3계층)
- **renderer**: React + Vite (vite-plugin-electron 빌드)
- **에디터**: TipTap (ProseMirror)
- **로컬 DB**: `node:sqlite` (Node.js 내장 SQLite)
- **패키징**: electron-builder (DMG/NSIS), GitHub Actions 자동 빌드

> 이 문서는 v0.1.0 MVP 구현 스냅샷이다. desktop은 로컬 우선·오프라인 단일 사용자 도구이고, web 버전은 이를 다중 사용자·서버 동기 형태로 포팅하는 작업(015 브랜치)이 진행 중이다.
