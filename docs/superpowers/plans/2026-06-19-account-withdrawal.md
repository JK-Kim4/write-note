# 회원 탈퇴 (Account Withdrawal) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로그인 사용자가 설정에서 계정과 모든 데이터를 즉시 영구 삭제(회원 탈퇴)할 수 있게 한다.

**Architecture:** 백엔드는 `projects` FK를 `ON DELETE CASCADE`로 통일해(V15) User row 한 번 삭제로 전 데이터를 DB cascade 삭제한다. `DELETE /api/auth/me`가 확인 문구를 검증하고 쿠키를 만료시킨다. 프론트는 설정 계정 섹션에 탈퇴 버튼 + 확인 문구 모달을 두고, 성공 시 캐시를 비우고 `/welcome`으로 보낸다.

**Tech Stack:** Kotlin/Spring Boot + JPA + Flyway (BE), Next.js 16 + React Query + Vitest/RTL (FE).

## Global Constraints

- 삭제 전략: 즉시 완전 삭제(hard delete cascade). soft-delete/유예/익명화 없음.
- 본인 확인 문구: **`탈퇴합니다`** (BE·FE 동일 상수). 불일치 시 400.
- 카카오 unlink 호출 없음(DB User만 삭제).
- BE Kotlin: `@Transactional(rollbackFor = [Exception::class])`, 생성자 주입, 배열 인자 `[X::class]`.
- 마이그레이션 적용(로컬/프로덕션 모두)은 **사용자 컨펌 필수**(external-infra-safety) — 본 plan은 작성까지.
- 검증 게이트: BE `./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test`, FE `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.

---

### Task 1: 마이그레이션 V15 — projects FK를 ON DELETE CASCADE로 교체

**Files:**
- Create: `backend/src/main/resources/db/migration/V15__projects_user_fk_cascade.sql`

**Interfaces:**
- Produces: `projects.user_id` FK가 `ON DELETE CASCADE` → User 삭제 시 projects(→documents/characters) cascade. Task 2 통합테스트가 이 동작에 의존.

> 마이그레이션은 설정 파일(§TDD 예외). cascade 실제 동작 검증은 Task 2 통합테스트가 담당. 적용은 사용자 컨펌.

- [ ] **Step 1: 마이그레이션 파일 작성**

```sql
-- V15__projects_user_fk_cascade.sql
-- projects → users FK 에 ON DELETE CASCADE 추가(회원 탈퇴 시 User 한 방 cascade 삭제 전제).
-- 기존 제약명: fk_projects_user (V2). 나머지 FK(memos/api_tokens/auth_tokens/user_settings/
-- work_sessions/project_logs)는 이미 CASCADE.
ALTER TABLE projects DROP CONSTRAINT fk_projects_user;
ALTER TABLE projects ADD CONSTRAINT fk_projects_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
```

- [ ] **Step 2: 제약명 정합 확인**

Run: `grep -n "fk_projects_user" backend/src/main/resources/db/migration/V2__create_projects.sql`
Expected: `CONSTRAINT fk_projects_user FOREIGN KEY (user_id) REFERENCES users (id)` 출력(제약명 일치 확인). 불일치 시 V15의 DROP CONSTRAINT 명을 실제 값으로 수정.

- [ ] **Step 3: 커밋**

```bash
git add backend/src/main/resources/db/migration/V15__projects_user_fk_cascade.sql
git commit -m "feat(account-withdrawal): V15 projects FK ON DELETE CASCADE"
```

---

### Task 2: AuthService.withdraw + 에러코드 + cascade 통합테스트

**Files:**
- Modify: `backend/src/main/kotlin/com/writenote/enums/AuthErrorCode.kt` (에러코드 1종 추가)
- Modify: `backend/src/main/kotlin/com/writenote/service/AuthService.kt` (withdraw 추가)
- Test: `backend/src/test/kotlin/com/writenote/service/AuthServiceWithdrawIT.kt` (신규, Testcontainers)

**Interfaces:**
- Consumes: Task 1의 cascade FK. 기존 `userRepository: UserRepository`(AuthService 주입), `AuthException(AuthErrorCode)`.
- Produces: `fun AuthService.withdraw(userId: Long)` — User 삭제(cascade). 확인 문구 검증은 Controller(Task 3) 책임. `AuthErrorCode.WITHDRAWAL_CONFIRMATION_MISMATCH`.

- [ ] **Step 1: 통합 테스트 작성(실패)**

기존 IT 패턴(Testcontainers + 실제 cascade)을 따른다. fixture로 User + Project + Document + Memo + ApiToken + UserSetting 생성 후 withdraw → 전부 삭제 검증.

```kotlin
// AuthServiceWithdrawIT.kt — @SpringBootTest + Testcontainers (기존 IT 베이스 클래스 재사용)
@Test
fun `withdraw 는 User 와 연관 데이터(작품·챕터·메모·토큰·설정)를 모두 삭제한다`() {
    // given: 사용자 + 연관 데이터 (기존 fixture/save 유틸 사용)
    val user = userRepository.save(User(email = "w@test.com", passwordHash = "x"))
    val project = projectRepository.save(/* user.id 로 작품 */)
    documentRepository.save(/* project.id 로 챕터 */)
    memoRepository.save(/* user.id 로 메모 */)
    apiTokenRepository.save(/* user.id 로 토큰 */)
    userSettingRepository.save(/* user.id 로 설정 */)

    // when
    authService.withdraw(user.id!!)

    // then: User 및 연관 전부 삭제
    assertThat(userRepository.findById(user.id!!)).isEmpty
    assertThat(projectRepository.findById(project.id!!)).isEmpty
    assertThat(memoRepository.count()).isZero()
    assertThat(apiTokenRepository.count()).isZero()
    assertThat(userSettingRepository.count()).isZero()
}
```

> 실제 엔티티 생성자/필드는 기존 IT(예: `ProjectControllerIT`, `MemoServiceIT`)의 fixture 헬퍼를 grep해 그대로 사용. 추측 금지.

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && ./gradlew test --tests "*AuthServiceWithdrawIT*"`
Expected: FAIL — `withdraw` 미정의(컴파일 에러) 또는 메서드 없음.

