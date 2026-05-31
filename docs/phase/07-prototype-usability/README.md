# Phase 7: Prototype Usability Pass

## 목표

프로토타입을 실제 글쓰기 세션에 사용할 수 있을 정도로 정리한다.

## 범위

- Focus Studio visual pass.
- empty/loading/error 상태 정리.
- keyboard focus와 기본 단축키 정리.
- data loss 가능성이 있는 흐름 점검.
- 앱 재시작/창 닫기/저장 중 종료 상황 확인.
- README 또는 quickstart 문서 작성.

## 제외

- 새 기능 추가.
- 원고지 모드 선행 구현.
- 디자인 전면 재작성.
- 서버 동기화.
- 배포 자동화.

## 작업 지침

1. 새 기능을 추가하지 말고 사용 가능성 문제만 정리한다.
2. 저장 중 종료, 앱 재시작, 빈 데이터 상태를 직접 확인한다.
3. 버튼/입력 focus가 키보드 사용에 방해되지 않게 한다.
4. quickstart는 처음 실행하는 사람이 따라할 수 있을 정도로만 작성한다.
5. 실제 10분 이상 글쓰기 세션으로 검증한다.
6. 발견된 마찰은 phase 8 review 후보로 기록한다.

## 완료 기준

- 처음 실행한 사용자가 프로젝트 생성부터 글 작성, 메모 캡처, 메모 연결까지 막히지 않는다.
- 앱 재시작 후 프로젝트, 본문, 메모가 모두 복원된다.
- 저장 실패나 DB 초기화 실패 시 화면이 완전히 깨지지 않는다.
- 최소 quickstart 문서만 보고 앱을 실행할 수 있다.

## 검증

```bash
cd desktop
pnpm test
pnpm typecheck
pnpm build
```

수동 dogfooding:

- 실제 프로젝트 하나 생성.
- 10분 이상 본문 작성.
- 중간에 memo 3개 캡처.
- memo 1개 이상 project에 연결.
- 앱 종료 후 재실행.
- 모든 데이터 복원 확인.

## 권장 커밋

```bash
git commit -m "chore(desktop): prepare usable prototype"
```
