# 보안 감사 + 집필실 진입 성능/UX — 한 세션 종합

- 일자: 2026-06-18
- 워크트리 / 브랜치: landing-page / develop
- 관련 커밋: e309b08(보안) · 94be6c5(캐싱/prefetch) · 33e77ad(CLAUDE.md 배포) · 11788e3(랜딩 플래시) · d664f54(라우트 prefetch+loading) · 3e80592(스켈레톤) · 5737424(크로스페이드)
- 배포: FE `vercel --prod` ×4 (harubuild.xyz), BE OCI systemd jar 교체 ×1

## 1. 무엇을 했는가 (사실)

1. **BE/FE 보안 감사** — 병렬 subagent 3개(BE IDOR sweep / BE 횡단 / FE)로 전수 감사. 확인된 실제 취약점 1건: `MemoCurationService.curate()` 가 연결 대상 작품 소유권 미검증(빈 characterIds 로 타인 작품 연결 + 제목 유출). TDD(Red→Green)로 `findByIdAndUserId` 가드 추가.
2. **CSRF 심층방어** — `CsrfDefenseFilter`(쿠키 인증+비-Bearer 상태변경에 `X-WriteNote-Client` 헤더 요구) + 프론트 `client.ts rawFetch` 헤더 동봉 + 필터 단위 테스트 5건. `ErrorCode.FORBIDDEN` 추가.
3. **보안 응답 헤더** — `next.config.ts` 에 X-Frame-Options/CSP(frame-ancestors)/HSTS/nosniff/Referrer/Permissions (script-src 미게이트 — 인라인 테마 스크립트 보호).
4. **#4 IP throttle = 스킵 결정** — 프록시 구조상 백엔드가 클라 IP 미관측(자가 DoS 위험) → 에지 계층 권장으로 보류.
5. **CLAUDE.md "배포 환경" 절** 추가 (호스팅·브랜치 모델·FE/BE 수동 배포·FE 선행 순서 HARD-GATE).
6. **로그인 후 랜딩 플래시 제거** — `app/page.tsx` 를 async 서버 컴포넌트로(쿠키 게이트) → 인증 시 `PostLoginRedirect`(로더), 비로그인 `LandingContent`. `LandingAuthRedirect` 대체·삭제.
7. **집필 진입 지연** — (1차) React Query 캐싱+데이터 prefetch → 효과 없음 → (2차) 실제 원인=라우트 전환 미prefetch. `router.prefetch` + `loading.tsx` 로 해결.
8. **로딩 UX 폴리시** — 원고지 `StudioSkeleton`(라우트/셸/본문 3단계 공용) + 스켈레톤→에디터 **크로스페이드**.
9. **배포** — FE 4회(vercel CLI), BE 1회(SSH `oci` → jar 백업·교체·`systemctl restart`·health 폴링·자동롤백 포함). CSRF 필터 라이브 검증(쿠키만→403 / 쿠키+헤더→401).

## 2. 어떻게 했는가 (접근)

- 보안 감사는 코어(SecurityConfig·JWT·쿠키·CORS)는 직접 정독, 나머지 breadth 는 subagent 병렬(추측 금지·file:line 인용 지시). subagent 발견(MemoCuration IDOR)은 무검증 수용하지 않고 직접 재현·확인 후 채택(§7 준수).
- 모든 수정은 TDD(보안) 또는 게이트 GREEN(폴리시) 확인 후 진입. 빌드/테스트 포어그라운드.
- 배포 전 **순서 안전(FE 선행→BE 후행)** 을 먼저 surfacing — CSRF 필터가 헤더 없는 기존 FE 요청을 403 낼 위험.
- BE 배포는 plan 의 "Docker" 기재를 믿지 않고 실제 box 를 읽어 systemd jar 임을 확인 후 그에 맞춰 절차 구성(§8 준수).

## 3. 잘 된 점

1) **subagent 발견 무검증 수용 회피** — MemoCuration IDOR 를 직접 재현(빈 characterIds 경로 + buildResponse 제목 유출)해 실재 확인 후 TDD 수정. 근거: 회귀테스트 RED(예외 미발생=취약점 재현)→GREEN.
2) **배포 순서 안전 무중단** — FE 선행 배포로 신규 FE+기존 BE 안전 구간 확보, 이후 BE 배포 후 CSRF 라이브를 외부 probe(403/401)로 검증. 근거: 운영 중 403 breakage 0.
3) **BE 배포 메커니즘 실측** — plan "Docker"와 실제 systemd 불일치를 배포 전 발견(추측 배포 회피). 근거: `systemctl cat` 로 ExecStart 확인 후 진행, health 200·롤백 무발동.
4) **각 배포 라이브 검증** — 보안 헤더 6종 curl, CSRF probe, 랜딩 게이트(쿠키 유무별) 모두 실측.

## 4. 어긋난 점

