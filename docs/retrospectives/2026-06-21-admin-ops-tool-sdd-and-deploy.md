# 030 운영 툴(Admin Ops Tool) v1 — SDD 전과정 + 멀티 prod 배포

- 일자: 2026-06-21
- 워크트리 / 브랜치: write-note / 030-admin-ops-tool (→ develop·main 머지 후 정리)
- 관련 커밋: develop `b0f3e79`, main `7e13d5e` (4 작업커밋 + rebase 통합 `b2d2ac9`)
- 작업 시간(대략): 단일 세션(설계~배포 일괄)

## 1. 무엇을 했는가 (사실)

- **SDD 전과정**: brainstorming(형식 A안=별도 Next 어드민 앱 결정) → 설계문서 → `/speckit-specify`(spec, clarification 0) → `/speckit-plan`(plan·research·data-model·contracts·quickstart) → `/speckit-tasks`(42 task) → `/speckit-implement`.
- **백엔드**: `Announcement` 엔티티 + V16 마이그레이션, 공개 `GET /api/announcements`(/{id}) + 어드민 CRUD `/api/admin/announcements`, 회원 조회 `/api/admin/users`(화이트리스트 DTO·작품수 그룹카운트), 통계 `/api/admin/stats`(summary·30일 가입추이 KST), `AdminAuthorizationManager`(principal.email == app.admin.email) + SecurityConfig `/api/admin/**` 게이트. IT 다수(401/403/200·CRUD·발행토글·비밀값 미노출·집계).
- **사용자앱(frontend)**: 홈 공지 배너 + `/notice` 목록·상세 + API/훅 + nav 공지. (문의는 기존 `/contact` 재사용.)
- **어드민앱(admin-site, 신규)**: 완전한 Next 앱(로그인·가드 셸·공지 관리·회원 조회·대시보드(의존성 0 인라인 막대)). Tailwind 기본(shadcn 미사용), recharts 미사용.
- **로컬 dogfooding**: 3종 기동 → admin 계정(`admin@writenote.local`) signup+verify(로그에서 토큰) → 공지 발행→사용자 배너 노출 왕복 확인.
- **베이스 최신화**: develop이 031(문의 진입점) 5커밋 앞서 있어 030을 origin/develop 위로 **rebase**. layout.tsx 문의 중복 자동병합 → 수동 제거.
- **배포(BE 선행→FE→어드민)**: BE OCI blue-green(V16 prod 적용 + `ADMIN_EMAIL=jongbell4@gmail.com`), FE main→Vercel production(soseolbi.com), 어드민 Vercel 신규 프로젝트 CLI standup(`vercel link`+env+`deploy --prod`) + `admin.soseolbi.com`(Cloudflare A 76.76.21.21 DNS only) + SSL 발급 후 라이브.
- **마무리**: develop·main 머지, vault 02-PROGRESS 030 entry + 03-ISSUES ISSUE-041 갱신.

## 2. 어떻게 했는가 (접근)

- **추측 금지 우선**: 매 단계 실제 코드/환경 확인 후 진행 — 백엔드 패턴(Character/SecurityConfig/Result/PageResponse/IT), 테스트 인프라(Testcontainers 아닌 `test` 프로파일+로컬 docker DB), OCI env 주입(`/etc/write-note/backend.env --env-file`), 비번 정책, next docs 존재, 로그인의 이메일 인증 강제.
- **MVP 우선 점진**: 단계 A(US1) 백엔드 먼저 완성·게이트 GREEN → 체크포인트 → 프론트 → US2/US3. 매 증분 게이트로 검증 후 진행.
- **배포 순서 = 방향 의존**: BE가 새 계약(엔드포인트) 도입·FE가 소비 → BE 선행. prod 공개/게이트만 검증 가능(authed는 §19 한계).
- **메모리 경고 정확 해석**: "vercel CLI 배포 실패"는 기존 프로젝트 Root Directory 충돌 한정 → 신규 프로젝트는 서브디렉터리 link로 CLI standup 가능하다고 구분 판단.

## 3. 잘 된 점

1) **§18 베이스 정합 선제 처리** — 배포 전 `git fetch` + `HEAD..origin/develop`로 031 격차 인지, rebase로 최신화. 과거 stale 분기 사고(logout 403, 메모리 [[branch-base-verify-before-work]]) 반복 회피. 근거: rebase 후 `merge-base --is-ancestor origin/develop HEAD` = YES 확인.
2) **비밀값 미노출 설계** — 회원 응답 화이트리스트 DTO + IT에서 `passwordHash` doesNotExist assert. 근거: AdminUserControllerIT GREEN.
3) **prod 배포 검증 게이트** — BE 배포 후 공개 200 / 게이트 401 / health 200, 어드민 도메인 SSL·프록시·게이트 curl 검증. 무중단(blue-green health OK ~18s).
4) **추측 차단 다수** — OCI env 방식·비번 정책·테스트 인프라를 실제 확인 후 진행해 헛작업 0. 시크릿 파일은 내용 출력 없이 append(`tee -a >/dev/null`).
5) **신규 Vercel 프로젝트 CLI standup 성공** — 대시보드 없이 link+env+deploy+domain까지 CLI로 완료.

## 4. 어긋난 점

