# Quickstart: 에디터·원고지 + 메모 캡처 (로컬 dogfooding)

**Branch**: `006-phase-3-4-editor-memo`

본 spec 의 산출물을 로컬에서 직접 써보는 진입 절차. 라운드(R-16) GREEN 후 사용자 dogfooding 영역.

---

## 0. 사전 (HARD-GATE — DB)

```bash
# 로컬 postgres 기동 (write-note 프로젝트 볼륨)
docker compose up -d --wait postgres
```

- **V6 마이그레이션 적용은 사용자 명시 컨펌 후**(`.claude/rules/infra/external-infra-safety.md`). boot 시 Flyway 자동 적용 = 컨펌 영역. 작성·리뷰는 자유.

## 1. backend 기동

```bash
cd backend
./gradlew bootRun --args='--spring.profiles.active=local'
# V6(memos/memo_projects/memo_project_characters/api_tokens) 적용 확인
```

## 2. frontend 기동

```bash
cd frontend
pnpm dev   # http://localhost:3000 (same-origin 프록시 → backend)
```

---

## 3. 검증 시나리오 (라운드별)

### R1 — 본문 작성 + 자동 저장 (US1 P1, MVP)
1. 로그인 → 홈 → 프로젝트 진입 → `/write?projectId=N`
2. 에디터에 한국어 본문 입력 → 800ms 후 자동 저장(네트워크 탭 `PUT /api/documents/{id}` 200)
3. 새로고침 → 마지막 내용 복원(SC-001)
4. **한국어 IME 4 케이스**(빠른 타자/조합 중 ⌘B/한자 변환/Backspace) 깨짐 0(SC-002)
5. 자수/진행률 ring 갱신 확인
6. (충돌) 두 탭에서 동시 편집 → 한쪽 저장 후 다른쪽 저장 시 "다시 불러오기/덮어쓰기" 선택 UI(FR-006)

### R2 — 원고지 (US2 P2)
1. 설정 → 작성 모드=원고지, 크기=400 → `/write` 격자/마커/행번호 표시
2. 글 입력 → 매수 표시
3. 크기 200 변경 → 글 유실 없이 재배치 + 매수 재계산(SC-006). **한글 칸 정렬 육안 확인**(라이트/다크)

### R3 — 캡처 (US3 P2)
1. 데스크탑: ⌘+N → 본문 입력 → 저장 → inbox 도착, 활성 프로젝트 기록
2. 모바일(또는 curl): `POST /api/capture` + `Authorization: Bearer wnt_...` + `Idempotency-Key` → inbox 도착(source=MOBILE)
3. 같은 Idempotency-Key 재요청 → inbox 1건만(SC-007)

### R4 — 큐레이션 (US4 P3)
1. inbox 미분류 메모 → 두 프로젝트 연결 + 인물(합집합) + 태그 + 이유 → 저장
2. 각 프로젝트 필터에서 모두 보임(SC-005), 미분류 필터에서 사라짐
3. 한 프로젝트 연결 해제 → 그 프로젝트 인물 연결도 정리(clarify Q2)

### R5 — 토큰 (US5 P3)
1. 설정 → 토큰 발급 → 원본 1회 표시(복사) → 새로고침 시 원본 미표시(FR-021)
2. 그 토큰으로 R3 모바일 캡처 성공
3. 토큰 해지 → 같은 토큰 캡처 거부(SC-008)

---

## 4. 검증 게이트

```bash
# backend
cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build
# frontend
cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

둘 다 GREEN + 003/004/005 회귀 GREEN 의무.

## 5. iOS Shortcut (사용자 실기기 영역 — R-15)
- 발급 토큰으로 iOS Shortcut: `POST https://<backend>/api/capture`, 헤더 `Authorization: Bearer wnt_...`, body `{ "body": "<공유 텍스트>" }`. 본인 1대 셋업·동작 확인(DESIGN.md 159).