- [ ] **Step 3: 에러코드 추가**

`AuthErrorCode.kt`의 400 구간에 추가:

```kotlin
    // 400 — 회원 탈퇴 확인 문구 불일치
    WITHDRAWAL_CONFIRMATION_MISMATCH(HttpStatus.BAD_REQUEST, "확인 문구가 일치하지 않습니다."),
```

- [ ] **Step 4: withdraw 구현**

`AuthService.kt`에 추가:

```kotlin
    /**
     * 회원 탈퇴 — User 삭제(연관 데이터는 DB ON DELETE CASCADE 로 연쇄 삭제). 즉시 완전 삭제, 복구 불가.
     */
    @Transactional(rollbackFor = [Exception::class])
    fun withdraw(userId: Long) {
        userRepository.deleteById(userId)
    }
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd backend && ./gradlew test --tests "*AuthServiceWithdrawIT*"`
Expected: PASS — User·연관 데이터 전부 삭제.

- [ ] **Step 6: 커밋**

```bash
git add backend/src/main/kotlin/com/writenote/enums/AuthErrorCode.kt backend/src/main/kotlin/com/writenote/service/AuthService.kt backend/src/test/kotlin/com/writenote/service/AuthServiceWithdrawIT.kt
git commit -m "feat(account-withdrawal): AuthService.withdraw + cascade IT"
```

---

### Task 3: AuthController DELETE /api/auth/me — 확인 문구 검증 + 쿠키 만료

**Files:**
- Modify: `backend/src/main/kotlin/com/writenote/controller/AuthController.kt` (endpoint + WithdrawRequest)
- Test: `backend/src/test/kotlin/com/writenote/controller/AuthControllerWithdrawIT.kt` (신규)

