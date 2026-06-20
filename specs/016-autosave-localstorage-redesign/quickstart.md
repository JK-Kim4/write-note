# Quickstart — 자동저장 재설계 검증

본 기능의 수용 기준(spec SC-001~006)을 자동화 테스트 + 브라우저 dogfooding 으로 검증하는 절차.

## 0. 사전 조건

- backend `:8080` + frontend dev `:3000` 기동. **dev 서버 단독 확인**(`lsof -iTCP:3000 -sTCP:LISTEN` — 옛 프로세스 없음, 015 HANDOFF 교훈).
- dogfood 로그인(`dogfood@writenote.local` / `Dogfood1234!`).
- 백엔드 마이그레이션 `V8` 적용은 **사용자 컨펌 후**(외부 DB 안전 룰). 적용 전엔 datetime version 계약이 동작하지 않음에 유의.

## 1. 자동화 테스트 (TDD GREEN)

```bash
# 프론트
cd frontend && pnpm test src/lib/draftStore.test.ts src/hooks/useDocumentSession.test.ts
cd frontend && pnpm build   # RSC 경계 검출(write page 결선 변경)

# 백엔드 (dev 서버 끄고 — .next/DB 경합 회피)
cd backend && ./gradlew test --tests "*DocumentServiceTest*"
cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test
```

기대: draftStore 단위 GREEN, useDocumentSession 행위(거짓충돌 회귀 포함) GREEN, performSave datetime 충돌/flush GREEN.

## 2. P1 — 거짓 충돌 없는 자동저장 (SC-001, SC-003)

1. 작품 열기 → `/projects/{id}/write`.
2. 한국어 본문 **연속 타자**(IME 조합 중 빠른 입력 포함). → 입력 즉시 반영, 타자 중 끊김 없음(SC-003).
3. 다른 화면(작품 벽/메모)으로 이동 후 그 작품 **재진입** → 다시 타자.
4. **기대**: ConflictDialog 0회, 저장 표시 "저장됨" 유지(SC-001). (DevTools Network: 실패 PUT 없음.)
5. **연속 타자 10초 이상 지속** → 멈추지 않아도 10초 안에 PUT 1회 발생(SC-004, Network 탭 확인).

## 3. P2 — 작성분 복구 (SC-002)

1. 본문 입력 직후(동기화 전, ~1.5초 내) **탭 강제 종료**.
2. 같은 작품 재진입 → **복구 배너** "저장되지 않은 변경이 있습니다 [복구]/[버리기]" 노출.
3. [복구] 선택 → 직전 입력이 에디터에 그대로 복원(SC-002).
4. 다시 같은 절차로 [버리기] 선택 → 서버 최신 본문 유지, draft 제거 확인.

## 4. P3 — 진짜 충돌 감지 (SC-005, SC-006)

1. 한 작품 문서를 서버에서 먼저 변경(별도 PUT 또는 다른 세션) → `updatedAt` 전진.
2. 이전 토큰을 들고 있던 편집 세션이 저장 시도 → **ConflictDialog** 노출(SC-005).
3. 그 시점까지의 미동기화 작성분이 보존됨을 확인(SC-006): [다시 불러오기] 후에도 작성분이 draft 에 남아 복구 가능.
4. 변경이 없을 때는 충돌이 발생하지 않음을 P1 으로 교차 확인(진짜 충돌만 선별).

## 5. 한국어 IME 회귀 (HARD-GATE)

저장 로직 변경이 조합 입력을 깨지 않는지 PoC 0-1 4케이스 재사용:
1. 빠른 타자(조합 중 다음 자모) 2. 조합 중 bold 토글 3. 한자 변환 4. Backspace 분해. → 4케이스 모두 정상, 자동저장 트리거와 무관하게 IME 안정.

## 6. 정리 (구현 완료 후)

- `frontend/src/middleware.ts` + `[DBG-DOC]` 로깅 제거 확인.
- `useAutoSave.ts`/`useAutoSave.test.ts` 제거 확인(`grep -rn "useAutoSave" frontend/src` 결과 없음).
- 015 `HANDOFF-autosave-conflict.md` 에 해결 기록 + vault `03-ISSUES` 갱신.