1) **집필 지연 — 1차 수정이 틀린 레이어(가장 큰 어긋남).** 1차로 React Query 캐싱+데이터 prefetch 를 배포했으나 사용자 "여전히 딜레이". 실제 원인은 **데이터/렌더가 아니라 Next 라우트 전환 자체**(명령형 `router.push` 미prefetch + `loading.tsx` 부재). 사용자의 정밀 증상("클릭하면 1초 그대로 있다가 화면전환" = 전환 *전* 정지)이 레이어를 확정했다.
   - **회피 가능 시점**: 최초 딜레이 조사 때 "딜레이가 전환 *전*인가 *후*인가"를 먼저 물었어야. 그 한 질문이 라우트층 vs 데이터/렌더층을 즉시 갈랐다. 대신 코드만 보고 데이터 워터폴로 단정 → 배포 1사이클 낭비.
   - §11(한 번 고쳐 안 나으면 관찰로 레이어 확정)이 2차에서 작동해 정정함.

2) **CLAUDE.md 배포 상태 오기재 → 정정.** 처음 "web 앱 미런칭 / download-site 만 공개"로 적었으나 사용자가 "배포된 환경에서 겪음" 확인 → 실배포(harubuild.xyz)로 정정. 회피 가능 시점: 배포 상태가 불확실하면 단정 서술 대신 먼저 확인했어야(§단정 금지). "단정 금지" 라벨은 붙였으나 본문은 단정함.

3) **#4 IP throttle — 옵션 제시 후 인프라 제약 발견.** 사용자가 4개 범위를 승인한 뒤 #4가 프록시 구조상 부적합함을 surfacing. 구현 전 차단해 실손해는 없었으나, 선택지 제시 *이전* 프록시-IP 제약을 검증했다면 #4를 애초에 다른 형태로 제시했을 것.

4) 멈춤/재질문: 사용자 "어떤 수정 개선 진행한거야?"(1차 성능수정 불신) 1회 — 위 1)의 결과. 그 외 멈춤 신호 없음. 같은 에러 3+ 재시도 0.

## 5. 다음 작업에 남길 교훈

### 5-1. 작업별 교훈 (이 프로젝트 한정)

- **집필실/스튜디오 진입은 명령형 `router.push`** 경로다. 새 진입점 추가 시 `router.prefetch` + 해당 세그먼트 `loading.tsx` 동반(라우트 전환 정지 방지). 데이터 prefetch(React Query)와 라우트 prefetch(Next)는 **다른 레이어**임을 기억.
- 로딩 표시는 `StudioSkeleton` 하나로 통일(라우트/셸/본문). 새 로딩 지점도 동일 컴포넌트 재사용.
- 배포: FE=`cd frontend && vercel --prod`, BE=`ssh oci` 후 jar 백업→교체→`systemctl restart write-note-backend`→health 폴링. 메모리 [[deployment-live]] 참조.

### 5-2. 룰 갱신 후보 (사용자 컨펌 필요)

**후보 1 — "느린 네비게이션" 보고의 전/후 전환 판별 질문 (일반 원칙).**
- (1) 대상: 글로벌 `~/.claude/rules/shared/...`(프런트 성능/디버깅) 또는 프로젝트 `.claude/rules/typescript/code-quality.md`
- (2) 본문: *"클릭 후 화면이 늦게 뜬다"류 네비게이션 지연 보고를 받으면, 근본원인 추정 전에 **지연이 화면 전환 '전'인가 '후'인가**를 먼저 확정한다. 전=라우트/번들/전환 레이어, 후=데이터/렌더 레이어. 이 한 가지 관찰이 레이어를 가르며, 틀린 레이어 수정 후 재배포 낭비를 막는다.*
- (3) 근거: §4-1 (1차 데이터층 수정이 빗나가고, 사용자의 "전환 전 1초 정지" 증상이 라우트층을 가리켜 정정 — 배포 1사이클 낭비). systematic-debugging §11 의 프런트 네비게이션 특화 확장.

**후보 2 — 권위 문서(CLAUDE.md 등)에 휘발성 운영 상태 단정 금지.**
- (1) 대상: 프로젝트 `CLAUDE.md` 또는 `.claude/rules/shared/agent-workflow-discipline.md`
- (2) 본문: *권위 지침 파일에 배포 여부·라이브 URL·프로덕션 브랜치 같은 **휘발성 운영 상태**를 적을 때는 확인 전 단정하지 않는다. 확인 가능하면 확인 후, 불가하면 "확인 필요 + SoT 링크"로 적고 본문 자체를 단정형으로 쓰지 않는다.*
- (3) 근거: §4-2 (CLAUDE.md "미런칭" 단정 → 실배포로 정정. "단정 금지" 라벨만 붙이고 본문은 단정함).

**사용자 컨펌 전까지 실제 룰 파일 수정 안 함.**
