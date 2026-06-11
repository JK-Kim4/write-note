# Data Model: Round 1 스키마 확장 기능

**Date**: 2026-06-11 · **Spec**: [spec.md](./spec.md) · **Research**: [research.md](./research.md)

## 1. Memo — soft-delete 속성 추가 (US1)

기존 `memos` 테이블(V6)에 컬럼 1개 추가. 엔티티 `Memo.kt`.

| 필드 | 타입 | 제약 | 의미 |
|---|---|---|---|
| `deleted_at` (신규) | TIMESTAMPTZ | NULL 허용, default NULL | 버려진 시각. NULL = 정상 노출, 값 있음 = 모든 목록 표면에서 숨김. 복원 = NULL 로 되돌림 |

**마이그레이션 V9** (`V9__add_memos_deleted_at.sql`):

```sql
ALTER TABLE memos ADD COLUMN deleted_at TIMESTAMPTZ;
-- 목록 쿼리 전부가 user_id + deleted_at IS NULL 을 거친다 — 부분 인덱스로 정상행만 커버
CREATE INDEX idx_memos_user_active ON memos (user_id) WHERE deleted_at IS NULL;
```

**상태 전이**:

```
[정상] --DELETE /api/memos/{id}--> [버려짐 (deleted_at=now())]
[버려짐] --POST /api/memos/{id}/restore--> [정상 (deleted_at=NULL)]
[버려짐] --DELETE (재호출)--> [버려짐] (no-op 멱등)
[정상] --restore (재호출)--> [정상] (no-op 멱등)
```

**불변식**:
- 버려진 메모는 연결행(`memo_projects`, `memo_project_characters`)을 **그대로 보존**한다 — 복원 시 작품 연결·고정 상태 자동 복귀
- 버려진 메모는 목록 7개 표면(research D1 표)에서 제외, 단건 조회·수정·큐레이션·고정은 404
- "작품당 고정 1개" 불변식은 deleted 포함 행 기준으로 동작(research D10) — 추가 처리 불요

## 2. UserSetting — 신규 엔티티 (US2)

사용자별 환경설정 key-value. 신규 테이블 + 엔티티 `UserSetting.kt`.

| 필드 | 타입 | 제약 | 의미 |
|---|---|---|---|
| `user_id` | BIGINT | NOT NULL, FK → users(id) ON DELETE CASCADE, 복합 PK 1 | 설정 소유 사용자 |
| `key` | VARCHAR(64) | NOT NULL, 복합 PK 2 | 설정 항목 식별자 (`theme` 등) |
| `value` | VARCHAR(255) | NOT NULL | 설정값 (문자열 직렬화) |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT CURRENT_TIMESTAMP | 마지막 갱신 시각 (per-key LWW 근거) |

**마이그레이션 V10** (`V10__create_user_settings.sql`):

```sql
CREATE TABLE user_settings (
    user_id BIGINT NOT NULL,
    key VARCHAR(64) NOT NULL,
    value VARCHAR(255) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, key),
    CONSTRAINT fk_user_settings_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE
);
```

**허용 key + 값 검증 (서버 allowlist — research D3)**:

| key | 허용 value | 대응 FE preference |
|---|---|---|
| `theme` | `light` \| `dark` \| `system` | `preferences.theme` |
| `writingMode` | `manuscript` \| `editor` | `preferences.writingMode` |
| `manuscriptSize` | `200` \| `400` \| `1000` | `preferences.manuscriptSize` (문자열 직렬화) |

허용 외 key/value → 400 (검증 실패). Round 2 용지 크기 = 이 표에 행 추가만(마이그레이션 0 — FR-010).

## 3. Character — 필드 3개 확장 (US3)

기존 `characters` 테이블(V5)에 컬럼 3개 추가. 엔티티 `Character.kt`, DTO `Create/UpdateCharacterRequest`, `CharacterResponse` 동반 확장.

| 필드 | 타입 | 제약 | 의미 |
|---|---|---|---|
| `age` (신규) | VARCHAR(80) | NULL 허용 | 나이 — 자유 텍스트("17세 가량", "불명", "수백 살") |
| `gender` (신규) | VARCHAR(16) | NULL 허용, CHECK (gender IN ('MALE','FEMALE','OTHER')) | 성별 코드. NULL = 비움(미설정). FE 표시: 남/여/기타/비움 |
| `traits` (신규) | TEXT | NULL 허용, CHECK (length(traits) <= 10000) | 특징 — 자유 텍스트 (기존 notes 와 동일 한도) |

**마이그레이션 V11** (`V11__expand_characters_age_gender_traits.sql`):

```sql
ALTER TABLE characters
    ADD COLUMN age VARCHAR(80),
    ADD COLUMN gender VARCHAR(16) CHECK (gender IN ('MALE', 'FEMALE', 'OTHER')),
    ADD COLUMN traits TEXT CHECK (traits IS NULL OR length(traits) <= 10000);
```

**기존 데이터 영향**: 3컬럼 모두 NULL 허용 + default 없음 → 기존 행 무변경(FR-013). 기존 필드(name·short_description·notes·display_order)는 그대로.

**역할 분리(혼동 방지)**: "소개" = 기존 `short_description`(한 줄 설명) 이 계속 담당 — 신설 없음(사용자 확정). `traits` 는 외형·말버릇·성향 등 특징 서술, `notes` 는 그 외 자유 노트.

## 4. 관계도 (변경 부분만)

```
users 1 ──── * user_settings (신규, ON DELETE CASCADE)

memos (deleted_at 추가)
  │ 1
  │
  * memo_projects ──── 보존: memo soft-delete 시에도 행 유지
       │ *                   (복원 시 연결·pinned 복귀)
       │
projects 1 ──── * characters (age·gender·traits 추가)
```
