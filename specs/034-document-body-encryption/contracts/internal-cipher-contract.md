# Contract: 내부 암호 컴포넌트 (crypto 패키지)

서비스 계층이 평문만 다루도록 암복호를 경계에 응집. 아래는 신규 컴포넌트의 책임 계약(시그니처는 구현 시 Kotlin 관용 정합).

## AesGcmCipher (순수)

저수준 AES-256-GCM + 봉투 직렬화/판별. 상태 없음, 순수 함수.

```kotlin
class AesGcmCipher {
    // 봉투 JSON 문자열 생성 (랜덤 IV)
    fun seal(key: SecretKey, plaintextUtf8: ByteArray): String          // → {"v":1,...}
    // 봉투 또는 레거시 평문 → 평문 문자열
    fun openOrPassthrough(key: SecretKey, stored: String): String       // 레거시는 그대로
    // 키 wrap/unwrap (DEK ↔ wrapped bytes), KEK 사용
    fun wrap(kek: SecretKey, dek: SecretKey): ByteArray                 // iv‖ct‖tag(60B)
    fun unwrap(kek: SecretKey, wrapped: ByteArray): SecretKey
}
```

- 복호/unwrap 실패(`AEADBadTagException` 등) → `BodyDecryptionException` 으로 변환(평문/빈값 반환 금지).
- 테스트: 왕복 무손실 · IV 무작위성(연속 seal 결과 상이) · 변조 1바이트 → 실패 · 잘못된 키 → 실패 · 레거시 평문 통과.

## UserKeyService

사용자 DEK 수명주기 + KEK wrap/unwrap + 캐시.

```kotlin
class UserKeyService(repo: UserEncryptionKeyRepository, cryptoConfig, cipher: AesGcmCipher) {
    fun create(userId: Long): Unit          // DEK 랜덤 생성 → KEK wrap → user_encryption_keys 저장 (가입 시)
    fun getOrCreate(userId: Long): SecretKey // 캐시 → 없으면 DB unwrap → 없으면 create. 평문 DEK 반환(메모리)
}
```

- 캐시: bounded in-memory `userId → SecretKey`(D4). 평문 DEK 는 메모리에만.
- `create` 중복 호출 가드(이미 있으면 no-op 또는 기존 반환).
- 테스트: 두 사용자 DEK 격리(한 키로 타 사용자 본문 복호 실패) · wrap→unwrap 동일 키 · getOrCreate 지연 생성.

## BodyCipherService

서비스 계층이 호출하는 파사드(평문↔저장값).

```kotlin
class BodyCipherService(userKeyService: UserKeyService, cipher: AesGcmCipher, notifier: DecryptionFailureNotifier) {
    fun encrypt(userId: Long, plain: String): String        // → 봉투 문자열 (저장용)
    fun decryptToPlain(userId: Long, stored: String): String // 봉투/레거시 → 평문. 실패 시 알림+throw
}
```

- `decryptToPlain` 실패 시: `notifier.notify(userId, documentContext, reason)`(best-effort) 후 `BodyDecryptionException` throw.
- 호출처: `DocumentService`(저장 암호화·로드/충돌 복호), `ProjectService.listCards`(복호).

## DecryptionFailureNotifier (외부 경계)

복호 실패를 운영자에게 알림. 본 기능 가용성에 영향 0(best-effort).

```kotlin
class DecryptionFailureNotifier(props /* discord-webhook-url */, httpClient) {
    @Async fun notify(userId: Long, documentId: Long?, reason: String): Unit
}
```

- 동작: `log.error`(평문·키 미포함, 식별자+사유만) → 웹훅 URL 있으면 Discord Incoming Webhook `{"content": "..."}` POST(짧은 타임아웃).
- 전 구간 try/catch swallow. URL 미설정 → 로그만. **요청 흐름·예외 전파 불변**.
- 테스트(웹훅 HTTP mock): 호출 발생 · 웹훅 실패해도 예외 미전파 · 페이로드에 평문/키 미포함 · URL 미설정 시 skip.

## CryptoConfig

KEK 로드.

```kotlin
@Configuration class CryptoConfig {
    @Bean fun masterKey(@Value("\${app.crypto.master-key:}") b64: String): SecretKey   // Base64 32B → AES SecretKey
}
```

- KEK 미설정/길이 오류 시: 빈 생성 실패(fail-fast) — 암호화 의존 기능이 키 없이 가동되지 않도록. (로컬 프로파일은 dev 기본 키 제공.)
