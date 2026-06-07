# Phase 0 Research: 관리자 문의·의견 보내기 (Desktop)

설계 문서가 "구현 시 확정"·"추측 금지"로 남긴 외부 전송 방식을 **실측으로 확정**한다. (2026-06-08 curl 실측)

> ⚠️ **설계 R1 가정 정정**: 설계 문서·초기 research 는 "Web3Forms 를 main 프로세스에서 호출하면 CORS 무관하게 동작"으로 가정했으나 — **실측 결과 거짓**. Web3Forms 는 server-side(main) 호출을 무료 플랜에서 차단한다. 전송 서비스를 **Formsubmit** 으로 교체하고 main 호출 구조는 유지한다.

## R1. 전송 서비스 — Web3Forms ❌ → Formsubmit ✅ (실측 확정)

**Decision**: **Formsubmit** (`https://formsubmit.co/ajax/<이메일 또는 해시>`) 을 main 프로세스에서 호출한다. 기존 IPC 경계(renderer→main) 유지.

**Rationale (curl 실측)**:

| 테스트 | 서비스 | 결과 |
|---|---|---|
| Origin 헤더 없음(main 모사) | Web3Forms | ❌ `HTTP 403 {"success":false,"message":"This method is not allowed. Use our API in client side or contact support with server IP address (Pro plan is required)"}` |
| `Origin: http://localhost` + `Referer` 추가 | Web3Forms | ❌ **동일 403** — Origin 헤더로 우회 불가(client/server 판정이 Origin 기반 아님) |
| Referer 헤더 없음(main 모사) | Formsubmit | ⚠️ `HTTP 200 {"success":"false","message":"Make sure you open this page through a web server, FormSubmit will not work in pages browsed as HTML files."}` — Referer 부재로 거부 |
| **`Referer` 헤더 추가** | Formsubmit | ✅ 통과 → activation 단계 진입 → activation 후 `HTTP 200 {"success":"true","message":"The form was submitted successfully."}` |

→ **Web3Forms 는 main(서버사이드) 호출 불가**(유료+IP Safelist 필요). **Formsubmit 은 `Referer` 헤더 1줄이면 main 에서 호출 가능** → 우리 앱의 "renderer 직접 호출 금지 / 모든 외부 호출 main 경유" 구조를 깨지 않고 해결.

**Alternatives considered**:
- Web3Forms + renderer 직접 호출 — IPC 경계 위반 + prod `file://` origin 동작 불확실(실제 앱 PoC 필요). 거부.
- 백엔드(B안) 부활 — 과한 인프라(설계 기각 유지). 거부.

## R2. Formsubmit 요청·성공 판정 (실측 확정)

**Decision**:
- 요청: `POST https://formsubmit.co/ajax/<엔드포인트>`, 헤더 `Content-Type: application/json` + `Accept: application/json` + **`Referer: <임의의 https URL>`**(필수), body = JSON.
- 성공 판정: **HTTP 200 AND 응답 `success === "true"`(문자열)**. 그 외(비-200 / `success!=="true"` / fetch reject) → 실패.

**Rationale**: 실측 응답이 `{"success":"true"|"false","message":"..."}` 형태로 확정. **`success` 는 boolean 이 아니라 문자열** — 반드시 `=== "true"` 로 비교(Web3Forms boolean 과 다름, 회귀 함정). Referer 가 없으면 200 이어도 `success:"false"`(web server 에러)이므로 Referer 의무.

**구현 주의**: `Referer` 값은 실제 도달 가능한 도메인일 필요 없음(실측에서 `https://write-note.local/contact` 임의값으로 통과). 앱 식별용 상수 URL 1개를 둔다.

## R3. 엔드포인트·시크릿 보관 (실측 확정)

**Decision**: Formsubmit 엔드포인트 식별자(**수신 이메일 또는 랜덤 해시**)를 main 측 상수로 둔다. **access key 등 시크릿 없음** — Formsubmit 은 무가입·키 없음.

**Rationale**:
- access key 개념 자체가 없다(Web3Forms 와 차이). 엔드포인트 경로의 이메일/해시가 곧 수신처.
- **이메일 직접 노출 회피**: `formsubmit.co/ajax/<email>` 은 이메일이 코드/네트워크에 노출된다. Formsubmit activation 메일·대시보드가 주는 **랜덤 해시 엔드포인트**(`formsubmit.co/ajax/<hash>`)를 상수로 쓰면 이메일 비노출. **사용자 준비물**(quickstart)에서 해시 확보.
- activation: 첫 제출로 트리거 → **2026-06-08 사용자 승인 완료**. 재활성화 불요.

