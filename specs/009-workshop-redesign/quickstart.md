# Quickstart — 작업실 디자인 고도화 검증

## 환경

```bash
# node:sqlite 는 Node 24 필요
export PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH"
cd desktop
```

## 자동화 게이트 (포어그라운드 의무)

```bash
pnpm test       # 기존 102 + 신규(고정 backend / 재진입 선정 / lastSentence / 모달 / 붙이기) GREEN
pnpm typecheck  # 타입(ProjectMemo / IPC 확장) 정합
pnpm build      # Vite/Electron 빌드
```

## dogfooding 시나리오 (실제 Electron 창 — `pnpm dev`)

US 별 수동 검증(핸드오프 게이트 = design doc 승인 후 구현, 구현 후 dogfooding):

1. **US1 작품 벽**: 작품 목록에서 카드 얼굴이 마지막 문장인지, 날짜/카운터 지표가 카드 표면에 없는지, 카드 클릭 시 집필 진입.
2. **US2 서랍형 집필실**: 진입 직후 종이가 주영역 + 저장상태/글자수 외 조작이 접힌 "보기" 메뉴 1개인지, 재진입 한 장이 펼쳐지는지, 곁 쪽지 서랍이 닫힘 기본인지.
3. **US3 쪽지 책상**: 통계 패널/전체·미연결 필터가 없는지, 쪽지 본문 중심인지, 안 붙은 쪽지 붙이기가 즉시 반영(1초 이내)인지.
4. **US4 잉크 한 방울**: 빠른 메모 진입점이 "캡처"로 읽히는지, 모달 입력 중 닫기 시 초안 보존, 닫은 뒤 직전 포커스 복귀, 집필 중 현재 작품 연결.
5. **US5 접근성**: 라이트·다크 보조/placeholder 대비 AA, 키보드 포커스 가시성.
6. **US6 고정**: 한 작품 쪽지 고정 → 그 작품 재진입 시 고정 쪽지가 재진입 한 장으로, 고정 해제 시 fallback(최근연결→최근캡처), 다른 작품에서 같은 쪽지 고정은 독립, 연결 해제 시 고정 소멸.

## 회귀 가드

- 한국어 IME 본문 입력 4케이스(PoC 0-1) 재검 — WriteStudioScreen/Editor 변경 시.
- 메모 연결 optimistic(직전 fix `893f0e7`) 유지 — 붙이기/고정 즉시 반영.
- 마이그레이션 v4→v5: 기존 DB 에 pinned 컬럼이 DEFAULT 0 으로 더해지고 기존 연결/고정 무손실.

## 성공 기준 매핑

SC-001~008 은 위 dogfooding 1~6 + 자동화 게이트로 검증. SC-007(critique P1 0건)은 구현 후 `impeccable critique desktop app` 재실행으로 확인.
