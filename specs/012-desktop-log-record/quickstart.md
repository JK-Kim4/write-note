# Quickstart: Desktop 기록(Log)

## 환경 (필수 선행)

셸 기본 Node 가 v20 이면 `node:sqlite`(Node 24 필요)가 없어 테스트/빌드가 깨진다. **PATH 선행**:

```sh
export PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH"
cd desktop
```

## 검증 명령 (TDD 사이클)

```sh
# 단위/통합 테스트 (포어그라운드 실행 의무 — CLAUDE.md 작업 실행 지침)
node_modules/.bin/vitest run

# 특정 파일만
node_modules/.bin/vitest run electron/db/workSessionRepository.test.ts

# 타입 + 빌드 게이트
node_modules/.bin/tsc --noEmit
node_modules/.bin/vite build
```

> corepack 최신 pnpm 의 lockfile 충돌 회피를 위해 `node_modules/.bin/{vitest,tsc,vite}` 직접 실행(02-progress 환경 메모).

## 개발 실행 (dogfooding)

```sh
# Vite dev server + Electron
pnpm dev    # (corepack pnpm — nvm 전환 후 corepack pnpm 호출)
```

## dogfooding 체크리스트 (사용자 영역)

US 별 독립 검증:

**US1 — 진척 카드 (P1)**
- [ ] 목표 글자수 설정 작품: 진척%가 (현재 글자수 ÷ 목표) 와 일치
- [ ] 목표 미설정 작품: "목표 미설정" 표시
- [ ] 본문 있는 작품: 마지막 문장 + 최근 수정일 표시
- [ ] 본문 빈 작품: 마지막 문장 미표시
- [ ] 작품 0개: 빈 상태 안내

**US2 — 기록 메모 (P2)**
- [ ] 집필 "작업 종료" → 모달 → 기록 메모 저장 → 기록 화면 최신 1줄 반영
- [ ] 같은 작품 2건 이상 → 아코디언 펼침에서 최신순 누적
- [ ] 모달 취소 → 기록 미추가 + 집필 유지

**US3 — 작업 시간 (P3)**
- [ ] 집필 5분 머문 뒤 이탈 → 총 작업 시간 ~5분 누적
- [ ] 30초 미만 진입 → 합산 제외
- [ ] 앱 닫고 재시작 → 닫기 전 시간 합산 or 비정상 종료 폐기(과대 합산 없음)
- [ ] 작업 시간 없는 작품 → "기록 없음"/0

**공통**
- [ ] 작품 삭제 → 그 작품 기록 메모·작업 시간 사라짐(CASCADE)
- [ ] 앱 재시작 후 기록·시간 영속

## 핵심 회귀 주의 (구현 시)

- **세션 cleanup stale closure** — `App.tsx` effect cleanup 이 직전 projectId 로 `end` 호출(R4). Phase 6 패널 stale 회귀와 동류.
- **명시 종료 30s 폐기 분기** — `endSessionWithLog` 는 짧아도 보존(R6). `endOpen` 의 폐기 분기를 타면 안 됨.
- **마이그레이션** — v6 신규 테이블만, 기존 데이터 보존 확인(`schema.test.ts` v5→v6).
- **한국어 렌더** — 카드/모달 한국어 표시, `word-break: keep-all` 전역 정합.