**Interfaces:**
- Consumes: `authService.withdraw(userId)` (Task 2), `AuthCookieFactory.expiredAccessTokenCookie()/expiredRefreshTokenCookie()` (logout과 동일), `AuthenticatedPrincipal.userId`, `AuthErrorCode.WITHDRAWAL_CONFIRMATION_MISMATCH`.
- Produces: `DELETE /api/auth/me` — body `{ "confirmation": "탈퇴합니다" }`. 불일치 400, 미인증 401, 성공 200 + 만료 쿠키 2개.

- [ ] **Step 1: 컨트롤러 테스트 작성(실패)**

기존 `*ControllerIT` 패턴(MockMvc + 인증 principal). 세 케이스:

```kotlin
@Test fun `확인 문구 일치 시 탈퇴되고 쿠키가 만료된다`() {
    // 인증된 사용자로 DELETE /api/auth/me {"confirmation":"탈퇴합니다"}
    // → 200, Set-Cookie 만료(access/refresh), User 삭제
}
@Test fun `확인 문구 불일치 시 400 WITHDRAWAL_CONFIRMATION_MISMATCH`() {
    // {"confirmation":"xxx"} → 400, error.code == "WITHDRAWAL_CONFIRMATION_MISMATCH", User 유지
}
@Test fun `미인증 시 401`() {
    // principal 없이 호출 → 401
}
```

> 인증 principal 주입·MockMvc 셋업은 기존 `AuthController` 테스트(로그인/로그아웃 테스트)의 패턴을 grep해 동일하게.

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && ./gradlew test --tests "*AuthControllerWithdrawIT*"`
Expected: FAIL — endpoint 없음(404/컴파일).

- [ ] **Step 3: WithdrawRequest + endpoint 구현**

`AuthController.kt`에 추가(상수 + endpoint). logout과 동일한 쿠키 만료 패턴:

```kotlin
    // companion 또는 파일 상단 상수
    // const val WITHDRAWAL_CONFIRMATION_PHRASE = "탈퇴합니다"

    @DeleteMapping("/me")
    @Operation(summary = "회원 탈퇴", description = "확인 문구 일치 시 User 및 모든 데이터 즉시 삭제(복구 불가)")
    @SecurityRequirement(name = "BearerJwt")
    fun withdraw(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @RequestBody request: WithdrawRequest,
    ): ResponseEntity<Result<Nothing?>> {
        if (request.confirmation != WITHDRAWAL_CONFIRMATION_PHRASE) {
            throw AuthException(AuthErrorCode.WITHDRAWAL_CONFIRMATION_MISMATCH)
        }
        authService.withdraw(principal.userId)
        return ResponseEntity
            .ok()
            .header(HttpHeaders.SET_COOKIE, authCookieFactory.expiredAccessTokenCookie().toString())
            .header(HttpHeaders.SET_COOKIE, authCookieFactory.expiredRefreshTokenCookie().toString())
            .body(Result.success<Nothing?>(null))
    }
```

`WithdrawRequest`는 기존 request DTO 위치(예: `model/request/`)에 `data class WithdrawRequest(val confirmation: String)`. `WITHDRAWAL_CONFIRMATION_PHRASE` 상수는 AuthController companion object 또는 동일 파일 top-level `const val`.

> `AuthException`이 throw됐을 때 400 + `error.code = "WITHDRAWAL_CONFIRMATION_MISMATCH"` envelope로 매핑되는지 기존 예외 핸들러(`@RestControllerAdvice`) 동작 확인.

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && ./gradlew test --tests "*AuthControllerWithdrawIT*"`
Expected: PASS — 3 케이스.

- [ ] **Step 5: 전체 BE 게이트**

Run: `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test`
Expected: BUILD SUCCESSFUL (회귀 없음).

- [ ] **Step 6: 커밋**

```bash
git add backend/src/main/kotlin/com/writenote/controller/AuthController.kt backend/src/main/kotlin/com/writenote/model/request/WithdrawRequest.kt backend/src/test/kotlin/com/writenote/controller/AuthControllerWithdrawIT.kt
git commit -m "feat(account-withdrawal): DELETE /api/auth/me endpoint"
```

---

### Task 4: FE — withdraw API 함수

**Files:**
- Modify: `frontend/src/lib/api/auth.ts` (withdraw 함수 + 상수)
- Test: `frontend/src/lib/api/auth.test.ts` (없으면 생략, 있으면 케이스 추가)

