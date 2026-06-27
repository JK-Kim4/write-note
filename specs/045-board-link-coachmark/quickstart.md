# Quickstart / Dogfooding 게이트: 보드 "끌어서 잇기" 코치마크

시각·hover·캔버스 상호작용은 jsdom 미검증(룰 14·25) → **아래 전항을 사용자가 확인한 뒤에만 통과 단정**.

## 환경 (authed 로컬 풀스택 — 메모리 [[local-dogfooding-needs-backend]])

```bash
# 1) DB
docker compose up -d --wait postgres
# 2) BE
cd backend && ./gradlew bootRun --args='--spring.profiles.active=local'
# 3) FE (worktree)
cd frontend && pnpm dev   # → http://localhost:3000
```

> ⚠️ 코치마크 "봤음"은 localStorage 기억 → 재현하려면 DevTools Application → Local Storage 에서 `writenote.board.coachmark.v1` 삭제 후 새로고침.

## 체크리스트 (전항 = ISSUE-051 잔여 종료 조건)

### 핵심 — "끌어서 잇기" 1회성
- [ ] localStorage 비운 상태로 보드 진입 → 카드 연결점에 **처음** 커서 올림 → **그 점에서** "끌어서 잇기" 나타남.
- [ ] 본 뒤(같은 점/다른 점/다른 카드) 다시 hover → 텍스트 **안 뜸**, 연결점만.
- [ ] 새로고침·다른 보드 진입 후에도 **안 뜸**(영속).

### 네 방향 자연스러움
- [ ] 위/오른쪽/아래/왼쪽 연결점 각각에서 라벨이 그 방향으로 자연스럽게 나옴(목업 정합).

### 비차단 / 무회귀
- [ ] 라벨 떠 있는 상태에서 그 점에서 **곧바로 드래그해 잇기** 성공(라벨이 안 막음).
- [ ] 잇기 4경로(드래그 유효 drop·빈 곳 drop 새 카드·클릭-클릭·중복 무시) 무회귀.
- [ ] 카드 종류 칩 부여/해제·삭제 버튼·선택 인디케이터·드래그/뷰포트 무회귀.

### 범위
- [ ] 집필 참조 패널(집필 화면 → 보드 참조 슬라이드오버)에서도 동일 동작.
- [ ] 홈 온보딩(driver.js)과 충돌·중복 없음.
- [ ] "이건 뭔가요?"(카드 선택 종류 안내)는 **안 나옴**(범위 밖, FR-008).

## 자동 게이트(별도, 사용자 확인 불요)
- [ ] FE `pnpm typecheck && pnpm lint && pnpm test && pnpm build` GREEN.
- [ ] 순수 단위 TDD: `boardCoachmark`(seen·마크·손상 화해·저장소 부재) / `linkHintPlacement`(4 앵커).