- **사용자 멈춤 신호 1회** — "왜 멈췄지? 뭐잘못된듯". 원인: `AskUserQuestion` 툴 호출을 raw `<invoke>` 텍스트로 출력(정상 tool call 아님) → 아무 일도 안 일어남. 그 전에도 같은 도구가 JSON 파싱 오류로 수 회 실패(한글 유니코드 이스케이프 인자). 회피 가능 시점: 첫 호출 시 정상 도구 호출 형식 준수.
- **finish-work 1단계 첫 시도 무효** — `git checkout develop`이 다른 워크트리(`write-note-031-contact-entrypoints`)가 develop 점유 중이라 막힘 → merge 미실행(에러 무시하고 진행했으면 "merge 됐겠지" 오인 위험). 회피 가능 시점: 멀티 워크트리 환경에서 공유 브랜치 merge 전 `git worktree list`로 점유 선확인.
- **rebase 자동병합 중복** — layout.tsx에 030(NAV 문의 칩)과 031(헤더 문의 링크)이 다른 라인이라 git이 충돌 없이 자동병합 → 문의 진입점 2개 중복(031 테스트는 문의 링크 1개 기대 → 잠재 깨짐). 충돌로 안 잡혀 수동 점검으로 발견·제거. 회피: rebase 전 "양쪽이 같은 기능을 추가했는가" 인지(했음) + 자동병합 후 결과 직접 검증(했음 — 그래서 잡음).
- **로컬 actuator/health 503 조사 비용** — 로컬 health DOWN을 mail health indicator(SMTP 부재)로 확정하기까지 추가 조회. 무해였으나 시간 소모.
- **로컬 dogfood 계정 준비 다단계** — 로그인의 이메일 인증 강제 때문에 signup→로그에서 토큰→verify 수동. 매끄럽지 않았으나 해결.
- **§19 한계 잔존** — prod 어드민 authed 동작(로그인 후 공지 CRUD)은 비번 부재로 미검증, 사용자 dogfood로 남김(정직 기록, ISSUE-041).
- 반복 디버깅(같은 에러 3+) 없음. 게이트 RED→수정은 컴파일 2건(KDoc 내 `/*` 중첩주석 / Spring Security 7 `authorize` 시그니처) — 각 1회 수정으로 해결.

## 5. 다음 작업에 남길 교훈

### 5-1. 작업별 교훈 (이 프로젝트 한정)
- 어드민앱 배포는 현재 **수동 `vercel deploy --prod`**(git 자동배포 미연결). 변경 시 admin-site에서 수동 배포하거나, 원하면 대시보드 Root Directory=admin-site + git connect.
- 어드민 관리자 변경 = OCI `/etc/write-note/backend.env`의 `ADMIN_EMAIL` 한 줄 + blue-green 재기동(DB 무관).
- 로컬 어드민 dogfood = `admin@writenote.local` signup → 백엔드 로그의 verify 토큰으로 `/api/auth/verify-email`.
- KDoc/주석에 `/api/admin/**` 같은 `/*` 시퀀스 금지(Kotlin 중첩 블록주석 오픈 → 컴파일 실패). Spring Security 7 인가는 `AuthorizationManager.authorize(Supplier<out Authentication?>, T)` 오버라이드.

### 5-2. 룰 갱신 후보 (사용자 컨펌 필요)

**후보 1 — 멀티 워크트리에서 공유 브랜치 merge 전 점유 선확인**
- (1) 대상: `.claude/rules/shared/agent-workflow-discipline.md`(또는 글로벌 git 룰)
- (2) 본문: "여러 워크트리가 있는 repo에서 develop 등 공유 브랜치로 merge/checkout 하기 전 `git worktree list`로 그 브랜치가 다른 워크트리에 체크아웃됐는지 확인한다. 점유 중이면 해당 워크트리에서 merge하거나, checkout 실패를 '성공'으로 오인하지 않는다(에러 후 후속 명령이 무효가 됨)."
- (3) 근거: §4 — `git checkout develop` 막힘으로 finish-work 1단계 merge 미실행.

**후보 2 — Vercel 신규 프로젝트는 서브디렉터리 link로 CLI standup 가능(기존 프로젝트 Root Directory 충돌과 구분)**
- (1) 대상: 메모리 [[deployment-live]] 보강(+ 선택적으로 프로젝트 배포 룰)
- (2) 본문: "모노레포 서브디렉터리 앱을 새 Vercel 프로젝트로 띄울 때, 그 디렉터리에서 `vercel link --yes --project <name>`하면 그 디렉터리가 프로젝트 루트가 되어 `vercel deploy --prod`가 그 디렉터리만 업로드한다(기존 write-note 프로젝트의 Root Directory=frontend 충돌·전체repo 업로드 문제와 별개). 단 git push 자동배포는 별도 연결 필요. 신규 Vercel 프로젝트는 `ssoProtection=all_except_custom_domains` 기본값 → `*.vercel.app`은 401(Vercel 인증), 커스텀 도메인은 공개."
- (3) 근거: §1/§3 — soseolbi-admin CLI standup 성공 + admin.soseolbi.com 공개 동작.

> 후보 모두 컨펌 전 룰/메모리 파일 미수정.
