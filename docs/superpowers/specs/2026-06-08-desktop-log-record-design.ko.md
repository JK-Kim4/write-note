# Desktop 기록(Log) — 작품별 진척·작업 시간·기록 메모 (작업 지시서 / design brief)

> **용도:** 본 문서는 `speckit-specify` 입력 brief(SDD, Spec-Driven Development)다. 2026-06-08 브레인스토밍으로 확정한 **기록(Log) 기능**을 담는다. 이 문서를 근거로 `specs/NNN-.../`의 spec → plan → tasks → implement 를 생성한다.
>
> **메타**
> - 트랙: Desktop MVP (Electron 로컬 우선 앱). 011 문의·의견 보내기 완료 직후의 다음 기능.
> - 작성일: 2026-06-08
> - 기준 브랜치: `develop` (HEAD `e405db3` — 나래 노트 브랜드 + 집필 가드 + 011 문의)
> - 상위 SoT: `docs/DESIGN.md`(비주얼 토큰) · `PRODUCT.md`(전략) · vault `02-PROGRESS.md`
> - feature 번호: 012 예상(011 다음). 브랜치는 `speckit-git-feature` 부여.
> - 현 상태: `desktop/src/screens/LogScreen.tsx` 는 placeholder(주석: "세션 노트·진척 통계는 MVP 제외 영역"). 본 작업이 그 placeholder 를 실데이터로 채운다.

---

## 1. 목표

