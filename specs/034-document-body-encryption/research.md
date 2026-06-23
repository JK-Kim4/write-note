# Research: 작품 본문 봉투 암호화 — 설계 결정 (Phase 0)

spec/clarify 에서 확정된 사항을 구현 가능한 기술 결정으로 해소한다. 모든 NEEDS CLARIFICATION 없음(spec 확정 + 본 문서로 기술 선택 고정).

---

## D1. 본문 암호 알고리즘

- **Decision**: AES-256-GCM (`javax.crypto`, `"AES/GCM/NoPadding"`), 96-bit(12B) 랜덤 IV(매 암호화 `SecureRandom` 신규), 128-bit 인증 태그.
- **Rationale**: JDK 내장(외부 의존 0) · AES-NI 하드웨어 가속(수십 KB 수십 µs → SC-001 p95≤5ms 충분) · GCM = 인증 암호화로 변조 감지(fail-closed, FR-009) 무료 제공.
- **Alternatives**: AES-CBC+HMAC(수동 조합 위험·태그 별도) 기각 / ChaCha20-Poly1305(JDK 가능하나 AES-NI 환경서 이점 없음) 기각 / pgcrypto(DB 내 암호 → KEK가 DB측에 노출, 위협 모델 위배) 기각.

## D2. 키 계층 (KEK / DEK)

- **Decision**: 2단 봉투. **KEK**(AES-256) = 환경변수 `BODY_ENCRYPTION_KEY`(Base64 32B) 주입, `app.crypto.master-key`(`${BODY_ENCRYPTION_KEY:}`, JWT_SECRET 패턴 미러). **DEK**(AES-256) = 사용자별 `KeyGenerator("AES",256)`/`SecureRandom` 랜덤. DEK 는 KEK 로 AES-256-GCM wrap → `wrapped_dek` BYTEA 저장(평문 DEK 미저장, FR-004).
- **Rationale**: KEK 가 DB 밖 → DB 덤프만으론 DEK 복원 불가 → 본문 복호 불가(FR-003, US2). 사용자별 DEK → 키 격리(FR-002). 봉투 구조 → 후속 KEK 회전 시 DEK 재-wrap만(본문 재암호화 불필요).
- **wrapped_dek 바이트 레이아웃**: `iv(12) || ciphertext(32) || tag(16)` = 60B 단일 BYTEA(자기 기술적).
- **Alternatives**: KEK 직접 본문 암호화(사용자 격리 불가·회전 시 전수 재암호화) 기각 / RFC3394 AES-KeyWrap(GCM 으로 충분, 별도 모드 불필요) 기각 / 외부 KMS·Vault(솔로 운영 과잉, 인프라 추가) 기각.

## D3. 봉투 저장형 + 레거시 판별 (확정: 저장형 A)

- **Decision**: `documents.body`(JSONB, `@JdbcTypeCode(SqlTypes.JSON)`) 컬럼 타입 **무변경**. 암호문을 JSON 봉투로 저장:
  `{"v":1,"alg":"A256GCM","iv":"<base64url>","ct":"<base64url ciphertext||tag>"}`
- **레거시 판별 규칙**: 저장값을 파싱해 — 최상위 객체가 `"type":"doc"` 이면 **레거시 평문**(그대로 사용), 아니고 `"v"`+`"iv"` 보유면 **암호문 봉투**(복호). ProseMirror 문서 최상위는 항상 `{type:"doc",...}` 이고 `iv` 필드가 없으므로 충돌 없음.
- **Rationale**: 컬럼 타입 변경 0 → 마이그레이션 경량 + 레거시 평문과 한 컬럼 자연 공존(무중단 지연 전환, FR-010·011). JSONB 키 순서 정규화는 필드명 파싱이라 무관.
- **Alternatives**: BYTEA 전환(ALTER TYPE 무겁고 레거시 공존 별도) 기각.

## D4. DEK 캐시 (성능)

- **Decision**: `UserKeyService` 내부 bounded in-memory 캐시 `userId → DEK(SecretKey)`(예: 최대 N개, 접근 기준 만료). 캐시 미스만 `wrapped_dek` 1행 SELECT + KEK unwrap(µs).
- **Rationale**: 저장/로드마다 DB 키 조회 제거 → p95 여유 확보. 단일 인스턴스라 캐시 일관성 단순. 평문 DEK 는 메모리에만(운영자 신뢰 모델 내 허용, 디스크 미기록).
- **주의**: 캐시 없어도 정합(인덱스 PK 조회 1회 추가일 뿐)이라 캐시는 최적화. 회전(후속) 시 무효화 훅 여지.
- **Alternatives**: Caffeine 의존 추가(현 미사용, 단순 맵으로 충분) 보류 / 캐시 없음(매 요청 DB 조회) — 정합하나 p95 여유 축소로 캐시 채택.

