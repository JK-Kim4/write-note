# Quickstart: iOS 입력 PoC 검증

## Phase A 게이트 (양보불가 핵심 — 사용자 실기기)

iOS 입력 어댑터 최소 구현 후, 배포본을 **iPhone Safari**로 접속해 확인:

1. 집필실(또는 PoC 라우트) 진입 → 키보드가 뜨고 새 문단에 커서
2. 한글 입력: `안녕하세요 받침 테스트입니다`
   - **확인 A**: 입력한 글자가 정확히 화면에 표시(자체 렌더)
   - **확인 B**: 받침 재조합 정확 — 예: `갑` 입력 후 모음 추가 시 의도대로 분해/조합
   - **확인 C**: 빠른 타자 시 자모 누락/순서 꼬임 없음(025 케이스 1)
   - **확인 D**: Backspace로 조합 중 자모 한 개 삭제 정상(025 케이스 4)
3. **데스크탑 무회귀**: Chrome에서 기존처럼 입력 — 동작 변화 없음

**통과 기준**: 확인 A~D 모두 OK → Phase B 진행. 하나라도 실패 → research.md Decision 3·4 재검토(투명 proxy vs 조합 표시, composition 흐름).

## 자동 검증(무회귀)

```bash
cd frontend && npx vitest run   # 기존 + 어댑터 단위테스트 GREEN
cd frontend && npx tsc --noEmit && npx next build
```

데스크탑 EditContext 경로를 어댑터로 추출한 뒤 위 게이트가 GREEN이면 무회귀.

## Phase B~C 확인(실기기)

- 편집: 선택→굵게, Enter 분할, 목록 전환, 붙여넣기 서식 보존, undo
- 자동저장: 입력 후 메뉴 이동 → 작성분 보존(거짓 충돌 없음)
- 반응형: 모바일 폭에서 헤더 가로 스크롤(왼쪽 슬라이드) 없음

## Phase D(정리)

iOS 입력 확인 후 안내 배너 제거 / viewport minimum-scale 재검토.
