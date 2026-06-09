# Data Model — 자동저장 재설계

## 1. Document (백엔드 엔티티 — 변경)

`documents` 테이블. 본 작업의 변경은 **버전 표현**에 집중된다.

| 필드 | 타입 | 변경 | 설명 |
|---|---|---|---|
| `id` | Long | 유지 | PK |
| `projectId` | Long | 유지 | 작품 1:1 (unique) |
| `title` | String(120) | 유지 | 제목 |
| `body` | String(jsonb) | 유지 | ProseMirror/TipTap JSON |
| `wordCount` | Int | 유지 | 공백 제외 글자 수(서버 계산) |
| ~~`version`~~ | ~~Int~~ | **제거** | 정수 낙관적 잠금 컬럼 폐기 |
| `createdAt` | Instant | 유지 | 생성 시각(`@PrePersist`) |
| `updatedAt` | Instant | **`@Version` 부여** | 수정 시각 = 낙관적 잠금 토큰 겸용 |

### 변경 규칙

- `@Version var updatedAt: Instant` — Hibernate 가 flush 시 자동으로 현재 시각 set. **수동 set 금지**(`@PreUpdate` 의 `updatedAt = Instant.now()` 제거).
- `@PrePersist` 의 `createdAt` 초기화는 유지. `updatedAt` 초기값은 persist 시 Hibernate 위임.
- 낙관적 잠금: 저장 요청의 `version`(Instant)이 현재 `document.updatedAt` 과 **불일치하면 충돌(409)**. 일치 시 body·wordCount 갱신 + flush → 새 `updatedAt` 확정.

### 상태 전이 (저장)

```
요청 도착 → body JSON 유효성 검사 ─실패→ 400 VALIDATION_FAILED
                 │성공
                 ▼
   request.version == document.updatedAt ?
       │아니오→ 409 DOCUMENT_VERSION_CONFLICT { currentVersion: updatedAt, currentBody: body }
       │예
       ▼
   body·wordCount 갱신 → flush(@Version 가 updatedAt 재set) → 200 { version: 새 updatedAt, ... }
```

## 2. Draft (프론트 localStorage — 신규)

작품별 미동기화 작성 보존분. 키: `wn:draft:doc:{documentId}`.

| 필드 | 타입 | 설명 |
|---|---|---|
| `documentId` | number | 대상 문서 id |
| `projectId` | number | 대상 작품 id |
| `body` | string | TipTap/ProseMirror JSON 직렬화(작가 최신 입력) |
| `baseVersion` | string | 이 draft 가 출발한 서버 version(ISO8601 토큰, 불투명) |
| `dirty` | boolean | 미동기화 변경 존재 여부 |
| `updatedAt` | number | draft 기록 시각(epoch ms, 표시·정리용) |

### 불변식 / 규칙

- 타자마다 `body` 갱신 + `dirty: true` + `baseVersion` = 현재 세션 소유 version.
- 동기화 성공 시 `dirty: false` 로 마크(즉시 삭제하지 않음). **다음 진입 시** `dirty:false` draft 정리.
- 손상된 JSON·읽기 실패는 draft 없음으로 간주(서버 본문으로 진행).
- localStorage 불가(비활성·용량 초과) 시 draft 쓰기 실패를 삼키고 서버 저장 경로는 정상 동작(작성 차단 금지).

## 3. 편집 세션 메모리 상태 (`useDocumentSession` 내부)

| 상태 | 타입 | 설명 |
|---|---|---|
| `body` | string | 현재 에디터 본문 |
| `version` | string | **세션이 단독 소유**하는 버전 토큰(저장 응답으로만 갱신) |
| `syncStatus` | `'idle'\|'syncing'\|'synced'\|'error'\|'conflict'` | 저장 표시 상태 |
| `conflict` | `{ currentVersion: string, currentBody: string } \| null` | 409 충돌 데이터 |
| `recoverable` | `{ body: string } \| null` | 복구 배너 노출용(진입 시 dirty draft + version 일치) |

### 진입 분기 (작품 열 때)

```
서버 GET 1회 → draft 조회
  ├ draft.dirty && draft.baseVersion === 서버.version → recoverable 설정(복구 배너)
  ├ draft.dirty && draft.baseVersion !== 서버.version → conflict 경로(ConflictDialog)
  └ draft 없음 | !dirty → 서버 본문 로드 + (이전 dirty:false draft) 정리
```

## 4. 엔티티 관계

- `Project (1) ──< (1) Document` — 기존 1:1 유지(변경 없음).
- `Document (1) ──< (0..1) Draft` — Draft 는 클라이언트 로컬 전용, 서버에 영속되지 않음. `baseVersion` 으로 특정 Document 버전 시점에 연결.
