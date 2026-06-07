# Phase 1 Data Model: 관리자 문의·의견 보내기 (Desktop)

본 기능은 **로컬 영속 데이터가 없다**(히스토리 범위 밖). 아래는 전송 과정의 transient 구조와 외부 payload 매핑이다. DB 스키마/마이그레이션 변경 없음.

> 전송 서비스 = **Formsubmit**(research R1, 실측 확정). (Web3Forms 폐기)

## 엔티티 (transient)

### ContactInput (renderer → main, IPC payload)

renderer 폼이 IPC로 넘기는 입력. **사용자 입력값만** 포함(메타는 main이 부여).

| 필드 | 타입 | 제약 | 출처 |
|---|---|---|---|
| `email` | `string` | 선택. 비면 익명. 입력 시 간단한 형식 검증 통과 필요. | 폼 입력(회신 이메일) |
| `body` | `string` | 필수. 비공백 1자 이상(빈 값이면 renderer가 전송 자체를 막음). | 폼 textarea(본문) |

```ts
export type ContactInput = { email: string; body: string };
```

> `email`은 빈 문자열 허용(익명). renderer는 빈 본문일 때 [보내기]를 비활성으로 두어 `body` 공백 전송을 원천 차단(FR-004).

### ContactMeta (main 파생값 — 사용자 입력 아님)

| 필드 | 타입 | 출처 |
|---|---|---|
| `appVersion` | `string` | `app.getVersion()` |
| `os` | `NodeJS.Platform` | `process.platform` |
| `sentAt` | `string` (ISO 8601) | `new Date().toISOString()` |

### ContactResult (main → renderer, IPC 반환)

| 필드 | 타입 | 의미 |
|---|---|---|
| `ok` | `boolean` | 전송 성공 여부(R2: HTTP 200 + `success === "true"` 문자열). 실패 시 renderer가 폼 내용 보존 + 실패 안내(FR-012). |

```ts
export type ContactResult = { ok: boolean };
```

## 외부 payload 매핑 (ContactInput + ContactMeta → Formsubmit JSON)

`buildContactPayload(input, meta)` 순수 함수의 출력. (R1/R6 확정 필드명)

| Formsubmit 필드 | 값 | 규칙 |
|---|---|---|
| `_subject` | (상수, 예: "write-note 데스크탑 의견") | 고정 제목. |
| `_captcha` | `"false"` | ajax 호출 캡차 비활성. |
| `message` | `input.body` + 메타 푸터 | 본문 + `\n\n---\n앱 버전: {appVersion} · OS: {os} · 전송: {sentAt}` |
| `email` | `input.email` | **비어 있지 않을 때만 포함**(회신 주소). 비면 키 생략 → 익명. |

```ts
type FormsubmitPayload = {
  _subject: string;
  _captcha: "false";
  message: string;
  email?: string; // 회신 이메일 있을 때만
};
```

> 전송 시 `fetch` 헤더에 `Content-Type: application/json` + `Accept: application/json` + **`Referer`(상수, 필수)** 를 포함한다(R2). payload 자체엔 Referer 없음(HTTP 헤더).

### 매핑 규칙 (테스트 대상 — FR-005·FR-008·FR-009)

1. `email`이 빈 문자열/공백 → payload에서 `email` 키 **생략**(익명 제출).
2. `email`이 값 있음 → `email` 포함(수신자가 답장 가능; 정확 매핑은 R6 dogfooding 확정).
3. `message`엔 항상 앱 버전·OS·전송 시각 메타 푸터가 붙는다(빠짐없이 — SC-004).
4. `_subject`·`_captcha`는 항상 상수로 채워진다.

## 상태 전이 (ContactScreen 폼)

```
idle ──(본문 입력)──> ready(보내기 활성)
ready ──(보내기 클릭)──> sending(버튼 로딩·비활성, 연타 차단 FR-011)
sending ──(ok:true)──> success(감사 안내 + 폼 초기화 FR-010) ──> idle
sending ──(ok:false / 예외)──> error(실패 안내 + 내용 보존 FR-012) ──> ready(재시도 가능)
```

- `body`가 공백이면 항상 `보내기` 비활성(ready 진입 불가) — FR-004 / SC-002.
- 카카오 버튼은 위 전이와 **독립**(폼 상태 불변) — FR-014.
