# 핸드오프 — 016 자동저장 재설계 구현 (speckit-implement 진입용)

**작성:** 2026-06-09 | **브랜치:** `016-autosave-localstorage-redesign` (015에서 분기) | **상태:** spec·plan·tasks 완성, 구현 0%

새 세션이 이 문서 + `tasks.md` 를 읽고 바로 `/speckit-implement` 로 구현을 시작할 수 있도록 정리한다.

---

## 1. 무엇을 만드나 (한 줄)

집필실 자동저장의 **거짓 409 충돌 버그를 근본 제거**하고, **localStorage 작성분 복구**와 **비동기 공동 집필 토대(수정시각 버전 토큰)**를 함께 확보한다. 해결 대상 버그 = [`../015-web-port-frontend/HANDOFF-autosave-conflict.md`](../015-web-port-frontend/HANDOFF-autosave-conflict.md).

## 2. 왜 이렇게 (핵심 결정 — 뒤집지 말 것)

이번 세션에서 사용자와 확정한 결정. 재논의 불필요.

| 결정 | 값 | 근거 |
|---|---|---|
| 동시 편집 모델 | **비동기 공동**(번갈아·구간 분담) 예정 | version 충돌 감지 **제거 금지**(미래 토대). 실시간 OT/CRDT 불필요 |
| version 진실원 | 편집 세션이 **단독 소유**(접근 A) | 거짓충돌 뿌리 제거 — 편집 중 서버 GET 차단 |
| 동기화 시점 | 하이브리드 **멈춤 1.5초 / 상한 10초** | 멈추면 빨리, 계속 써도 10초 상한 |
| 복구 UX | **[복구]/[버리기] 배너** | 명시 사용자 통제 |
| draft 정리 | 동기화 성공분 **다음 진입 시** 정리 | 동기화 직후 크래시 복구 여지(안전) |
| 버전 컬럼 | `Int` → **`updatedAt: Instant` 에 `@Version` 겸용** | 수정시각 = 잠금 토큰. Hibernate `@Version Instant` 지원 **검증 완료**(research R5) |

설계 SoT = [`../015-web-port-frontend/DESIGN-localstorage-autosave.md`](../015-web-port-frontend/DESIGN-localstorage-autosave.md). 산출물 = 같은 016 폴더의 `spec.md`·`plan.md`·`research.md`·`data-model.md`·`contracts/document-endpoints.md`·`quickstart.md`·`tasks.md`.

## 3. 구현 순서 (tasks.md T001~T032)

1. **Phase 1 Setup** (T001) — `useAutoSave` 사용처 grep
2. **Phase 2 Foundational** (T002~T011) — ⚠️ 모든 story 차단. 백엔드 datetime 전환(TDD) + 프론트 API 타입 string + refetch 차단
3. **Phase 3 US1 (P1) 🎯 MVP** (T012~T017) — draftStore + useDocumentSession 코어 + write page 결선 + **거짓충돌 회귀 테스트**
4. **🛑 STOP & VALIDATE** — 여기서 거짓충돌 0 확인(quickstart §2). 핵심 버그 해결 지점
5. **Phase 4 US2** (T018~T022) — 복구 배너 + pagehide flush
6. **Phase 5 US3** (T023~T027) — 진짜 충돌 + draft 보존
7. **Phase 6 Polish** (T028~T032) — useAutoSave·middleware 제거 + 게이트 + dogfooding + HANDOFF/vault 갱신

US2·US3 는 US1 의 `useDocumentSession.ts`·`write/page.tsx` 를 확장(같은 파일) → **US1 GREEN 고정 후** 순차 진행.

## 4. HARD-GATE 주의 (이번 세션에서 축적 — 어기면 회귀)

- **TDD**: 각 모듈 테스트 RED 먼저 → 구현 → GREEN. 한 번에 한 테스트(`CLAUDE.md` §5).
- **⚠️ V8 마이그레이션 적용 = 사용자 컨펌 필수**(외부 DB 안전 HARD-GATE). T006 은 **작성만**, 실제 `flywayMigrate`/적용은 T031 dogfooding 직전 사용자 컨펌 후. spec/plan/tasks 전부 이 게이트 박혀 있음.
- **백엔드 datetime 디테일**: `@PreUpdate` 의 `updatedAt = Instant.now()` **반드시 제거**(수동 set 과 `@Version` 충돌). 저장 후 **flush** 해서 새 `updatedAt` 응답(정수 `+1` 예측 불가). `@Transactional(rollbackFor = [Exception::class])` 배열 인자.
- **ktlint main+test 양쪽**: `ktlintMainSourceSetCheck ktlintTestSourceSetCheck` 둘 다(006 회귀 — test 소스셋 누락).
- **프론트 RSC 경계**: page 작성 후 `pnpm build`(lint 만으론 미검출). `RecoverBanner` 등 이벤트 핸들러 prop → `'use client'` 의무.
- **`client.ts` 409 분기 = `error.code === "DOCUMENT_VERSION_CONFLICT"` 한정**(이메일 중복 409 회귀 가드). status 단독 분기 금지.
- **dev 서버 단독 확인**: 구현 검증 전 `lsof -iTCP:3000 -sTCP:LISTEN` 으로 옛 프로세스 없음 확인(015 HANDOFF 교훈 — stale 서버로 "수정해도 그대로" 오판).
- **subagent "기존 회귀/내 변경 아님" 무검증 수용 금지**: 공용 레이어(`client.ts`·`useDocumentSession`) 변경 시 직접 재현 후 판단.
- **빌드/테스트 = 포어그라운드**(`run_in_background=false`) — 결과 직접 확인 후 다음 진입.

## 5. 검증 안 된 잔여 단서 (참고)

015 HANDOFF §3 의 "편집 중 document GET 이 ~1초마다 반복되는 원인"은 **끝내 관찰로 규명되지 않았다**(가설 a~d 미검증). 접근 A(편집 중 refetch 완전 차단)가 그 트리거를 **구조적으로 덮지만**, US1 구현 시 `useDocumentSession` 이 진입 1회 로드 후 정말 추가 GET 이 안 나가는지 DevTools Network 로 1회 확인 권장(새 구조에 트리거가 따라오지 않는지). 근본 차단이면 원인 규명 없이도 해결.

## 6. 커밋 상태

이 시점 016 산출물(spec·plan·tasks·research·data-model·contracts·quickstart·본 HANDOFF) + 015 `DESIGN-localstorage-autosave.md` + `CLAUDE.md`(SPECKIT 마커 016 추가)는 **커밋 여부를 핸드오프 시점에 결정**(아래 §프롬프트 참조). 새 세션은 `git log --oneline -5` + `git status` 로 먼저 확인.

## 7. 완료 정의 (Definition of Done)

- T030 전체 게이트 GREEN: frontend `pnpm test && pnpm build` + backend `ktlint(main+test) checkstyle test build`
- T031 브라우저 dogfooding: 거짓충돌 0 / 복구 / 진짜충돌 / 한국어 IME 4케이스 (V8 적용 컨펌 후)
- T032: 015 `HANDOFF-autosave-conflict.md` 에 해결 기록 + vault `02-PROGRESS.md`·`03-ISSUES.md` 갱신
- `useAutoSave`·`middleware.ts` 제거 확인
