# 016 자동저장 재설계 — 구현 완료, 그러나 유실 버그를 3회 헛고친 오진

- 일자: 2026-06-09
- 워크트리 / 브랜치: write-note / `016-autosave-localstorage-redesign`
- 관련 커밋: `94772e3`(백엔드 datetime 토큰) · `28b06c7`(프론트 localStorage-first + IME 보존) · `547c75b`(문서) — 기반 `db780d9`(spec/plan/tasks)
- 작업 시간 (대략): 단일 세션 장시간 (Foundational→US1→US2→US3→Polish→dogfooding→오진 3회→실제 원인 규명)

## 1. 무엇을 했는가 (사실)

- 백엔드: `Document.version: Int` 제거, `updatedAt`에 `@Version Instant` 부여(수정시각=낙관적 잠금 토큰). `performSave`가 `saveAndFlush` 후 새 토큰 응답. DTO 5종 `Int→Instant`. V8 마이그레이션(`documents.version` DROP) 작성 + **로컬 dev DB만 적용**(사용자 컨펌). 단위·IT·WebTest 갱신(토큰 라운드트립 정밀도 검증 포함) → 게이트 GREEN.
- 프론트: `draftStore`(localStorage CRUD) + `useDocumentSession`(세션이 version 단독 소유) 신규 TDD. 페이지를 `useAutoSave`→`useDocumentSession`으로 결선. `client/document/types/domain` version `number→string`. `useDocument` `staleTime:Infinity`. ConflictDialog string 적응. 레거시 `/write` 트리·`useAutoSave`·디버그 `middleware.ts` 제거.
- dogfooding 중 사용자가 "메뉴 이동 후 작성분 유실" 보고 → US2(복구 배너) → localStorage-first 자동복원 → 최종적으로 **PaperEditor IME 조합 중 onChange 차단**이 진짜 원인임을 규명, `onDraftUpdate`(조합 중 재렌더 없이 draft 갱신)+언마운트 flush로 해결.
- 프론트 83 테스트 + 백엔드 게이트 + 양쪽 build GREEN. 3개 논리 커밋 + 015 핸드오프 §해결 + vault(02-PROGRESS/03-ISSUES ISSUE-028) 갱신.

## 2. 어떻게 했는가 (접근)

- speckit-implement로 Foundational→US별 TDD(RED→GREEN). 백엔드 datetime 전환은 타입 cascade라 entity/DTO/test를 한 묶음으로 처리(§5-5 완화) + "응답 토큰 재저장 시 거짓충돌 0" IT를 추가해 Hibernate `@Version Instant`의 Postgres 정밀도 라운드트립을 실증(추측 회피).
- MVP STOP&VALIDATE에서 사용자 의도 확인 인터뷰(레거시 `/write` 처리, dogfooding 진행 방식)를 AskUserQuestion으로 분기.
- 외부 DB 안전 HARD-GATE 준수: V8 적용 전 local 프로파일 DB가 로컬 docker(운영 Supabase 아님)임을 확인 후 적용. stale 서버(3000/8080) 정리 후 재기동.

## 3. 잘 된 점

1) 백엔드 거짓충돌 제거는 **자동화로 실증**했다 — "응답 토큰 재저장 시 거짓충돌 없이 성공" IT가 Testcontainers 실 Postgres에서 GREEN → 우려했던 나노초/마이크로초 정밀도 불일치가 실제로 없음을 추측 아닌 관찰로 확인.
2) 외부 DB 안전·stale 서버 가드레일을 지켰다 — V8 적용 대상이 로컬 docker(`jdbc:...localhost:5432/writenote`)임을 확인 후 적용, 옛 dev 서버 종료 후 재기동(015 "stale 서버 오판" 교훈 적용).
3) 최종 원인 규명은 정확했다 — 사용자의 "Enter 누르면 살고 안 누르면 죽는다" 재현을 받고 `PaperEditor`의 `if (e.view.composing) return` 통로를 지목, 재렌더 없는 draft 갱신으로 IME를 깨지 않으면서 해결.

## 4. 어긋난 점

- **사용자 멈춤·분노 신호 다수.** "똑같은 문제 계속 발생하는데 뭘 고친다는거야", "원인부터 얘기해봐", 욕설 1회. 같은 증상(작성분 유실)을 **3회 서로 다른 가설로 헛고침**:
  1. US2 복구 배너 — 가설 "동기화 전 유실". 실패.
  2. localStorage-first 자동복원 + no-clobber — 가설 "복원 안 됨 / 동기화가 draft 덮음". 실패.
  3. (실제) IME 조합 중 onChange 차단 — 사용자 정밀 재현으로 확정.
