# Quickstart: 빠른 메모 캡처 + Inbox 검증

## 환경

- Node 24.14.0 + corepack pnpm 8.15.5 (`desktop/`)
- 게이트는 `node_modules/.bin/{vitest,tsc,vite}` 직접 실행(corepack 최신 pnpm lockfile 충돌 회피), **포어그라운드**

## 자동화 게이트 (구현 중/후)

```bash
cd desktop
node_modules/.bin/vitest run        # 단위·컴포넌트 테스트 (TDD)
node_modules/.bin/tsc --noEmit      # 타입 게이트
node_modules/.bin/vite build        # 빌드 게이트
```
- 회귀 0 기준: Phase 1~4 기존 테스트(스키마/repository/projectView/ProjectsScreen 등) GREEN 유지.
- 특히 `projectView.test.ts`는 상대시간 공용 추출(R4) 후에도 GREEN이어야 한다.

## preload smoke test (agent-workflow §8)

renderer가 신규 IPC를 처음 호출하기 전, 콘솔/임시 코드로 1회 확인:
```js
typeof window.electronAPI.memos.delete === "function"   // true
typeof window.electronAPI.memos.restore === "function"  // true
```
preload 빌드 포맷/sandbox 정합 회귀(Phase 3 이력)를 renderer 첫 호출 전에 차단.

## dogfooding 시나리오 (사용자 수동 — 완료 기준 SC 대응)

1. **캡처(모달)** — 작품을 열지 않은 상태에서 Rail 캡처 버튼 → 본문 입력 → 저장. 메모 화면에서 맨 위 + "미연결" 확인. *(SC-001/002, FR-002/006)*
2. **빈 본문** — 모달/인라인에서 공백만 입력 후 저장 시도 → 저장 안 됨. *(FR-003)*
3. **자동 연결** — 작품 A를 열어 집필 중 Rail 캡처 → 저장 → 메모 화면에서 그 메모에 "작품 A" 제목 표시. *(SC-003, FR-004/008)*
4. **인라인 캡처** — 메모 화면 상단 입력란에 한 줄 → 추가 → 목록 맨 위 반영. *(FR-002)*
5. **필터** — 연결/미연결 섞인 상태에서 "미연결" → 미연결만, "전체" → 모두. *(SC-004, FR-007)*
6. **soft delete + 되돌리기** — 메모 삭제 → 즉시 사라짐 + 토스트 → "되돌리기" → 복원. *(FR-009~011)*
7. **삭제 지속** — 삭제 후 토스트 사라짐 → 어느 필터에도 안 보임 → 앱 재시작 → 여전히 안 보임. *(SC-005, FR-012)*
8. **재시작 복원** — 캡처/연결/삭제 후 재시작 → 상태 일치(삭제 안 된 메모 복원, 삭제분 비노출). *(SC-006, FR-013)*
9. **한글 IME** — 모달 textarea에 한글 조합 입력(빠른 타자) 시 자모 분리 없는지 확인(단순 textarea라 PoC 0-1 의무 아님, 육안 확인).
10. **연결 작품 삭제 교차** — 연결된 메모가 있는 작품을 삭제 → 그 메모가 "미연결"로 보존(사라지지 않음). *(Edge Case)*

## 완료 판정

- 자동화 게이트 GREEN + 회귀 0.
- dogfooding 1~10 통과(사용자 확인).
- 통과 시 develop merge + vault `02-PROGRESS.md` Phase 5 완료 반영 + `docs/desktop-mvp-progress.html` 갱신.