## R4. 전송 모듈 경계 — `Store` 밖 격리 (유지)

**Decision**: 신규 `desktop/electron/contactSender.ts`. 두 함수 분리:
- `buildContactPayload(input, meta)` — **순수 매핑**(Formsubmit JSON body 구성). fetch 없이 테스트.
- `sendContact(input, meta)` — `buildContactPayload` + global `fetch`(Referer/Accept 헤더 포함) + R2 판정. `fetch` 만 mock.

**Rationale**: `Store`(로컬 SQLite use-case) 에 외부 HTTP 혼입 금지. 분리하면 추후 백엔드 전환 시 이 파일만 swap. 서비스가 Web3Forms→Formsubmit 으로 바뀌어도 **격리 경계 자체는 설계 의도 그대로**.

## R5. 자동 첨부 메타(앱 버전·OS·시각)의 출처 (유지)

**Decision**: main 핸들러가 메타 수집 → `sendContact` 에 전달:
- 앱 버전 — `app.getVersion()`, OS — `process.platform`, 전송 시각 — `new Date().toISOString()`.
- `buildContactPayload`(순수) 가 `message` 본문 말미에 메타 푸터를 붙인다(예: `\n\n---\n앱 버전: x.y.z · OS: darwin · 전송: …Z`).

**Rationale**: agent-workflow-discipline §9 — 메타는 renderer 입력이 아닌 main 파생값. renderer 는 `{ email, body }` 만 전달.

## R6. Formsubmit 특수 필드 / 회신 이메일 매핑

**Decision**: Formsubmit JSON body 구성:
- `message` — 본문 + 메타 푸터(필수 표시 내용).
- `email` — 회신 이메일(있을 때만 포함). Formsubmit 은 `email` 필드를 회신 주소로 인식. 비면 키 생략(익명).
- `_subject` — 고정 제목 상수(예: "write-note 데스크탑 의견").
- `_captcha: "false"` — ajax 호출에서 캡차 비활성(리다이렉트/캡차 페이지 회피).
- `name` — 발신 표시명 상수(예: "write-note") 또는 생략.

**추측 표시(구현 시 1회 확인)**: 회신 주소를 `email` 로 충분한지, `_replyto` 특수 필드가 더 정확한지는 **구현 시 Formsubmit ajax docs 1회 확인 + dogfooding 답장 테스트로 확정**(quickstart 검증 항목). 핵심 동작(전송 성공)은 실측 확정됨.

## R7. Rail 진입점 배치 — "최하단 상시 노출" (유지)

**Decision**: `Rail.tsx` `ITEMS` 에 `{ key: "contact", label: "문의", … }` 5번째 추가(동급 화면 전환 + 최하단). (변경 없음)

## R8. 카카오 오픈채팅 — `shell.openExternal` 경계 (유지)

**Decision**: `electronAPI.shell.openExternal(url)` 화이트리스트 노출 + main 핸들러는 `http(s)` scheme 만 허용. 카카오 URL 은 renderer 상수. (변경 없음)

## 미해결/구현 시 확정 항목 (추측 금지 잔여)

| 항목 | 처리 |
|---|---|
| 회신 주소 매핑(`email` vs `_replyto`) | 구현 시 Formsubmit ajax docs 1회 확인 + dogfooding 답장 테스트(R6). |
| Formsubmit 엔드포인트(이메일 vs 해시) 실제 값 | 사용자 준비물(quickstart). 이메일 비노출 위해 해시 권장. |
| 이메일 형식 검증 강도 | 간단한 형식(`/.+@.+\..+/`)으로 충분(FR-006). |

## 폐기된 가정 (기록)

- ~~"Web3Forms access key 는 공개 안전이므로 상수에 둔다"~~ — Web3Forms 자체를 폐기. (access key 개념 없음)
- ~~"main 에서 호출하면 CORS 무관하게 동작"~~ — CORS 는 맞으나 Web3Forms 의 server-side 차단 로직에 막힘(실측 403). Formsubmit 으로 해결.