- **추측 기반 수정의 전형.** systematic-debugging Phase 1(버그 실재·재현 확정)과 `agent-workflow-discipline §10-4`(버그 보고=실재 확인부터)를 알면서도, **자동저장/draft 레이어를 직접 관찰하지 않고** 타이밍 추론만으로 두 번 고쳤다. 클린 트레이스가 "서버에 425자 저장됨 + draft null"을 보여줘 내 자동저장 가설을 이미 반증했는데도(저장은 되고 있었다), 그 모순을 "표시 레이어 문제일 수 있다"고만 말하고 또 다른 자동저장 가설로 넘어갔다.
- **계측이 테스트를 오염.** 디버그 로그를 추가하는 HMR(`[Fast Refresh]`)이 사용자의 라이브 테스트 중 에디터를 리마운트시켜 첫 트레이스를 오염 → "내용 붕괴"가 내 코드 수정 탓인지 네비게이션 탓인지 분간 못 해 한 라운드를 더 낭비. "테스트 중 코드 수정 금지"를 뒤늦게 인지.
- **Playwright 설치(92MB)는 헛수고였다.** 직접 재현하려 설치했으나 Playwright는 IME 조합 입력을 흉내 못 내 이 버그를 재현 불가 → 설치 전 "Playwright로 IME 재현 가능한가"를 self-check했어야. 결국 사용자 수동 재현이 유일한 길이었고, 사용자가 먼저 정밀 재현을 제공.
- **회피 가능했던 시점:** 1차 수정이 실패한 직후. "같은 증상을 또 고치기 전에, 저장/draft/표시 중 어느 레이어인지 관찰로 먼저 확정"했어야. 특히 클린 트레이스에서 `serverBodyLen=425`(저장 정상)를 본 순간 자동저장 가설을 버리고 에디터 onChange 통로를 봤어야 — 그 통로(`composing` 가드)는 한 번만 읽었으면 바로 보였다.

## 5. 다음 작업에 남길 교훈

### 5-1. 작업별 교훈 (이 프로젝트 한정)

- **TipTap/IME 에디터에서 "작성분이 저장 안 된다"류 버그는 `onChange`(onUpdate) 통로부터 본다.** `if (e.view.composing) return` 같은 조합 가드가 React state/localStorage로 가는 유일한 통로를 막고 있을 수 있다. 한국어는 입력 내내 조합 중이라 commit(Enter/space) 전까지 어디에도 안 들어간다. "Enter 누르면 살아남는다" = 조합 가드 신호.
- **localStorage 보존은 재렌더와 분리한다.** 조합 중에도 draft는 `setState` 없이(=재렌더 없이) 갱신해야 IME를 안 깨고 무유실을 동시에 만족한다. + 언마운트 직전 flush.
- **datetime `@Version` 토큰은 응답 시 flush 후 DB 값을 읽어 돌려준다**(in-memory 나노초 ≠ DB 마이크로초로 인한 거짓충돌 방지). IT로 "응답 토큰 재저장 성공"을 박아 회귀 차단.

### 5-2. 룰 갱신 후보 (사용자 컨펌 필요)

**후보 A — `agent-workflow-discipline.md` §10-4 보강 (또는 신설 §11): "수정이 버그를 못 고치면, 다시 고치기 전에 레이어를 관찰로 확정"**
- (1) 대상: `.claude/rules/shared/agent-workflow-discipline.md`
- (2) 본문(요지): 보고된 버그를 한 번 고쳤는데 **재현이 그대로면, 같은 증상을 다른 가설로 또 고치지 말 것.** (a) 증거가 기존 가설을 반증하는지 먼저 본다(예: "저장이 안 된다" 가설인데 서버/DB에 값이 있으면 저장 가설은 틀린 것). (b) 데이터가 흐르는 레이어들(저장/전송/표시/입력)을 나열하고 **어느 레이어에서 끊기는지 직접 관찰**(그 순간의 화면·localStorage·서버 3중 확인)로 좁힌 뒤 고친다. 2회 연속 헛수정은 "추측 수정 중"이라는 정지 신호.
- (3) 근거: 본 회고 §4 — 같은 유실 증상을 3회 다른 가설로 헛고침. 클린 트레이스가 "저장 정상(425자)"을 보여 자동저장 가설을 이미 반증했는데도 자동저장만 또 고침.

**후보 B — 동 룰에 "라이브 dogfooding 중 코드 수정 금지 / 디버그 계측의 HMR 오염 주의"**
- (1) 대상: `.claude/rules/shared/agent-workflow-discipline.md`
- (2) 본문(요지): 사용자가 브라우저에서 라이브 재현 중일 때 dev 서버 코드를 수정하면 HMR/Fast Refresh가 컴포넌트를 리마운트시켜 **관찰을 오염**(증상이 내 수정 탓인지 원래 버그인지 분간 불가). 계측·수정은 사용자 재현 **전/후**에만, 재현 중엔 코드 동결. 계측 추가 시 "이 계측이 관찰 대상 동작을 바꾸지 않는가" self-check.
- (3) 근거: 본 회고 §4 — 디버그 로그 HMR이 첫 트레이스를 오염시켜 한 라운드 낭비.

**후보 C — "재현 도구가 그 버그를 재현할 수 있는지 설치 전 self-check"(특히 IME/네이티브 입력)**
- (1) 대상: `.claude/rules/shared/agent-workflow-discipline.md` 또는 `CLAUDE.md`
- (2) 본문(요지): 자동화 재현 도구(Playwright 등)를 설치·도입하기 전, **그 도구가 해당 버그의 트리거를 흉내 낼 수 있는지** 확인한다. IME 조합·네이티브 입력·OS 다이얼로그 등은 헤드리스 자동화로 재현 불가 → 사용자 수동 재현이 유일. 무거운 설치(수십~수백 MB) 전 1줄 self-check.
- (3) 근거: 본 회고 §4 — Playwright 92MB 설치 후 IME 재현 불가 판명.

**사용자 컨펌 전까지 실제 룰 파일 수정 안 함.**
