# Quickstart: 관리자 문의·의견 보내기 (Desktop)

전송 서비스 = **Formsubmit**(research R1, main 호출 가능 실측 확정). Web3Forms 는 main 차단으로 폐기.

## 사용자(관리자) 준비물 — 구현 전 필요

코드엔 플레이스홀더 상수만 두고, 아래 값을 사용자가 확보해 채운다.

1. **Formsubmit 엔드포인트(수신처)**
   - https://formsubmit.co 에서 **수신할 이메일로 첫 제출 → activation 메일의 "Activate Form" 클릭**(2026-06-08 jongbell4@gmail.com 활성화 완료).
   - 가입·API 키 불필요(무료).
   - **이메일 노출 회피**: activation 메일/대시보드의 **랜덤 해시 엔드포인트**(`https://formsubmit.co/ajax/<hash>`)를 상수에 쓰면 코드/네트워크에 이메일이 안 드러난다. 해시를 확보해 둘 것(없으면 이메일 직접도 동작).
2. **카카오 오픈채팅 URL**
   - 카카오톡 → 오픈채팅방 생성 → 공유 URL(`https://open.kakao.com/...`) 확보. renderer 상수에 채운다(`http(s)`만 main에서 허용).

> 엔드포인트 해시/카카오 URL 이 비어 있으면 빌드/테스트는 통과하나 **실제 전송·열기는 동작하지 않는다**(플레이스홀더 상태).

## 개발 검증 흐름

```bash
cd desktop
pnpm test          # Vitest — contactSender(node) + ContactScreen(renderer) GREEN + 기존 회귀 0
pnpm typecheck     # tsc --noEmit — IPC 타입 정합(contact/shell)
pnpm dev           # Electron 실행 — dogfooding
```

## 수동 dogfooding 체크리스트 (실 엔드포인트 채운 뒤)

- [ ] Rail 최하단에 문의 진입점이 **상시 노출**되고, 클릭 시 전용 화면으로 전환된다(FR-001/002).
- [ ] 본문이 비면 [보내기] 비활성(FR-004), 한 글자 입력 시 활성.
- [ ] 회신 이메일 비우고 전송 → 성공 안내 + 폼 초기화. 수신 메일이 익명으로 도착(FR-005).
- [ ] 회신 이메일 입력하고 전송 → 수신 메일에서 **답장(reply)** 시 그 주소로 감(FR-009, R6 매핑 확정).
- [ ] 수신 메일 본문 말미에 **앱 버전·OS·전송 시각**이 붙어 있다(FR-008/SC-004).
- [ ] **오프라인 상태로 전송** → "전송 실패, 잠시 후 다시 시도" + 작성 내용 그대로 보존 → 다시 [보내기] 가능(FR-012/US3).
- [ ] 전송 중 [보내기] 로딩·비활성(연타로 중복 전송 안 됨)(FR-011).
- [ ] "카카오톡 오픈채팅으로 문의" 클릭 → 기본 브라우저로 오픈채팅방 열림, 폼 입력 영향 없음(FR-013/014).

## R6 확정 작업 (구현 중 1회)

- 회신 주소 매핑이 `email` 필드로 충분한지 dogfooding 답장 테스트로 확정. 부족하면 `_replyto` 특수 필드로 보강(research R6).

## 범위 밖 (구현하지 않음)

- 보낸 문의 로컬 저장/조회(히스토리), 문의 분류 셀렉트, 첨부파일, 백엔드(B안) 전송. `contactSender.ts` swap 지점만 남긴다.
