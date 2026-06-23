# Data Model: 작품 본문 봉투 암호화 (Phase 1)

## 신규 엔티티: UserEncryptionKey (`user_encryption_keys`)

사용자별 데이터 암호화 키(DEK)를 마스터 키(KEK)로 감싼 형태로 보관. 사용자당 1행.

| 필드 (Kotlin) | 컬럼 | 타입 | 제약 | 의미 |
|---|---|---|---|---|
| `userId` | `user_id` | BIGINT | **PK**, FK→`users(id)` ON DELETE CASCADE | 소유 사용자(= PK, 1:1) |
| `wrappedDek` | `wrapped_dek` | BYTEA | NOT NULL | KEK 로 AES-256-GCM wrap 된 DEK (`iv(12)‖ct(32)‖tag(16)`=60B). 평문 DEK 미저장 |
| `keyVersion` | `key_version` | INTEGER | NOT NULL DEFAULT 1 | KEK 버전(회전 구조 지원, FR-013). 본 범위 항상 1 |
| `createdAt` | `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | 생성 시각 |

- **수명주기**: 가입 시 생성(D5) / 기존 사용자는 첫 본문 저장 시 지연 생성 / 사용자 삭제 시 CASCADE 제거.
- **불변식**: DEK 평문은 DB·로그·디스크에 절대 미기록(메모리 캐시만). `wrapped_dek` 은 KEK 없이 복원 불가.
- **회전(범위 밖)**: `key_version` 만 보유, 다중 KEK 운용·재-wrap 흐름은 후속.

### V22 마이그레이션 (초안)

```sql
-- V22__create_user_encryption_keys.sql
CREATE TABLE user_encryption_keys (
    user_id     BIGINT      PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    wrapped_dek BYTEA       NOT NULL,
    key_version INTEGER     NOT NULL DEFAULT 1,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

> `documents` 테이블은 **변경 없음**(봉투를 기존 JSONB `body` 컬럼에 저장). 인덱스 추가 없음.

## 변경 없는 기존 엔티티

- **Document (`documents`)**: 스키마 무변경. `body`(JSONB, `@JdbcTypeCode(SqlTypes.JSON) var body: String`)의 **내용 의미만** 확장 — "평문 ProseMirror JSON" → "평문(레거시) 또는 암호문 봉투". `word_count` 는 평문 파싱으로 계속 산출(저장 시 평문 보유).
- **User (`users`)**: 무변경. `users.id` 가 `user_encryption_keys` PK/FK.

## 값 객체: 본문 봉투 (Encrypted Body Envelope)

`documents.body` 에 저장되는 두 형태:

| 형태 | 판별 | 예 |
|---|---|---|
| 레거시 평문 | 최상위 `"type":"doc"` | `{"type":"doc","content":[...]}` |
| 암호문 봉투(v1) | `"type":"doc"` 아님 + `"v"`·`"iv"` 보유 | `{"v":1,"alg":"A256GCM","iv":"<b64u>","ct":"<b64u ct‖tag>"}` |

- `iv`: 12B 랜덤(매 암호화 신규), base64url.
- `ct`: AES-256-GCM 출력(ciphertext‖tag), base64url. 평문 = ProseMirror JSON UTF-8 바이트.
- 상세 스키마·판별 의사코드 = [contracts/body-envelope.md](./contracts/body-envelope.md).

## 상태 전이 (본문 1건)

```
[레거시 평문]  --(작가 저장)-->  [암호문 봉투 v1]  --(작가 저장)-->  [암호문 봉투 v1]
     |                                  |
   (로드: 그대로)                  (로드: KEK+DEK 복호 → 평문)
     |                                  |
  복호 불필요                    복호 실패 시 → DOCUMENT_DECRYPTION_FAILED(500) + 알림
```

- 신규 작품의 초기 빈 본문(`EMPTY_DOC_JSON`)은 레거시 평문으로 생성 → 첫 저장 시 암호문 전환(별도 처리 불필요).

## 검증 규칙 (FR 매핑)

- FR-001/002/004: 저장 후 `documents.body` 는 봉투(원문 부분문자열 미포함), DEK 는 `wrapped_dek` 에만.
- FR-007: `word_count` = 기존 `countTextChars(평문)` 불변.
- FR-009/014: 복호 실패 → 예외 + 알림(평문/키 미포함).
- FR-010/011: 레거시 평문 로드 정상, 저장 시 전환, 일괄 변환 강제 없음.
