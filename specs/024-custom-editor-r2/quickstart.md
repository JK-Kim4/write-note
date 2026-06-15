# Quickstart — 자체 에디터 엔진 2라운드 (실행·검증)

## 1. 풀스택 실행 (dogfooding 환경)

자체 엔진이 `/api/documents`에 저장하므로 풀스택 필요. local profile, 외부 시크릿 불필요.

```bash
# 1) DB (공유 docker — 이미 떠 있을 수 있음)
docker compose up -d --wait postgres
# 2) backend (백그라운드)
cd backend && ./gradlew bootRun --args='--spring.profiles.active=local'   # :8080
# 3) frontend (워크트리에서, 백그라운드)
cd frontend && pnpm dev                                                    # :3000, Chrome/Edge 121+
```

- **테스트 계정(공유 DB 영속)**: `custom-r1@writenote.local` / `dogfood1234`
- **테스트 작품**: id `3537` · 빈 챕터
- **진입**: 로그인 → `http://localhost:3000/b/works/3537/custom`
- ⚠️ **프레시 테스트 챕터에서만**(변환기가 미지원 서식 평탄화). 마크 왕복 점진 확장.

## 2. 순수 테스트 게이트 (Vitest)

```bash
cd frontend && pnpm exec vitest run src/components/custom-editor
```
- 1라운드 115 GREEN 유지 + 2라운드 추가(model 마크 연산·blockRuns 정규형·pmConvert 마크 왕복·measure run 그룹핑·affinity 산술).
- 타입: `pnpm exec tsc --noEmit`. RSC 경계: `pnpm build`(dev 서버와 경합 주의).

## 3. 무회귀 게이트

```bash
cd frontend && pnpm exec vitest run src/app/b   # 기본 B형 page.test 7 GREEN(SC-008)
```
- 1라운드 기능(저장·분할·목차·undo·클립보드·IME) 수동 무회귀 확인(SC-007).

## 4. 마크 dogfooding 체크리스트 (헤드리스 불가 — 사용자)

**US1 부분 마크(P1, 양보 불가 핵심 — 먼저 통과)**:
1. 한 줄 일부 드래그 선택 → Cmd+B → 그 구간만 굵게 렌더.
2. 굵은 구간 뒤로 타이핑해 wrap 유발 → 줄바꿈 위치·캐럿·클릭 hit-test 드리프트 없음.
3. italic/underline/strike 각각 동일 확인. 밑줄·취소선은 폭 불변(줄바꿈 안 변함).
4. 자동저장 후 새로고침 → 부분 마크 동일 복원(왕복 무손실).
5. 마크 구간 가로질러 삽입·삭제 → 구간 정확히 추종.

**US2 보류 마크·툴바(P2)**:
6. 빈 위치에서 Cmd+B → 타이핑 → 굵게 들어감. Cmd+B 다시 → 평문.
7. 마크 구간 안/밖 캐럿 이동 → 툴바 버튼 활성 표시 전환.
8. 굵은 구간 한가운데 타이핑 → 마크 이어받음.

**US3 affinity(P3)**:
9. wrap되는 긴 줄에서 End → 캐럿 앞 줄 끝. 다음 줄 시작 이동 → 다음 줄 머리. 경계 캐럿 튐 없음.

**IME(1라운드 회귀룰)**:
10. 한글 조합 중 Cmd+B → 조합 안 깨짐(`code-quality.md` 4케이스: 빠른타자·조합중 토글·한자·Backspace 분해).

## 5. CDP(선택, 로컬 스크립트)

혼합 스타일 줄에서 클릭 캐럿 정확·`caretRangeFromPoint` diff 0·드래그 선택·마크 렌더 — 1라운드 CDP 패턴 재사용.

## 6. 격리 / 안전

- 작업은 워크트리 `write-note-024-custom-editor`에서만. 메인 repo(023-export 미커밋) 비접촉.
- 백엔드/DB/마이그레이션 변경 0. 로컬 dev DB 쓰기 없음.
- 자체 엔진은 `custom-editor/`·`BStudioShell`·`/custom` 라우트만 건드림.
