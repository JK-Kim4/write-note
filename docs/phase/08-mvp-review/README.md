# Phase 8: Desktop MVP Review Gate

## 목표

첫 desktop MVP가 다음 개발 단계로 넘어갈 준비가 되었는지 판단한다.

## 범위

- MVP 성공 기준 체크리스트 작성.
- 실제 사용 중 마찰 기록.
- Phase 2 우선순위 결정: 원고지 모드 vs richer memo curation.
- WEB track 재개 조건 재판단.
- blocker와 non-blocker 이슈 분리.

## 제외

- review 없이 새 기능 착수.
- 원고지 모드 즉시 구현.
- WEB track 무조건 재개.
- 실제 사용 기록 없는 추측 기반 우선순위 결정.

## 작업 지침

1. Phase 7 dogfooding 결과를 먼저 읽는다.
2. prototype 완료 조건을 하나씩 체크한다.
3. blocker와 불편하지만 사용 가능한 이슈를 분리한다.
4. 다음 phase 후보를 하나로 좁힌다.
5. WEB track을 계속 block할지, 일부 재개할지 판단 근거를 남긴다.
6. 회고 문서 또는 review 문서에 결과를 남긴다.

## 완료 기준

- 사용 가능한 prototype 상태인지 명확히 판정한다.
- 다음 phase 1순위가 문서로 남는다.
- 발견된 이슈가 추측이 아니라 실제 사용 기록 기반으로 정리된다.

## 검증

- `docs/retrospectives/` 또는 별도 desktop review 문서에 결과 기록.
- blocker / non-blocker 이슈 분리 확인.

## 권장 커밋

```bash
git commit -m "docs: review desktop MVP prototype"
```
