# 설계: 관리자 문의·의견 보내기 (Desktop)

**작성일:** 2026-06-08
**대상 트랙:** Desktop MVP (`desktop/`)
**목적:** 패키징·배포 후 실제 사용자로부터 의견을 받아 정식 배포판 개발에 반영한다. 초기 소수 사용자 대상의 피드백 수집 채널.

## 배경 / 제약

- 현재 메인 트랙은 **Desktop(Electron) 완전 로컬 앱**이다. renderer는 외부로 직접 `fetch`하지 않고, 모든 외부 호출은 main 프로세스 IPC를 거친다(`desktop/src` 내 `fetch`/`axios` 0건).
- WEB 백엔드(Spring Boot)는 paused 상태이며, 실제 메일 발송도 미구현(`LoggingMailSender`는 콘솔 로그만)이다. 따라서 "인앱 전송"을 로컬 앱에서 성립시키려면 외부 서비스가 필요하다.
- `shell.openExternal`·`mailto:` 사용처가 코드에 아직 없다(신설 대상).
- 카카오는 OAuth 로그인만 구현돼 있고, 오픈채널/오픈채팅 관련 코드는 없다.

## 결정 사항 (brainstorming 합의)

| 결정 | 값 | 근거 |
|---|---|---|
| 진입점 | Rail(좌측 메뉴) 최하단 상시 노출 | 숨기지 않고 발견성 확보 (사용자 지시) |
| 진입 후 UI | 전용 화면(5번째 `screen`) | 작품/집필/메모/기록과 동급 화면 전환 |
| 메일 전송 방식 | 인앱 전송 → **외부 폼-투-이메일 서비스(Web3Forms)** | 로컬 앱엔 서버가 없음. 백엔드 부활은 피드백 수집 목적에 과한 인프라 |
| 폼 구성 | 회신 이메일(선택) + 본문(필수) + 앱 버전·OS 자동 첨부 | 회신 가능성·환경 파악과 단순함의 균형 |
| 회신 이메일 | **선택**, 기본값 = **익명 의견 제출** | 비우면 익명으로 제출 |
| 카카오 채널 | 오픈채팅 URL을 기본 브라우저로 열기(`shell.openExternal`) | 별도 API·인증 불필요 |

### Web3Forms 채택 근거 (검증 완료)

- access key는 비밀 키가 아니라 **이메일 주소의 별칭(alias)** 이며 클라이언트에 공개돼도 안전하다(노출돼도 "그 주소로 메일을 보낼 수만" 있고, 스팸은 서비스가 서버단에서 거른다). → C안의 "API 키 노출 위험"이 해당되지 않음. ([Web3Forms FAQ](https://docs.web3forms.com/getting-started/faq))
- CORS는 브라우저 보안 모델이므로 **main 프로세스(Node)에서 호출하면 적용되지 않는다.** 이 앱은 외부 호출을 항상 main에서 하므로 Electron의 origin 부재 문제와 무관하게 동작한다. ([Web3Forms Troubleshooting](https://docs.web3forms.com/getting-started/troubleshooting))

## 화면 구성 (문의 전용 화면)

기존 4화면 통일 골격 `[rail][메인 1fr][우측 패널]`을 재사용하고, 메인에 surface 시트를 둔다.

- 상단 안내 한 줄 — 예: "쓰면서 불편했던 점이나 바라는 점을 들려주세요"
- **메일 폼**
  - 회신 이메일 입력 — placeholder "답장받을 이메일 (선택)", 비우면 익명
  - 본문 textarea — 필수
  - [보내기] 버튼 — 본문 비었으면 비활성
- 구분선
- **"카카오톡 오픈채팅으로 문의"** 버튼 — 클릭 시 기본 브라우저로 오픈채널 URL 열기

## 데이터 흐름

### 메일
1. renderer 폼 → `electronAPI.contact.send({ email, body })` (IPC)
2. main 핸들러가 본문에 **앱 버전 · OS · 전송 시각**을 자동 첨부
3. `contactSender`가 Web3Forms `https://api.web3forms.com/submit`에 `application/json`으로 POST
   - payload: `access_key` + 본문(메타 포함) + 회신 이메일(있으면 Web3Forms reply-to로 전달)
   - **정확한 reply-to 필드명은 구현 시 Web3Forms docs로 확정**(추측 금지)
4. 응답 success → renderer로 결과 반환 → 토스트 "보내주셔서 감사합니다"

### 카카오
- renderer 버튼 → `electronAPI.shell.openExternal(kakaoUrl)` → main에서 `shell.openExternal` 실행. 폼과 독립.

## IPC 경계 (기존 구조 정합)

- `desktop/electron/ipc/contract.ts`
  - `CHANNELS`에 `contact:send`, `shell:openExternal` 추가
  - `ElectronAPI` 타입에 `contact.send`, `shell.openExternal` 추가
- `desktop/electron/preload.ts` — `electronAPI.contact`, `electronAPI.shell` 네임스페이스를 화이트리스트로 노출
- `desktop/electron/ipc/registerHandlers.ts` — 두 핸들러 등록
- **`desktop/electron/contactSender.ts` 신설** — 문의 전송은 로컬 DB가 아니므로 `Store` 밖 별도 모듈. 전송 함수만 격리해, 추후 백엔드(B안)로 교체 시 이 파일만 swap한다.

> `Store`는 로컬 SQLite 전용 use-case 계층이다. 외부 HTTP 호출을 `Store`에 넣지 않고 분리함으로써 책임 경계를 유지한다.

## 설정값 / 시크릿

- **Web3Forms access key** — 공개 안전(위 검증)이므로 main 측 상수 파일에 둔다. 별도 `.env` 불필요. 수신 메일 주소는 access key가 곧 alias이므로 따로 설정하지 않는다.
- **카카오 오픈채널 URL** — 상수.
- **사용자 준비물(구현 전 필요):**
  1. Web3Forms 가입 → access key 발급
  2. 카카오 오픈채팅방 생성 → 공유 URL 확보

## 에러 / 엣지 케이스

| 상황 | 처리 |
|---|---|
| 본문 빈 값 | [보내기] 비활성 |
| 전송 중 | 버튼 로딩·비활성 (연타/중복 전송 방지) |
| 네트워크·서비스 실패 / 오프라인 | 토스트 "전송 실패, 잠시 후 다시 시도" + **폼 내용 보존** |
| 회신 이메일 입력 시 | 간단한 형식 검증. 비어 있으면 통과(선택 필드) |

## 테스트 (TDD)

- `contactSender` — 입력 → Web3Forms payload 매핑(access_key / reply-to / message 구성, 메타 첨부 포맷)을 순수 함수로 검증. `fetch`는 시스템 경계이므로 mock(성공/실패 응답).
- IPC 핸들러 — `contact:send` 성공/실패 분기.
- renderer 폼 — 빈 본문 시 [보내기] 비활성, 전송 성공 후 토스트 노출(RTL, 행위 기준).
- 회귀 0 — 기존 vitest 스위트 GREEN 유지.

## 범위 밖 (YAGNI)

- 문의 내역의 로컬 저장/조회(보낸 문의 히스토리) — 초기 피드백 수집엔 불필요.
- 문의 분류(버그/제안/기타) 셀렉트 — 초기 소수 사용자 단계엔 과함. 필요 시 후속.
- 첨부파일·스크린샷 업로드 — 후속.
- 백엔드(B안) 전송 — `contactSender` swap 지점만 남겨두고 지금은 미구현.
