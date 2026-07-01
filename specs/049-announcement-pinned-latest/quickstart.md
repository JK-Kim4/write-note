# Quickstart / 검증: 공지 고정·최신 슬롯

## R1 BE 게이트 (선행)

```bash
cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build
```

`AnnouncementControllerIT` 신규 시나리오(MockMvc, 기존 `deleteAll` 격리 패턴 재사용) — 모두 GREEN:

- [ ] 공개+고정 1 + 공개 비고정 1 → `pinned`=고정, `latest`=비고정(둘 다)
- [ ] 공개+고정 여러 → `pinned`=그중 공개일 최신 1 (FR-003)
- [ ] 고정=공개일 최신(고정이 곧 가장 최근 공개) → `latest`=그다음 공개 1 (FR-004 dedup)
- [ ] 고정만(공개 1건이며 고정) → `pinned`=객체, `latest`=null (FR-004 edge)
- [ ] 고정 없음, 공개 있음 → `pinned`=null, `latest`=최신 (FR-006)
- [ ] 공개 0건 → 둘 다 null (FR-007)
- [ ] 미공개(고정 포함)는 제외 (FR-009)
- [ ] 비인증 요청 200 (permitAll 커버)

## R2 FE 게이트 (후행)

```bash
cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

vitest(`AnnouncementBanner.test.tsx`) — render 행위(색 아님):

- [ ] `{pinned, latest}` 둘 다 → 두 배너 렌더, 각 제목 표시, 각 링크가 `/notice/{id}`
- [ ] `pinned`만 → 고정 배너 1개
- [ ] `latest`만 → 최신 배너 1개
- [ ] 둘 다 null → 아무것도 안 렌더(null)

## Dogfooding 게이트 (시각 — rule 14, 로컬 3종 기동)

> 로컬: `docker compose up -d --wait postgres` → `cd backend && ./gradlew bootRun --args='--spring.profiles.active=local'` → `cd frontend && pnpm dev`. 어드민에서 공지 공개/고정 토글로 상태를 만든 뒤 홈(/) 확인.

목업(`docs/research/2026-07-01-announcement-pinned-latest-mockup.html`) 대비:

- [ ] 고정+최신 둘 다 노출, 세로 적층(고정 위)
- [ ] 고정 = 앰버 채운 카드 + 좌측 금빛 바 + 채운 「고정」 배지 / 최신 = 청록(teal) pill(운영 유지) — 한눈에 구분(앰버 vs 청록)
- [ ] 최신 = 기존 teal 색 유지, 고정만 앰버 강조 추가
- [ ] 라이트/다크 양쪽 가독 — 특히 고정 제목이 다크에서도 보임(고정 어두운 텍스트 amber-900)
- [ ] 상태별: 고정만 / 최신만 / 공지 없음(슬롯 미표시, 빈 자리 없음)
- [ ] 각 배너 클릭 → `/notice/{id}` 상세 이동
- [ ] 한글 제목 렌더 정상

## 배포 순서

BE(`/home` 신규) 선행 배포 → FE(배너 재구성·색) 후행. 반대면 FE 가 없는 `/home` 호출로 배너 실패.