작가가 **재진입 시 "어디까지 했지"를 다시 떠올리지 않도록**, 작품별 진척 상태를 한눈에 보여주는 기록 화면을 만든다. 4개 화면(작품/집필/메모/**기록**) 중 마지막으로 비어 있던 기록 화면을 실제 기능으로 채운다.

기록 화면(읽기 전용 카드 리스트)에 작품마다 다음을 표시한다:

1. **작품별 관리** — 모든 작품을 카드 리스트로 한눈에
2. **목표 글자수 대비 진척 %** — 목표가 설정된 작품만
3. **가장 최근 수정 날짜**
4. **가장 최근 추가된 지점** — 본문 마지막 문장으로 표시
5. **기록 메모** — 작가가 작업을 마칠 때 남기는, 메모 기능과 별개의 작업 기록(누적)
6. **(추가) 총 작업 시간** — 작업 세션 자동 추적으로 산출

---

## 2. 배경 — 초기 명세와의 차이

- **기록은 초기 명세에서 "MVP 제외"였다.** 0.5 디자인(2026-06-03 승인)에서 화면 자리만 잡고 placeholder 로 남겼다. 본 brief 가 기록의 구체 항목을 처음 정의한다.
- placeholder 가 흐리게 가정했던 모습은 *세션 수 / 이번 주 글자수* 같은 **시간축 누적 통계**였으나, 본 설계는 **작품 단위 스냅샷 + 작업 시간**으로 방향을 잡는다. (세션 "수"가 아니라 작업 "시간"을 추적.)
- #1~#4 는 기존 데이터(`projects` / `documents`)에서 파생되어 추가 추적 장치가 필요 없다. #5(기록 메모)·#6(작업 시간)은 신규 테이블이 필요하다.

---

## 3. 데이터 모델 (스키마 v5 → v6)

기존 필드 **재사용**(신규 컬럼 없음):
- 진척% ← `projects.target_length`(목표 글자수, nullable) + `documents.word_count`(현재 글자수). `word_count` 는 `Editor.tsx:59` 에서 `text.replace(/\s/g, "").length` = **공백 제외 글자수**로 계산됨(검증 완료) → `target_length` 와 동일 단위.
- 최근 수정일 ← `projects.updated_at`(본문 저장 시 `Store.updateDocument` 가 `projects.touch` 로 갱신).
- 마지막 문장 ← `documents.plain_text` → `src/lib/lastSentence.ts` 파생(작품 벽 카드와 동일 로직 재사용).

**신규 테이블 2개** — `schema.ts` 의 메인 `CREATE TABLE IF NOT EXISTS` 블록에 추가하고 `SCHEMA_VERSION` 을 6 으로 올린다. 두 테이블 모두 **완전 신규**라 기존 DB 업그레이드 시 `ALTER` 가 필요 없다(메인 블록의 `IF NOT EXISTS` 가 기존 DB 에도 생성). v6 주석만 추가.

```sql
CREATE TABLE IF NOT EXISTS project_logs (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,            -- 기록 메모 본문
  created_at  TEXT NOT NULL             -- 작성 시각(ISO)
) STRICT;

CREATE TABLE IF NOT EXISTS work_sessions (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  started_at  TEXT NOT NULL,            -- 집필 화면 진입 시각
  ended_at    TEXT                      -- 종료 시각. NULL = 진행 중
) STRICT;
```

인덱스: `project_logs(project_id, created_at DESC)`, `work_sessions(project_id)`.

CASCADE: 작품 삭제 시 두 테이블의 행도 함께 삭제(기존 `documents`/`memo_projects` 와 동일 정책).

---

## 4. 작업 세션 생명주기 (자동 시작 / 자동 종료 / 명시 종료)

**확정 모델: 자동 시작 + 자동 종료 + 종료 버튼.**

- **자동 시작** — `activeProject` 가 있고 `screen === "write"` 로 진입하는 순간 `work_sessions` 행 생성(`started_at = now`, `ended_at = NULL`). 한 작품당 열린(미종료) 세션은 1개만 유지한다(진입 시 기존 열린 세션이 있으면 먼저 닫는다).
- **자동 종료** — 집필 화면을 벗어나는 모든 경로에서 열린 세션을 닫는다(`ended_at = now`):
  - 다른 화면(작품/메모/기록/문의)으로 이동
  - 다른 작품으로 전환
  - 앱 종료 — Electron main 프로세스 `before-quit`(또는 `window 'close'`) 훅에서 열린 세션 닫기
  - 자동 종료는 **기록 메모를 남기지 않는다**(시각만 기록).
- **명시 종료** — 집필 화면의 **"작업 종료" 버튼** → 기록 메모 입력 모달 → 저장 시 **세션 종료(`ended_at`) + `project_logs` 행 추가를 한 트랜잭션**으로 처리(부분 실패 방지).
- **dangling 정리** — 앱 비정상 종료로 `ended_at = NULL` 세션이 남으면, 다음 앱 시작 시 `closeDangling()` 으로 폐기 처리(`ended_at = started_at`, duration 0). 실제 멈춘 시각을 모르므로 과대계산을 막는다.
- **짧은 세션 자동 폐기(확정 가드)** — 세션 종료 시(자동/명시 무관) `ended_at − started_at` 이 **30초 미만**이면 그 세션 행을 삭제한다(잠깐 들어갔다 나온 것 제외). 단, 명시 종료로 기록 메모가 함께 저장되는 경우는 짧아도 폐기하지 않는다(작가가 의도적으로 남긴 기록 보존).
  - *미적용 가드(기록만):* 앱 열어둔 채 장시간 무입력 시 세션 캡(자리 비움 과대계산 방지) — 본 작업 범위 밖. 향후 필요 시 별도 검토.

총 작업 시간 = 작품별 `Σ(ended_at − started_at)`(종료된 세션만).

---

## 5. 백엔드 (Repository / Store / IPC)

### 5-1. Repository (신규)

- `ProjectLogRepository`
  - `create(projectId, body): ProjectLog`
  - `listByProject(projectId): ProjectLog[]` — `created_at DESC`
  - `latestByProject(projectId): ProjectLog | null`
- `WorkSessionRepository`
  - `start(projectId): WorkSession` — 열린 세션 1개 보장(있으면 먼저 닫고 시작)
  - `endOpen(projectId, endedAt): void` — 그 작품의 열린 세션 닫기 + 30초 미만 폐기
  - `totalDurationMsByProject(projectId): number`
  - `closeDangling(): void` — 앱 시작 시 NULL ended_at 폐기

### 5-2. Store (use-case 집계)

- `addProjectLog(projectId, body): ProjectLog`
- `endSessionWithLog(projectId, body): { session, log }` — 세션 종료 + 로그 추가 한 트랜잭션
- `listLogCards(): LogCard[]` — 기록 화면이 한 번에 그릴 작품별 집계:
  ```
  LogCard = {
    project: Project,              // title, target_length, updated_at, ...
    wordCount: number,             // 그 작품 단일 document 의 word_count
    lastSentenceSource: string,    // plain_text (렌더러가 lastSentence() 파생)
    latestLog: ProjectLog | null,  // 최신 기록 메모 1개
    logs: ProjectLog[],            // 아코디언 펼침용 누적 전체 (또는 별도 IPC 로 lazy)
    totalDurationMs: number        // 총 작업 시간
  }
  ```
  - *결정 포인트(speckit-plan):* 누적 로그 전체를 `listLogCards` 에 한 번에 실을지, 아코디언 펼칠 때 `logs.listByProject` 로 lazy 조회할지. 작품·로그 수가 적은 MVP 규모상 한 번에 실어도 무방하나, plan 에서 확정.

### 5-3. IPC (계약 추가 — `contract.ts` / `registerHandlers.ts` / preload / `global.d.ts`)

기존 컨벤션(`projects.*`, `memos.*`) 따라 네임스페이스 추가:

```ts
logs: {
  list: () => Promise<LogCard[]>;                    // 기록 화면 카드 집계
  listByProject: (projectId: string) => Promise<ProjectLog[]>;  // 아코디언 lazy (선택)
};
sessions: {
  start: (projectId: string) => Promise<void>;
  end: (projectId: string) => Promise<void>;         // 자동 종료(메모 없음)
  endWithLog: (projectId: string, body: string) => Promise<void>; // 명시 종료 + 기록 메모
};
```

채널명은 `CHANNELS` 에 `logsList` / `logsListByProject` / `sessionsStart` / `sessionsEnd` / `sessionsEndWithLog` 추가.

---

## 6. 프론트엔드

### 6-1. 집필 화면 (`WriteStudioScreen` / `App.tsx`)

- **세션 자동 시작/종료 결선은 `App.tsx`** 레벨에서(현재 `activeProject` / `screen` 상태를 가진 곳). `screen === "write" && activeProject` 진입 effect 에서 `sessions.start`, 이탈/전환 cleanup 에서 `sessions.end`.
- **"작업 종료" 버튼** — 집필 화면(보기 메뉴 또는 Titlebar 근처, 구현 시 기존 패턴 정합)에 추가. 클릭 → 기록 메모 모달(textarea + 저장/취소). 저장 시 `sessions.endWithLog(projectId, body)` 후 작품 화면 또는 빈 상태로 안내(세션 종료 의미 반영).
- 모달 형태는 기존 캡처 모달(`Phase 5 빠른 메모`)/설정 패널 패턴 재사용.

### 6-2. 기록 화면 (`LogScreen` — placeholder 제거, 읽기 전용)

작품 카드 리스트. 각 카드:
```
┌──────────────────────────────────────────────┐
│ 작품 제목                                      │
│ ▓▓▓▓▓▓░░░░ 62%  (목표 12,000자)                │ ← target_length 없으면 "목표 미설정"
│ 최근 수정 · 06-07   ·   총 작업 4시간 12분      │ ← updated_at + Σ세션
│ "…이야기가 시작되려는 참이었다"                │ ← lastSentence
│ 📝 마지막 기록: 3장 도입부 톤 고민        [▼]  │ ← 최신 1줄 + 아코디언 토글
├──────────────────────────────────────────────┤
│ [▼ 펼침] 누적 기록 메모 전체 (created_at DESC) │
│   · 06-07 14:20  3장 도입부 톤 고민            │
│   · 06-05 23:10  2장 마무리, 시점 흔들림 점검  │
└──────────────────────────────────────────────┘
```
- **아코디언**: 카드의 [▼] 토글 시 그 작품의 누적 기록 메모 전체를 시간순으로 펼침. 기본은 최신 1줄만.
- 진척%: `Math.round(wordCount / target_length * 100)`. 목표 미설정(`target_length === null`)은 % 대신 "목표 미설정". (100% 초과 표시 정책은 plan 에서 — 실제 수치 노출 권장.)
- 총 작업 시간: `totalDurationMs` → "N시간 M분" 포맷(0이면 "기록 없음" 등).
- 작품 없으면 기존 빈 상태 유지. 우측 더미 통계 패널(누적/세션 ghost 카드) 제거.

### 6-3. 표시값 출처 명시 (rule §9 정합)

| 표시 요소 | 출처 | 분류 |
|---|---|---|
| 작품 제목 | `projects.title` | 저장 입력 |
| 진척 % | `documents.word_count` / `projects.target_length` | 파생 |
| 최근 수정일 | `projects.updated_at` | 저장(자동 touch) |
| 마지막 문장 | `documents.plain_text` → `lastSentence()` | 파생 |
| 기록 메모 | `project_logs.body` | 저장 입력(집필 종료 모달) |
| 총 작업 시간 | `Σ work_sessions(ended−started)` | 파생 |

---

## 7. 테스트 / 검증 (TDD HARD-GATE)

- `projectLogRepository.test.ts` — create / listByProject 정렬 / latest / CASCADE(작품 삭제 시 로그 삭제)
- `workSessionRepository.test.ts` — start(열린 세션 1개 보장) / endOpen / 30초 미만 폐기 / closeDangling / totalDurationMs 합 / CASCADE
- `store.test.ts` — `listLogCards` 집계 정확성 / `endSessionWithLog` 트랜잭션(원자성)
- IPC 핸들러 테스트 — `logs.*` / `sessions.*` 결선
- `LogScreen.test.tsx` — 카드 렌더(진척%/목표 미설정 분기/총 작업 시간 포맷/마지막 문장) + 아코디언 토글
- 세션 생명주기 — `App` 레벨 자동 시작/종료(화면 전환·작품 전환 시 end 호출) 행위 검증
- 진척% 파생 lib 단위 테스트 (목표 null / 0 / 초과 경계)
- 검증 명령: `node_modules/.bin/{vitest,tsc,vite}` (Node 24 PATH 선행 — `PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH"`), build GREEN
- dogfooding: 집필 진입→종료 시간 정확성 / 종료 모달 기록 메모 / 아코디언 / 진척% / CASCADE / dangling 정리 / 짧은 세션 폐기

---

## 8. 비범위 (out of scope)

- 시간축 통계(이번 주/이번 달 글자수, 세션 횟수 그래프) — placeholder 가 그렸던 영역, 본 작업 제외
- 본문 스냅샷/버전 추적(진짜 "직전 대비 추가분") — #4 는 마지막 문장 근사로 대체
- 무입력 idle 캡(자리 비움 과대계산 방지) — 미적용 가드
- 기록 메모 편집/삭제 — 본 작업은 추가·조회만(편집/삭제는 후속 검토)

---

## 9. 열린 결정 (speckit-plan 에서 확정)

1. 누적 로그를 `listLogCards` 에 일괄 적재 vs 아코디언 펼칠 때 lazy 조회
2. 진척 100% 초과 표시 정책(실수치 vs 100% 캡)
3. "작업 종료" 버튼 위치(보기 메뉴 / Titlebar / 본문 하단) — 기존 UI 패턴 정합 우선
4. 자동 종료 시 작품 전환과 화면 전환을 모두 `App` effect cleanup 하나로 잡을지, 개별 핸들러로 잡을지
