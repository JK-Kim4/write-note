---
description: "Task list — 작품 본문 사용자별 봉투 암호화"
---

# Tasks: 작품 본문 사용자별 봉투 암호화 (Document Body At-Rest Encryption)

**Input**: Design documents from `specs/034-document-body-encryption/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: 포함(프로젝트 CLAUDE.md TDD HARD-GATE §5 — Red→Green→Refactor). 암호 연산은 인프로세스라 mock 금지, 외부 경계인 디스코드 웹훅 HTTP만 mock(§5-2).

**Organization**: 사용자 스토리(US1 P1 / US2 P2 / US3 P3)별 phase. US1 = MVP(투명 암호화 왕복).

**경로 규약**: 백엔드 단일 모듈. main=`backend/src/main/kotlin/com/writenote/`, test=`backend/src/test/kotlin/com/writenote/`, resources=`backend/src/main/resources/`. 프론트 변경 0.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 환경 설정 키 + 로컬/테스트 KEK 공급

- [ ] T001 [P] `application.yml`에 `app.crypto.master-key: ${BODY_ENCRYPTION_KEY:}` + `app.alerts.discord-webhook-url: ${DISCORD_ALERT_WEBHOOK_URL:}` 추가 in `backend/src/main/resources/application.yml`
- [ ] T002 [P] 로컬 dev 프로파일과 테스트 리소스에 **dev/test 전용 고정 KEK**(Base64 32B, 비밀 아님) 제공 in `backend/src/main/resources/application-local.yml` 및 `backend/src/test/resources/application.yml`(또는 테스트 프로파일)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 키 인프라 + 순수 암호 + 파사드. 모든 스토리의 선행. **⚠️ 완료 전 US 작업 불가.**

- [ ] T003 V22 마이그레이션 작성(테이블 `user_encryption_keys`: user_id PK FK ON DELETE CASCADE, wrapped_dek BYTEA, key_version INT DEFAULT 1, created_at) in `backend/src/main/resources/db/migration/V22__create_user_encryption_keys.sql` (data-model.md 정합. **로컬/운영 DB 적용은 사용자 컨펌** — external-infra-safety)
- [ ] T004 [P] `UserEncryptionKey` 엔티티(@Id user_id, wrappedDek ByteArray, keyVersion, createdAt) in `backend/src/main/kotlin/com/writenote/entity/UserEncryptionKey.kt`
- [ ] T005 [P] `UserEncryptionKeyRepository`(JpaRepository<UserEncryptionKey, Long>) in `backend/src/main/kotlin/com/writenote/repository/UserEncryptionKeyRepository.kt`
- [ ] T006 [P] `CryptoConfig` — `@Value("\${app.crypto.master-key:}")` Base64 32B → AES `SecretKey` 빈, 미설정/길이오류 시 fail-fast in `backend/src/main/kotlin/com/writenote/config/CryptoConfig.kt`
- [ ] T007 [P] `BodyDecryptionException`(fail-closed 표현용) in `backend/src/main/kotlin/com/writenote/error/BodyDecryptionException.kt`
- [ ] T008 [P] **(테스트 선작성)** `AesGcmCipherTest` — seal/open 왕복 무손실 · IV 무작위성(연속 seal 상이) · 1바이트 변조→실패 · 오키→실패 · 레거시 평문(`type=doc`) 통과 · wrap↔unwrap 동일키 in `backend/src/test/kotlin/com/writenote/crypto/AesGcmCipherTest.kt`
- [ ] T009 `AesGcmCipher`(순수: AES-256-GCM seal/openOrPassthrough + 봉투 JSON 직렬화/판별 + wrap/unwrap, 실패→BodyDecryptionException) — T008 GREEN in `backend/src/main/kotlin/com/writenote/crypto/AesGcmCipher.kt` (contracts/body-envelope.md, internal-cipher-contract.md 정합)
- [ ] T010 [P] **(테스트 선작성)** `UserKeyServiceTest`(Testcontainers) — create 시 행 생성 · getOrCreate 지연생성 · 두 사용자 DEK 격리(한 키로 타 봉투 복호 실패) · wrap→unwrap 동일 DEK in `backend/src/test/kotlin/com/writenote/crypto/UserKeyServiceTest.kt`
- [ ] T011 `UserKeyService`(create/getOrCreate + KEK wrap/unwrap + bounded in-memory DEK 캐시) — T010 GREEN, depends T004·T005·T006·T009 in `backend/src/main/kotlin/com/writenote/crypto/UserKeyService.kt`
- [ ] T012 [P] **(테스트 선작성)** `BodyCipherServiceTest` — encrypt→decryptToPlain 평문 일치 · 레거시 평문 통과 · 복호 실패 시 BodyDecryptionException in `backend/src/test/kotlin/com/writenote/crypto/BodyCipherServiceTest.kt`
- [ ] T013 `BodyCipherService`(encrypt(userId,plain)/decryptToPlain(userId,stored) 파사드) — T012 GREEN, depends T009·T011·T007 in `backend/src/main/kotlin/com/writenote/crypto/BodyCipherService.kt`
- [ ] T014 [P] **(테스트 선작성)** 가입 시 DEK 생성 IT — 이메일 가입 + Kakao 신규 가입 후 `user_encryption_keys` 행 존재 검증 in `backend/src/test/kotlin/com/writenote/service/SignupKeyProvisioningIT.kt`
- [ ] T015 `AuthService.signupEmail`의 `userRepository.save(...)`(L66) 직후 `userKeyService.create(userId)` 결선(동일 트랜잭션) — T014 일부 GREEN in `backend/src/main/kotlin/com/writenote/service/AuthService.kt`
- [ ] T016 `KakaoOAuth2UserService.insertNewKakaoUser`(L99) 신규 사용자 저장 직후 DEK 생성 결선 — T014 GREEN in `backend/src/main/kotlin/com/writenote/auth/KakaoOAuth2UserService.kt`

**Checkpoint**: 키·암호 인프라 GREEN → 스토리 진입 가능.

---

## Phase 3: User Story 1 - 투명한 본문 암호화 (작가 경험 무변화) (Priority: P1) 🎯 MVP

**Goal**: 본문이 DB에 암호문으로만 저장되고, 저장/로드/글자수/충돌/카드 미리보기는 작가가 체감 못 하게 동일 동작.

**Independent Test**: 본문 작성·저장 후 (a) 재로드 원문 일치 + 글자수 정상, (b) `documents.body` 직접 조회 시 원문 미노출(봉투), (c) 추가 지연 무체감.

### Tests for User Story 1 ⚠️ (먼저 작성, FAIL 확인)

- [ ] T017 [P] [US1] IT `DocumentEncryptionIT` — 저장→`documents.body`가 원문 부분문자열 미포함(암호문)→로드 평문 일치(왕복 무손실) + 암호화 저장 후 word_count 정확 + 빈/대형 본문 왕복 in `backend/src/test/kotlin/com/writenote/service/DocumentEncryptionIT.kt`
- [ ] T018 [P] [US1] IT 저장 충돌(version 불일치) 시 409 + `currentBody`가 **복호된 평문**임을 검증 in `backend/src/test/kotlin/com/writenote/service/DocumentConflictDecryptIT.kt`
- [ ] T019 [P] [US1] IT 최신 챕터가 암호문일 때 `ProjectService.listCards`의 `lastSentenceSource` 미리보기 정상(복호) in `backend/src/test/kotlin/com/writenote/service/ProjectCardEncryptionIT.kt`

### Implementation for User Story 1

- [ ] T020 [US1] `DocumentService.performSave` 시그니처에 `userId` 추가 + `document.body = bodyCipher.encrypt(userId, request.body)` 저장 + 충돌 `currentBody = bodyCipher.decryptToPlain(userId, document.body)` + 응답 `body`는 평문 `request.body` 반환 in `backend/src/main/kotlin/com/writenote/service/DocumentService.kt` (T017·T018 GREEN)
- [ ] T021 [US1] `DocumentService.toResponse`에서 `body = bodyCipher.decryptToPlain(userId, body)` 복호(getDocumentByProjectId/getDocumentById가 userId 전달) in `backend/src/main/kotlin/com/writenote/service/DocumentService.kt` (T017 GREEN; T020과 같은 파일 → 순차)
- [ ] T022 [US1] `ProjectService.listCards` L120 `extractPlainText(bodyCipher.decryptToPlain(userId, it.body))`로 복호 후 추출(레거시 통과) in `backend/src/main/kotlin/com/writenote/service/ProjectService.kt` (T019 GREEN)

**Checkpoint**: US1 독립 동작 — 본문 암호문 저장 + 정상 왕복 + 카드/충돌 무회귀. **첫 dogfooding 게이트**(quickstart 1~5,7).

---

## Phase 4: User Story 2 - DB 유출 시 본문 복호 불가 (Priority: P2)

**Goal**: 마스터 키 없이 DB만으론 복호 불가(키 격리) + 변조/실패는 fail-closed로 차단하고 디스코드로 운영자 알림.

**Independent Test**: 한 사용자 DEK로 타 사용자 봉투 복호 실패 / 봉투 변조 행 로드 시 500 DOCUMENT_DECRYPTION_FAILED + 평문 미노출 + 디스코드 알림.

### Tests for User Story 2 ⚠️ (먼저 작성, FAIL 확인)

- [ ] T023 [P] [US2] IT 두 사용자 본문 키 격리 — A 작품 봉투를 B의 DEK로 복호 시도 실패(평문 미노출) in `backend/src/test/kotlin/com/writenote/service/KeyIsolationIT.kt`
- [ ] T024 [P] [US2] IT 저장된 봉투 1바이트 변조 후 로드 → `DOCUMENT_DECRYPTION_FAILED`(500), 응답에 평문 없음 in `backend/src/test/kotlin/com/writenote/service/DecryptionFailClosedIT.kt`
- [ ] T025 [P] [US2] Unit `DecryptionFailureNotifierTest`(웹훅 HTTP mock) — 실패 시 notify 호출 · 웹훅 예외 swallow(요청 미전파) · 페이로드에 평문·키 미포함 · URL 미설정 시 skip in `backend/src/test/kotlin/com/writenote/crypto/DecryptionFailureNotifierTest.kt`

### Implementation for User Story 2

- [ ] T026 [P] [US2] `DOCUMENT_DECRYPTION_FAILED` 에러코드 추가(기존 에러코드 정의 위치 grep 후 정합 삽입) in `backend/src/main/kotlin/com/writenote/error/` (해당 ErrorCode 파일)
- [ ] T027 [US2] `GlobalExceptionHandler`에 `BodyDecryptionException` → 500 `DOCUMENT_DECRYPTION_FAILED` 매핑 in `backend/src/main/kotlin/com/writenote/error/GlobalExceptionHandler.kt` (T024 GREEN)
- [ ] T028 [P] [US2] `DecryptionFailureNotifier`(@Async, log.error(평문·키 미포함) + Discord Incoming Webhook POST `{"content":...}`, 전구간 try/catch swallow, 짧은 타임아웃, URL 미설정 skip) in `backend/src/main/kotlin/com/writenote/crypto/DecryptionFailureNotifier.kt` (T025 GREEN)
- [ ] T029 [US2] `@EnableAsync` + 전용 executor 설정 in `backend/src/main/kotlin/com/writenote/config/AsyncConfig.kt`
- [ ] T030 [US2] `BodyCipherService.decryptToPlain` 실패 경로에서 throw 직전 `notifier.notify(userId, documentId?, reason)` 결선 in `backend/src/main/kotlin/com/writenote/crypto/BodyCipherService.kt` (T024·T025 GREEN)

**Checkpoint**: US1+US2 동작 — DB 유출 무력화 + fail-closed + 알림.

---

## Phase 5: User Story 3 - 기존 평문 본문 무중단 전환 (Priority: P3)

**Goal**: 배포 전 평문 본문이 깨지지 않고 로드되며, 다음 저장 시 암호문으로 전환. 일괄 변환 강제 없음.

**Independent Test**: 평문 레거시 행 사전삽입 → 로드 정상 → 저장 후 DB가 암호문 → 일괄 변환 작업 부재.

### Tests for User Story 3 ⚠️ (먼저 작성, FAIL 확인)

- [ ] T031 [P] [US3] IT `LegacyBodyMigrationIT` — 평문 `{"type":"doc",...}` 행 사전삽입 → 로드 평문 정상(복호 에러 없음) → 저장 후 `documents.body`가 봉투(암호문)로 전환 in `backend/src/test/kotlin/com/writenote/service/LegacyBodyMigrationIT.kt`
- [ ] T032 [P] [US3] IT 레거시 평문 최신 챕터로 `listCards` 미리보기 정상 in `backend/src/test/kotlin/com/writenote/service/LegacyCardPreviewIT.kt`

### Implementation for User Story 3

- [ ] T033 [US3] 레거시 판별/통과 경로(T009·T013) 회귀 확인 + 저장 시 전환을 막지 않음을 보장(필요 시 보강) in `backend/src/main/kotlin/com/writenote/crypto/BodyCipherService.kt` (T031·T032 GREEN. 구현은 대개 foundational 재사용 — 본 태스크는 검증·보강)

**Checkpoint**: 전 스토리 독립 동작 + 레거시 무중단.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T034 [P] 성능 테스트 — 대표 본문(예: 50KB) encrypt+decrypt 왕복이 임계(<5ms) 하임을 단일 측정 + 왕복 정확성(SC-001 근거; 운영 p95는 관찰) in `backend/src/test/kotlin/com/writenote/crypto/BodyCipherPerformanceTest.kt`
- [ ] T035 내보내기(DOCX/HWPX) 회귀 점검 — 서버가 본문 평문을 쓰지 않음 재확인(기존 Export 테스트 GREEN 유지) (`backend/.../service/DocxExportService.kt`·`HwpxExportService.kt` 무변경 확인)
- [ ] T036 전체 게이트 실행 — `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build` (포어그라운드, 결과 직접 확인 — CLAUDE.md 작업 실행 지침)
- [ ] T037 [P] quickstart.md dogfooding 8케이스 수행(인증 화면 — 로컬/운영, 한글 본문 1문단 이상 포함). §19 인증 검증 한계 인지 in `specs/034-document-body-encryption/quickstart.md`
- [ ] T038 [P] (선택·후속) 기존 평문 전수 백필 운영 작업 설계 — MVP 제외. 필요 시 별도 트랜잭션으로 분리 기록

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup(P1)**: 의존 없음.
- **Foundational(P2)**: Setup 후. **모든 US 차단**.
- **US1(P3)**: Foundational 후. MVP.
- **US2(P4)**: Foundational 후. US1과 독립 테스트 가능(BodyCipherService 실패 경로 결선 시 US1 happy-path 무영향).
- **US3(P5)**: Foundational 후. 구현 대부분 foundational 재사용 → 검증 중심.
- **Polish(P6)**: 원하는 US 완료 후.

### 핵심 의존 간선

- T009 ← T008 / T011 ← {T004,T005,T006,T009,T010} / T013 ← {T007,T009,T011,T012}
- T015·T016 ← T011 (DEK 생성) / T014는 T015·T016 전 작성(FAIL)
- US1: T020·T021(같은 파일 DocumentService → 순차) ← T013; T022 ← T013
- US2: T027 ← T026; T030 ← T028; 모두 ← BodyDecryptionException(T007)
- US3: T031·T032 ← US1 완료(저장 암호화·로드 복호 경로)

### Within Each Story (TDD)

- 테스트 먼저 작성 → FAIL 확인 → 구현으로 GREEN. 모델→서비스→결선 순. 리팩터는 GREEN 상태에서만.

### Parallel Opportunities

- Setup: T001·T002 병렬.
- Foundational: T004·T005·T006·T007 병렬, 테스트 T008·T010·T012·T014 병렬 작성.
- US1 테스트 T017·T018·T019 병렬(서로 다른 파일). 단 T020·T021은 같은 `DocumentService.kt` → 순차.
- US2 테스트 T023·T024·T025 병렬. 구현 T026·T028 병렬(다른 파일).

---

## Parallel Example: Foundational

```bash
# 엔티티/설정/예외 동시 작성
Task: "UserEncryptionKey entity in entity/UserEncryptionKey.kt"        # T004
Task: "UserEncryptionKeyRepository in repository/...Repository.kt"      # T005
Task: "CryptoConfig KEK bean in config/CryptoConfig.kt"                 # T006
Task: "BodyDecryptionException in error/BodyDecryptionException.kt"     # T007
# 순수 암호 테스트 선작성
Task: "AesGcmCipherTest in test/crypto/AesGcmCipherTest.kt"             # T008
```

---

## Implementation Strategy

### MVP First (US1)

1. Setup(T001–T002) → Foundational(T003–T016, 게이트 GREEN) → US1(T017–T022).
2. **STOP & VALIDATE**: quickstart dogfooding 1~5,7(본문 암호문 저장·왕복·카드·충돌·빈/대형). 본문이 DB에 암호문으로 남는 핵심 가치 달성.
3. 배포 가능(BE 단독, `BODY_ENCRYPTION_KEY` 전제).

### Incremental Delivery

1. Foundational → US1(MVP, 암호화+왕복) → US2(유출무력화+fail-closed+알림) → US3(레거시 무중단) → Polish(성능·게이트).
2. 각 스토리 독립 검증 후 다음 진입(§10 핵심 우선 — 첫 dogfoodable=US1이 본문 암호화를 직접 증명).

---

## Notes

- [P] = 다른 파일·의존 없음. 같은 파일(DocumentService) 결선은 순차.
- 암호 연산 mock 금지(인프로세스), 디스코드 웹훅만 경계 mock(§5-2).
- ktlintFormat은 **main+test 양쪽** 적용(rules: lint 정합).
- V22 로컬/운영 DB 적용 = **사용자 컨펌**(external-infra-safety). 빌드/테스트는 포어그라운드.
- KEK 분실=데이터 손실 → quickstart §2 운영 수칙 준수. 커밋은 작업 그룹 단위.