## D5. DEK 생성 시점 (확정: 가입 시)

- **Decision**: `AuthService.signupEmail` + `KakaoOAuth2UserService.insertNewKakaoUser` 의 사용자 저장 직후 동일 트랜잭션에서 DEK 생성. 안전망으로 `performSave` 가 `getOrCreate(userId)` 호출(기존 사용자/누락 대비, FR-005).
- **Rationale**: 신규 사용자는 항상 DEK 보유 → 첫 저장 경로 단순. 기존 사용자는 지연 생성(배포 무중단).
- **실패 처리**: 가입 시 DEK 생성 실패(KEK 미설정 등) → 가입 트랜잭션 롤백(fail-fast). KEK 는 배포 전제(quickstart).

## D6. 복호 실패 처리 + 디스코드 알림 (확정: 알림까지)

- **Decision**: 복호 실패(키 부재/불일치, GCM 태그 불일치=변조) → `BodyDecryptionException` throw → `DOCUMENT_DECRYPTION_FAILED`(HTTP 500). 평문/빈값 대체 금지(fail-closed). 동시에 `DecryptionFailureNotifier` 가 ① `log.error`(평문·키 미포함, documentId/userId/사유만) ② 디스코드 Incoming Webhook POST(`{"content": "..."}`).
- **알림 비차단**: `@Async`(전용 executor) + 전 구간 try/catch swallow + 짧은 타임아웃. 웹훅 URL(`app.alerts.discord-webhook-url`, `${DISCORD_ALERT_WEBHOOK_URL:}`) 미설정/실패해도 요청 처리·예외 흐름 불변(FR-014, SC-007).
- **HTTP 클라이언트**: JDK `java.net.http.HttpClient`(의존 0) 또는 Spring `RestClient`. 외부 호출이라 트랜잭션 밖.
- **Rationale**: fail-closed 보안 + 운영자 즉시 인지. 알림이 본 기능 가용성을 해치면 안 되므로 best-effort 격리.
- **Alternatives**: 알림 동기 호출(요청 지연·실패 전파) 기각 / 이메일 알림(인프라 더 무거움) 후속.

## D7. 마이그레이션 (V22, 무중단)

- **Decision**: `V22__create_user_encryption_keys.sql` — `user_encryption_keys` 테이블만 생성. `documents` 무변경. **전수 백필 없음**(지연 전환, FR-011). 전수 백필은 선택적 후속 스크립트(R4).
- **적용**: Flyway 자동. 테스트=Testcontainers. **로컬/운영 적용은 사용자 컨펌**(external-infra-safety).

## D8. 성능 검증 방법

- **Decision**: (a) 단위 성능 테스트 — 대표 본문(예: 50KB) encrypt+decrypt 왕복이 임계(<5ms) 하임을 단일 측정 + 왕복 정확성. (b) 운영 p95 는 도입 전후 응답 관찰(자동 테스트로 p95 단정 불가 — CLAUDE.md §19 정합). 
- **Rationale**: 자동 테스트는 알고리즘 비용이 무시 가능함을 보이는 증거, 실제 p95 는 운영 관찰 게이트.

## D9. 테스트 경계 (Classist)

- **Decision**: 암호 연산(`AesGcmCipher`/`UserKeyService`/`BodyCipherService`)은 **인프로세스 → mock 금지**, 실제 키로 상태·반환 검증. 외부 시스템 경계인 **디스코드 웹훅 HTTP 만 mock**. KEK 는 테스트 전용 고정 키.
- **Rationale**: CLAUDE.md §5-2 — 내부 collaborator mock 금지, 외부 경계만.

---

## 미해결 → plan/구현으로 이관 (아키텍처 영향 경미)

- DEK 캐시 구현체 세부(맵 vs Caffeine, 만료 정책) — D4 범위 내 구현 선택.
- 봉투 base64 변형(url-safe vs 표준) — `body-envelope.md` 에서 고정.
- `ErrorCode` 추가 위치(기존 enum/sealed) — 구현 시 기존 패턴 grep 후 정합.
