# Desktop Phase 6 — 메모↔작품 다대다 연결 + 집필 사이드 패널 (SDD 풀파이프 2회차)

- 일자: 2026-06-06
- 워크트리 / 브랜치: main repo / `develop` (작업은 `008-phase-6-memo-linking-side-panel` 에서 → merge 후 브랜치 삭제)
- 관련 커밋: `d34b8eb`(feat) → `aad06d7`(merge) → `ee19683`(fix) → `559fa5e`(docs)
- GitHub: 이슈 #33(Phase 6) 생성·close·보드 Done. #32(Phase 5) 갭 백필
- 작업 시간 (대략): 컨텍스트 수집 → 브레인스토밍 → SDD 풀파이프(specify→plan→tasks→analyze→implement) → dogfooding → 픽스 → merge → 문서/이슈 갱신

## 1. 무엇을 했는가 (사실)

- 메모↔작품 **다대다 연결** 도입: 연결 테이블 `memo_projects`(STRICT, PK, 양쪽 ON DELETE CASCADE) 신설. 스키마 v3→v4 — 기존 `linked_project_id` 단일 연결을 연결 행으로 보존 이관 후 `DROP COLUMN`.
- `MemoRepository`: `addLink`(INSERT OR IGNORE 멱등)/`removeLink`/`listByProject` 신설 + `list`·`getById` 의 `linkedProjectIds` 집계, 단수 `link` 제거.
- `Store.captureMemo` 트랜잭션(캡처+연결 원자 생성, FK 위반 시 롤백) 신설. IPC/preload 신규 채널 결선, `memos.link` 제거.
- renderer: `LinkPopover`(체크리스트 팝오버) 신설, `MemoInboxScreen` 연결 버튼·칩 복수/✕, `MemoPanel` 더미 제거 후 `listByProject` 실데이터+패널 내 해제, `App` 패널 상태(`listByProject`)·`WriteStudioScreen` props 교체, `memoView` 복수 매핑.
- 마이그레이션 리스크(DROP COLUMN·INSERT OR IGNORE+FK)를 node:sqlite 로 **실측 검증** 후 진행.
- TDD: 신규 25 테스트 추가(baseline 75 → 100), tsc·vite build GREEN, 회귀 0.
- dogfooding 발견 2건 fix: 팝오버 stacking(`z-index`) + 패널 갱신(`screen` 의존).
- 문서: spec/plan/tasks/research/contracts/data-model/quickstart, `docs/phase/06/README.md` 제외 정정, `docs/STATUS.md`·vault `02-PROGRESS.md` 완료 반영, 브레인스토밍 design 문서.
- GitHub: Phase 5·6 완료 이슈 백필(#32·#33) + 보드 Done.

## 2. 어떻게 했는가 (접근)

- 사용자 요청대로 **브레인스토밍 → speckit 풀파이프**로 진행. 브레인스토밍에서 상호작용 4결정(연결 진입점·팝오버·패널 성격·다중연결 포함)을 1문 1답으로 확정.
- **다중 연결**은 사용자가 브레인스토밍 중 분기로 제시 → `docs/phase/06` 의 "제외" 전제 및 단일 연결 스키마와 충돌함을 즉시 surfacing하고, 컨셉 문구로 막지 않고 데이터 모델 영향(연결 테이블·파급)을 제시한 뒤 사용자 결정으로 범위 확장.
- 마이그레이션 `DROP COLUMN` 가용성을 추측하지 않고 node:sqlite 로 실측(SQLite 3.51.2, FK=ON OK) → 작업 지시서가 남긴 "테이블 재생성 대비책"을 불요로 확정.
- analyze 에서 발견한 C1/C2(작품삭제 cascade·복원 시 연결 복귀) 자동 테스트를 implement 중 보강.
- 구현은 메인 세션에서 직접(subagent 위임 없이) — 컨텍스트 보존 + 포어그라운드 게이트 확인 우선.

## 3. 잘 된 점

1) **추측 대신 실측** — DROP COLUMN/FK·`INSERT OR IGNORE`+FK 동작을 코드로 확인 후 결정. "테이블 재생성"이라는 불필요한 복잡도를 사전에 제거(근거: research R2 실측 로그).
2) **컨셉 문구로 사용자 요구를 막지 않음** — 다중 연결이 README "제외"였지만, [[product-concept-not-fixed]] 교훈대로 막지 않고 영향 범위 제시 후 사용자 결정. Phase 4 의 "자동영속 본질 단정" 회귀를 반복하지 않음.
3) **SDD 풀파이프 + analyze 가 실제로 갭을 메움** — C1/C2 커버리지 갭을 analyze 가 잡아 테스트로 보강(근거: analyze 리포트 C1·C2 → 보강 테스트 통과).
4) **회귀 0 + 100 GREEN** — baseline 75 대비 +25, 기존 테스트 깨짐 0. 마이그레이션·다대다 전환처럼 파급 큰 변경에도 게이트 통과.

## 4. 어긋난 점

