# Contract: 본문 봉투 포맷 (Encrypted Body Envelope v1)

`documents.body`(JSONB) 에 저장되는 암호문 봉투의 스키마와 판별 규칙. 레거시 평문과 한 컬럼에서 공존.

## 봉투 스키마 (v1)

```json
{
  "v": 1,
  "alg": "A256GCM",
  "iv": "<base64url, 12-byte nonce>",
  "ct": "<base64url, AES-256-GCM ciphertext ‖ 16-byte tag>"
}
```

- `v`: 봉투 스키마 버전(현재 1). 향후 포맷 진화 대비.
- `alg`: 알고리즘 식별(현재 `A256GCM` 고정). 향후 협상 대비.
- `iv`: 12바이트 랜덤 nonce(매 암호화 `SecureRandom` 신규), base64url(패딩 없음).
- `ct`: GCM 출력(암호문 뒤에 16바이트 인증 태그가 붙은 JCA 기본 출력), base64url.
- 평문 입력 = ProseMirror JSON 문자열의 UTF-8 바이트.

## 판별 규칙 (저장값 → 평문 추출)

```text
fun decryptToPlain(userId, stored: String): String {
    val node = parseJson(stored)                 // JSONB → JSON
    // 1) 레거시 평문: 최상위 type == "doc"
    if (node["type"] textual && == "doc") return stored        // 그대로(복호 불필요)
    // 2) 암호문 봉투 v1: v & iv 보유
    if (node has "v" && node has "iv") {
        val dek = userKeyService.getOrCreate(userId)           // KEK unwrap (캐시)
        return aesGcm.decrypt(dek, iv = b64u(node.iv), ct = b64u(node.ct))  // UTF-8 → 평문
        // 실패(태그 불일치/키 불일치) → throw BodyDecryptionException  (fail-closed)
    }
    // 3) 알 수 없는 형태 → BodyDecryptionException (fail-closed, 평문 추측 금지)
}
```

- ProseMirror 문서 최상위는 항상 `{"type":"doc",...}` 이며 `iv`/`v` 필드를 갖지 않음 → 판별 충돌 없음.
- 암호화: `encrypt(userId, plain)` = `getOrCreate(userId)` → `aesGcm.encrypt(dek, plain.utf8)` → 봉투 JSON 문자열.

## 불변식

- 같은 평문도 IV 랜덤 → 매 저장 암호문 상이(정상). dirty 판정은 본문 클라이언트측이며 서버는 항상 재암호화 저장(자동저장 계약 불변).
- 봉투 내부에 평문·DEK·KEK 어떤 조각도 노출되지 않음.
- 복호 산출물은 원래 평문과 **바이트 동일**(왕복 무손실, SC-004).
