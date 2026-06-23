# Implementation Plan: 작품 본문 사용자별 봉투 암호화 (Document Body At-Rest Encryption)

**Branch**: `034-document-body-encryption` | **Date**: 2026-06-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/034-document-body-encryption/spec.md`

## Summary

작품 본문(`documents.body`, ProseMirror JSON)을 데이터베이스에 **암호문으로** 저장한다. 사용자별 데이터 암호화 키(DEK)로 본문을 AES-256-GCM 암호화하고, DEK는 환경변수로 주입되는 마스터 키(KEK)로 감싸(wrap) DB에 보관한다. KEK가 DB 밖에 있으므로 DB 덤프만으로는 복호 불가(위협 모델 충족). 클라이언트 API 계약·글자수·충돌 감지는 불변이며, 암복호는 서버 내부 핫패스에만 끼운다. 레거시 평문은 봉투 버전 판별자로 함께 읽고 다음 저장 시 암호문으로 지연 전환한다. 복호 실패는 fail-closed + 서버 로그 + 디스코드 웹훅 알림(best-effort).

## Technical Context

**Language/Version**: Kotlin 2.2 on Java 24 toolchain (시스템 Corretto 25)

**Primary Dependencies**: Spring Boot 4.0.6 (Web, Security, Data JPA), Hibernate, **JDK `javax.crypto`(AES-GCM, 외부 암호 라이브러리 불필요)**, Flyway, Jackson(tools.jackson)

**Storage**: PostgreSQL (self-managed OCI). 신규 테이블 `user_encryption_keys`(V22). `documents.body`(JSONB) 컬럼은 타입 변경 없이 평문/암호문 봉투 공존.

**Testing**: JUnit 5 + AssertJ + MockK(단위), Spring Boot Test + Testcontainers(통합, 실제 PostgreSQL). 암호 연산은 mock 금지(인프로세스) — 외부 시스템 경계인 디스코드 웹훅 HTTP만 mock.

**Target Platform**: Linux server (OCI Compute Docker 컨테이너)

**Project Type**: Web application (백엔드 단독 변경 — 프론트 무변경)

**Performance Goals**: 암호화 도입으로 인한 본문 저장/로드 **서버 처리 추가 지연 p95 ≤ 5ms**(SC-001). AES-256-GCM은 AES-NI 가속으로 수십 KB 본문당 수십 µs.

**Constraints**: 클라이언트 API 계약 불변(FR-006) / 글자수·충돌 동작 불변(FR-007·008) / fail-closed(FR-009) / 무중단 지연 전환(FR-011) / 신규 사용자 대면 기능 0.

**Scale/Scope**: 솔로 운영 제품(사용자 수십~수백 규모 가정), 단일 백엔드 인스턴스(blue-green). 본 기능 = `documents.body` 한정.

## Constitution Check

*GATE: Phase 0 이전 통과 필수, Phase 1 이후 재점검.*

`.specify/memory/constitution.md` 는 **빈 템플릿**이다. 프로젝트 정책상(루트 `CLAUDE.md` §"constitution 빈템플릿→CLAUDE.md 룰 준용") **CLAUDE.md + `.claude/rules/*` 를 게이트로 준용**한다.

| 게이트 (CLAUDE.md / rules) | 평가 |
|---|---|
| **추측 금지 / 단정 금지** (최우선) | PASS — 본 plan은 실측(DocumentService·ProjectService·마이그레이션 번호·시크릿 패턴·복호 4지점)에 근거. 추정 영역 없음. |
| **TDD HARD-GATE** (`.claude/rules` / CLAUDE.md §5) | PASS(계획) — Red-Green-Refactor. 암복호 왕복·레거시 판별·변조 감지·키 격리·통합(저장→DB 암호문→로드 평문) 모두 테스트 선작성. |
| **Mock 경계 (Classist)** | PASS — 암호 연산은 인프로세스라 mock 안 함. 디스코드 웹훅(외부 HTTP)만 경계 mock. |
| **Simplicity / YAGNI** (§2) | PASS — KEK 회전 *실행*은 범위 밖(구조만, FR-013). 외부 암호 라이브러리·KMS 미도입(JDK 내장). DEK 캐시는 단순 bounded in-memory. |
| **Surgical changes** (§3) | PASS — `documents` 스키마 무변경, 핫패스에 암복호 호출만 삽입, 인접 코드 미개선. |
| **Kotlin code-quality** (`.claude/rules/kotlin`) | 준수 예정 — `@Transactional(rollbackFor = [Exception::class])` 배열 문법, 생성자 주입, ktlint main+test. |
| **external-infra-safety** (HARD-GATE) | 준수 — V22 작성·리뷰는 자유, **운영/로컬 DB 적용은 사용자 컨펌**. 테스트는 Testcontainers 격리. |
| **신규 status/에러코드 최소** | 신규 1종(`DOCUMENT_DECRYPTION_FAILED`, 500) — fail-closed 표현에 필요한 최소. |

**판정: PASS** (위반 없음 → Complexity Tracking 불필요).

## 통합 지점 (실측 — 구현 결선 대상)

암복호를 끼울 정확한 코드 지점. 모두 `userId`(=작품 소유자)를 이미 보유 → 사용자 DEK 결정 가능.

**암호화(평문→봉투) 1지점**
- `service/DocumentService.kt` `performSave()` L107 `document.body = request.body` → `document.body = bodyCipher.encrypt(userId, request.body)`. 응답 `body` 는 평문 `request.body` 그대로 반환(재복호 불필요).

**복호(봉투→평문) 4지점**
- `service/DocumentService.kt` `toResponse()` L166 `body = body` — `getDocumentByProjectId`/`getDocumentById` 경유(둘 다 `userId` 보유) → 복호.
- `service/DocumentService.kt` `performSave()` L104 충돌 응답 `currentBody = document.body` → 복호한 평문 전달.
- `service/DocumentService.kt` `performSave()` 응답 — 위처럼 평문 직접 반환으로 해소.
- `service/ProjectService.kt` `listCards()` L120 `ProseMirrorText.extractPlainText(it.body)` → `extractPlainText(bodyCipher.decryptToPlain(userId, it.body))`(레거시 평문은 통과).

> `performSave(document, request)` → `performSave(userId, document, request)` 로 내부 시그니처 확장(충돌 currentBody 복호용). 외부 계약 불변.

**DEK 생성 2지점**
- `service/AuthService.kt` `signupEmail()` L66 `userRepository.save(User(...))` 직후 → `userKeyService.create(userId)`(동일 트랜잭션).
- `auth/KakaoOAuth2UserService.kt` `insertNewKakaoUser()` L99 → 신규 Kakao 사용자 저장 직후 DEK 생성.
- 안전망: 위 경로를 안 탄 기존 사용자는 `performSave` 의 `getOrCreate(userId)` 가 첫 저장 시 지연 생성(FR-005).

## Project Structure

### Documentation (this feature)

```text
specs/034-document-body-encryption/
├── plan.md              # 본 파일
├── spec.md              # 기능 명세(완료)
├── research.md          # Phase 0 — 암호 설계 결정
├── data-model.md        # Phase 1 — UserDataKey 엔티티 + 봉투 포맷
├── quickstart.md        # Phase 1 — 환경변수·배포·dogfooding
├── contracts/
│   ├── external-api-invariance.md   # 외부 API 계약 불변 명시
│   ├── body-envelope.md             # 봉투 JSON 스키마 + 판별 규칙
│   └── internal-cipher-contract.md  # BodyCipherService / UserKeyService 계약
└── checklists/requirements.md
```

### Source Code (repository root) — 신규/수정

```text
backend/src/main/kotlin/com/writenote/
├── config/
│   └── CryptoConfig.kt                  # [신규] KEK 로드(app.crypto.master-key), SecretKey 빈
├── crypto/                              # [신규 패키지]
│   ├── AesGcmCipher.kt                  # [신규] AES-256-GCM encrypt/decrypt + 봉투 직렬화/판별 (순수)
│   ├── BodyCipherService.kt             # [신규] encrypt(userId, plain) / decryptToPlain(userId, stored)
│   ├── UserKeyService.kt                # [신규] DEK create/getOrCreate + KEK wrap/unwrap + bounded 캐시
│   └── DecryptionFailureNotifier.kt     # [신규] 복호 실패 디스코드 웹훅 알림(@Async, best-effort)
├── entity/
│   └── UserEncryptionKey.kt             # [신규] user_encryption_keys 매핑
├── repository/
│   └── UserEncryptionKeyRepository.kt   # [신규]
├── error/
│   ├── BodyDecryptionException.kt       # [신규] → DOCUMENT_DECRYPTION_FAILED(500)
│   └── ErrorCode.kt (또는 해당 위치)     # [수정] 코드 1종 추가
├── service/
│   ├── DocumentService.kt               # [수정] 저장 암호화 + 로드/충돌 복호 (4+1 지점)
│   ├── ProjectService.kt                # [수정] listCards lastSentence 복호
│   └── AuthService.kt                   # [수정] signupEmail DEK 생성
└── auth/
    └── KakaoOAuth2UserService.kt        # [수정] Kakao 신규 사용자 DEK 생성

backend/src/main/resources/
├── db/migration/V22__create_user_encryption_keys.sql   # [신규]
├── application.yml                                       # [수정] app.crypto / app.alerts 추가
└── application-local.yml (또는 프로파일)                  # [수정] 로컬 dev KEK 기본값

backend/src/test/kotlin/com/writenote/
├── crypto/AesGcmCipherTest.kt           # [신규] 왕복·변조감지·레거시판별
├── crypto/UserKeyServiceTest.kt         # [신규] wrap/unwrap·키 격리·getOrCreate
├── crypto/BodyCipherServiceTest.kt      # [신규] encrypt/decryptToPlain·레거시 통과
├── service/DocumentEncryptionIT.kt      # [신규] Testcontainers 저장→DB암호문→로드평문·충돌·레거시
└── (ProjectService listCards 암호문 케이스 보강)
```

**Structure Decision**: 기존 `backend/` Spring Boot 단일 모듈에 `crypto` 패키지 신설 + 핫패스 서비스 결선. 프론트(`frontend/`) 무변경(API 계약 불변). 암호 연산은 `crypto` 패키지에 응집(정보 은닉 — 서비스는 평문만 다루고 암복호는 경계에서).

## 구현 라운드 (tasks 분해 가이드 — 핵심 우선 §10)

핵심 = "본문이 DB에 암호문으로 저장되고 정상 왕복". R1+R2 가 첫 dogfoodable 슬라이스로 이를 증명한다.

- **R1 키 인프라(BE)**: V22 마이그레이션, `UserEncryptionKey` 엔티티/리포지토리, `CryptoConfig`(KEK), `AesGcmCipher`(순수 암호+봉투), `UserKeyService`(DEK 생성/wrap/unwrap/캐시), 가입 2경로 DEK 생성. 게이트: 단위 테스트(왕복·격리·wrap).
- **R2 본문 암복호 결선(BE)**: `BodyCipherService`, `DocumentService` 저장 암호화 + 로드/충돌 복호, `ProjectService.listCards` 복호, 레거시 판별, `BodyDecryptionException`(fail-closed). 게이트: Testcontainers IT(저장→DB 암호문→로드 평문·충돌·레거시·카드). **첫 dogfooding**.
- **R3 복호 실패 알림(BE)**: `DecryptionFailureNotifier`(@Async best-effort), `app.alerts.discord-webhook-url`, 결선. 게이트: 웹훅 mock 단위 테스트(실패 시 비차단).
- **R4 성능 검증 + 운영(BE)**: 암복호 왕복 성능 테스트(임계 하 검증), dogfooding(저장/로드/카드/충돌/레거시), (선택) 전수 백필 스크립트. env 프로비저닝·KEK 백업 수칙.

배포: **BE 단독**(FE 무관). 단 V22 + `BODY_ENCRYPTION_KEY` env 가 배포 **전제**(미설정 시 저장 실패) — quickstart 의 배포 전 체크리스트 준수. KEK 분실=데이터 손실이므로 KEK 안정·분리 백업 HARD 수칙.

## Complexity Tracking

> Constitution Check PASS — 위반 없음. 본 절 비움.