- **dogfooding 에서만 잡힌 결함 2건 — 자동화 게이트로 안 잡힘:**
  1. **연결 팝오버가 다음 메모 카드 뒤로 깔림** — 절대배치 팝오버를 `.screen-main`(overflow 스크롤) 안에서 띄우면서 열린 카드를 형제 위로 올리지 않음. CSS stacking 결함이라 vitest(행위)·tsc·build 어디서도 안 잡힘. **회피 가능 시점:** `LinkPopover` 스타일 작성 시 "스크롤/overflow 컨테이너 안 절대배치 오버레이는 형제 위 stacking 확인" 자가 점검.
  2. **메모 연결 후 레일로 집필 진입 시 패널 미갱신** — 패널 재조회 deps 가 `[activeProject, memoRefresh]` 뿐이라, Inbox 연결 변경(=memoRefresh 미증가)+레일 화면 전환(=deps 무변동) 시 stale. **회피 가능 시점:** plan/contracts 의 FR-009 "재진입 시 반영"을 구현할 때 "같은 작품을 화면 전환으로 다시 들어오는 경로"를 deps 로 추적했어야. 나는 "재진입 = activeProject 변경"으로만 좁게 해석함.
- **이 패턴은 Desktop 3연속 재발** — Phase 3(preload sandbox), Phase 4(IME 조합 guard), Phase 6(stacking+패널 갱신) 모두 **renderer 통합/시각 결함이 dogfooding 에서만 표면화**. 자동화 게이트(단위·타입·빌드)의 사각이 일관되게 같은 영역.
- **GitHub Phase 이슈 갭** — Phase 5·6 작업 중 추적 이슈가 없었음(Phase 0~4 는 있었는데). 완료 후 사용자 요청으로 백필. 프로세스 누락.
- 사용자 **멈춤 신호 0** — 슬래시 커맨드로 주도, 결정은 명확. 다중연결 분기도 매끄럽게 합의. 재시도/디버깅 루프 0(픽스 2건은 dogfooding 피드백 기반 1발 수정).

## 5. 다음 작업에 남길 교훈

### 5-1. 작업별 교훈 (이 프로젝트 한정)

- **절대배치 오버레이(팝오버/드롭다운/메뉴/툴팁)** 작성 시: ① `overflow:auto/hidden` 스크롤 조상 안에서 잘리는지, ② 형제 카드/항목 위로 stacking 되는지(열린 항목 z-index) — 작성 즉시 dogfooding 점검. 자동화 게이트로 안 잡힘.
- **화면(screen) 전환으로 같은 엔티티에 재진입**하는 패널/뷰의 데이터 재조회는, "엔티티 id 변경"뿐 아니라 **"화면 진입" 자체를 재조회 트리거(effect deps)** 로 포함했는지 확인. "재진입 = id 변경"으로 좁게 해석하면 같은 id 재진입이 stale.
- Desktop renderer phase 는 **dogfooding 이 사실상 유일한 통합/시각 검증 게이트** — 자동화 GREEN ≠ 완료. 시각·화면전환·IPC 첫호출 영역은 dogfooding 전제로 둔다.

### 5-2. 룰 갱신 후보 (사용자 컨펌 필요)

**후보 1 — `.claude/rules/typescript/code-quality.md` 의 "한국어 영역 검증 cadence" 처럼, "Renderer dogfooding-only 결함 cadence" 섹션 신설**
- (1) 대상 파일: `.claude/rules/typescript/code-quality.md` (또는 `agent-workflow-discipline.md` 에 항목 추가)
- (2) 룰 본문:
  - 절대배치 오버레이(팝오버/메뉴/드롭다운) 신설 시 — 스크롤/overflow 조상 clipping + 형제 위 stacking(열린 항목 z-index) dogfooding 점검 의무.
  - 화면 전환으로 같은 엔티티 재진입하는 뷰의 데이터 재조회 — effect deps 에 "화면 진입" 트리거 포함 확인(id 변경만으로 부족).
  - 본 cadence 는 자동화 게이트(vitest/tsc/build)가 못 잡는 영역 — Desktop renderer phase 완료 판정 전 dogfooding 의무.
- (3) 근거 회귀: 본 회고 §4 — Phase 3 preload sandbox / Phase 4 IME guard / Phase 6 팝오버 stacking·패널 갱신 (3연속 동일 영역 재발).

**후보 2 — Phase 추적 GitHub 이슈를 phase 시작 시 생성 (프로세스, 룰화는 선택)**
- (1) 대상: (룰 파일보다는) 워크플로우 관행 — 필요 시 `CLAUDE.md` 에 1줄.
- (2) 본문: Desktop Phase 진입 시 GitHub 추적 이슈 생성, 완료 시 close + 보드 Done. (Phase 0~4 는 했으나 5·6 누락)
- (3) 근거: 본 회고 §4 — Phase 5·6 이슈 갭, 사후 백필.

**사용자 컨펌 전까지 실제 룰 파일 수정 안 함.**