**Interfaces:**
- Consumes: `apiFetch<T>(path, init)` (client.ts).
- Produces: `WITHDRAWAL_CONFIRMATION_PHRASE = "탈퇴합니다"`, `function withdraw(confirmation: string): Promise<void>`.

- [ ] **Step 1: withdraw 함수 추가**

`auth.ts`에 추가(기존 login/fetchMe 패턴):

```typescript
export const WITHDRAWAL_CONFIRMATION_PHRASE = "탈퇴합니다";

export function withdraw(confirmation: string): Promise<void> {
    return apiFetch<void>("/api/auth/me", {
        method: "DELETE",
        body: JSON.stringify({ confirmation }),
    });
}
```

> `apiFetch`가 body에 `Content-Type: application/json`을 자동 설정하는지 client.ts 확인. 아니면 `headers: { "Content-Type": "application/json" }` 추가.

- [ ] **Step 2: typecheck**

Run: `cd frontend && pnpm typecheck`
Expected: 통과(에러 없음).

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/lib/api/auth.ts
git commit -m "feat(account-withdrawal): FE withdraw api"
```

---

### Task 5: FE — 설정 계정 섹션 탈퇴 버튼 + 확인 모달

**Files:**
- Modify: `frontend/src/app/(main)/settings/page.tsx` (계정 섹션 하단 버튼 + 모달)
- Test: `frontend/src/app/(main)/settings/page.test.tsx` (신규 — 모달 행위)

**Interfaces:**
- Consumes: `withdraw`, `WITHDRAWAL_CONFIRMATION_PHRASE` (Task 4), `useRouter`(next/navigation), `useQueryClient`(@tanstack/react-query).
- Produces: 설정 계정 섹션 하단 "회원 탈퇴" 버튼 → 모달 → 탈퇴 → `/welcome`.

- [ ] **Step 1: 모달 행위 테스트 작성(실패)**

```typescript
// page.test.tsx — RTL + msw
it("회원 탈퇴 모달: 문구 미입력 시 삭제 버튼 비활성, 정확 입력 시 활성", async () => {
    render(<BSettingsPage />, { wrapper });
    await userEvent.click(screen.getByRole("button", { name: "회원 탈퇴" }));
    const confirmBtn = screen.getByRole("button", { name: "탈퇴하기" });
    expect(confirmBtn).toBeDisabled();
    await userEvent.type(screen.getByLabelText("확인 문구"), "탈퇴합니다");
    expect(confirmBtn).toBeEnabled();
});
```

> meQuery/preferences 등 의존은 기존 settings 테스트가 없으므로 msw로 `/api/auth/me` 등을 mock하는 wrapper를 구성(기존 다른 page.test의 QueryClient wrapper 패턴 재사용).

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && pnpm vitest run "src/app/(main)/settings/page.test.tsx"`
Expected: FAIL — "회원 탈퇴" 버튼 없음.

- [ ] **Step 3: 계정 섹션 하단 탈퇴 버튼 + 모달 구현**

`page.tsx` import에 추가: `useState`(react), `useRouter`(next/navigation), `useQueryClient`, `withdraw`/`WITHDRAWAL_CONFIRMATION_PHRASE`(auth).

계정 `</section>` 하단(닫는 `</div>` 직전)에 위험 톤 버튼 + 모달 상태:

```tsx
            {/* 회원 탈퇴 */}
            <section className="mt-4 rounded-xl border border-red-200 bg-white p-5">
                <h2 className="text-base font-semibold text-red-600">회원 탈퇴</h2>
                <p className="mt-0.5 text-xs text-gray-400">
                    탈퇴하면 모든 작품·메모·설정이 영구 삭제되며 되돌릴 수 없습니다.
                </p>
                <button
                    type="button"
                    onClick={() => setWithdrawOpen(true)}
                    className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100"
                >
                    회원 탈퇴
                </button>
            </section>
```

state + 핸들러(BSettingsPage 내부):

```tsx
    const router = useRouter();
    const queryClient = useQueryClient();
    const [withdrawOpen, setWithdrawOpen] = useState(false);
    const [confirmInput, setConfirmInput] = useState("");
    const [withdrawing, setWithdrawing] = useState(false);
    const [withdrawError, setWithdrawError] = useState(false);

    const handleWithdraw = async () => {
        setWithdrawing(true);
        setWithdrawError(false);
        try {
            await withdraw(confirmInput);
            queryClient.clear();
            router.replace("/welcome");
        } catch {
            setWithdrawError(true);
            setWithdrawing(false);
        }
    };
```

모달(조건부, `</div>` 직전):

```tsx
            {withdrawOpen ? (
                <div role="dialog" aria-modal="true" aria-label="회원 탈퇴 확인"
                    className="fixed inset-0 flex items-center justify-center"
                    style={{ backgroundColor: "rgba(0,0,0,0.45)", zIndex: 50 }}
                    onClick={(e) => { if (e.target === e.currentTarget && !withdrawing) setWithdrawOpen(false); }}>
                    <div className="mx-4 flex w-full max-w-md flex-col gap-4 rounded-xl border border-gray-200 bg-white p-6">
                        <h3 className="text-lg font-semibold text-red-600">정말 탈퇴하시겠어요?</h3>
                        <p className="text-sm text-gray-600" style={{ lineHeight: 1.6 }}>
                            모든 작품·메모·설정이 영구 삭제되며 되돌릴 수 없습니다.
                            아래에 <strong>{WITHDRAWAL_CONFIRMATION_PHRASE}</strong> 를 입력하면 탈퇴됩니다.
                        </p>
                        <label htmlFor="withdraw-confirm" className="sr-only">확인 문구</label>
                        <input id="withdraw-confirm" type="text" value={confirmInput}
                            onChange={(e) => setConfirmInput(e.target.value)}
                            placeholder={WITHDRAWAL_CONFIRMATION_PHRASE}
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-red-400" />
                        {withdrawError ? (
                            <p role="alert" className="text-xs text-red-500">탈퇴에 실패했습니다. 다시 시도해 주세요.</p>
                        ) : null}
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setWithdrawOpen(false)} disabled={withdrawing}
                                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                                취소
                            </button>
                            <button type="button" onClick={() => void handleWithdraw()}
                                disabled={confirmInput !== WITHDRAWAL_CONFIRMATION_PHRASE || withdrawing}
                                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                                {withdrawing ? "탈퇴 중…" : "탈퇴하기"}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && pnpm vitest run "src/app/(main)/settings/page.test.tsx"`
Expected: PASS.

- [ ] **Step 5: 전체 FE 게이트**

Run: `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: 모두 통과(RSC 경계 포함), 회귀 없음.

- [ ] **Step 6: 커밋**

```bash
git add "frontend/src/app/(main)/settings/page.tsx" "frontend/src/app/(main)/settings/page.test.tsx"
git commit -m "feat(account-withdrawal): 설정 회원 탈퇴 버튼 + 확인 모달"
```

---

## 배포 (구현·검증 후 별도)

- BE 선행 배포 가능(없는 FE가 endpoint를 안 부르므로 무회귀). 단 **마이그레이션 V15 적용은 사용자 컨펌**(OCI). FE 후행.
- develop ff 머지 → `vercel --prod`(FE) / OCI(BE) — 기존 028 흐름과 동일.

## Self-Review 결과

- **Spec coverage**: 삭제전략(Task1·2 cascade), 본인확인 문구(Task3 검증·Task5 입력가드), endpoint(Task3), FE 흐름(Task5), 비범위(카카오 unlink 미포함) — 전부 task 매핑됨.
- **Placeholder**: 엔티티 fixture/예외핸들러/QueryClient wrapper는 "기존 패턴 grep" 지시로 명시(추측 금지 의도) — 실제 코드 인용은 구현 시점 grep 필요.
- **Type 일관성**: `WITHDRAWAL_CONFIRMATION_PHRASE`("탈퇴합니다") BE·FE 동일, `withdraw(userId)`(BE)·`withdraw(confirmation)`(FE) 시그니처 task 간 정합.
