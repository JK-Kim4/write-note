# 로그인 이메일 기억하기 + 비밀번호 표시 토글 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로그인·회원가입 화면에 비밀번호 평문 표시 토글을 추가하고, 로그인 화면에 "이메일 기억하기"(localStorage)를 추가한다.

**Architecture:** `FormInput`을 감싸는 신규 `PasswordInput` 래퍼로 표시/숨김 토글을 캡슐화(공통 `FormInput` 미수정). `LoginForm`·`SignupEmailForm`의 password 필드를 `PasswordInput`으로 교체. "이메일 기억하기"는 `LoginForm` 내부에서 localStorage(`writenote.rememberedEmail.v1`)로 프론트 단독 처리(백엔드 0).

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest + React Testing Library, Tailwind.

## Global Constraints

- 백엔드 변경 0. 프론트엔드 단독.
- 브랜치 `develop` 직접 작업.
- 비밀번호는 절대 localStorage 등에 저장하지 않는다 (이메일만).
- 토글 버튼은 `type="button"` 필수 (폼 제출 방지).
- `PasswordInput`은 `FormInput`의 `<label>` 구조를 유지 → `getByLabelText("비밀번호")` 셀렉터가 계속 동작해야 한다. 토글 버튼은 `<label>` 바깥(FormInput sibling)에 둔다.
- 컴포넌트 `'use client'` 의무 (이벤트 핸들러/hook 보유).
- Named export 의무 (default export 금지).
- 검증: `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build` (frontend 디렉토리 고정).

---

### Task 1: `PasswordInput` 컴포넌트

**Files:**
- Create: `frontend/src/components/ui/PasswordInput.tsx`
- Test: `frontend/src/components/ui/PasswordInput.test.tsx`

**Interfaces:**
- Consumes: `FormInput` (`frontend/src/components/ui/FormInput.tsx`) — props `FormInputProps extends InputHTMLAttributes<HTMLInputElement>` + `error?: boolean` + `label?: string`.
- Produces: `export function PasswordInput(props: PasswordInputProps)` where `type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { error?: boolean; label?: string }`. password 입력 + 우측 표시/숨김 버튼. `LoginForm`·`SignupEmailForm`이 기존 password `FormInput`을 이 컴포넌트로 1:1 치환해 소비.

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/src/components/ui/PasswordInput.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { PasswordInput } from "./PasswordInput";

describe("PasswordInput", () => {
    it("기본은 마스킹(type=password)이고 토글 버튼으로 평문(text)과 전환된다", async () => {
        render(<PasswordInput name="password" label="비밀번호" />);

        const input = screen.getByLabelText("비밀번호");
        expect(input).toHaveAttribute("type", "password");

        const toggle = screen.getByRole("button", { name: "비밀번호 표시" });
        expect(toggle).toHaveAttribute("aria-pressed", "false");

        await userEvent.click(toggle);
        expect(input).toHaveAttribute("type", "text");
        const hideToggle = screen.getByRole("button", { name: "비밀번호 숨기기" });
        expect(hideToggle).toHaveAttribute("aria-pressed", "true");

        await userEvent.click(hideToggle);
        expect(screen.getByLabelText("비밀번호")).toHaveAttribute("type", "password");
    });

    it("토글 버튼은 type=button 이라 폼을 제출하지 않는다", async () => {
        let submitted = false;
        render(
            <form onSubmit={() => { submitted = true; }}>
                <PasswordInput name="password" label="비밀번호" />
            </form>,
        );
        await userEvent.click(screen.getByRole("button", { name: "비밀번호 표시" }));
        expect(submitted).toBe(false);
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && npx vitest run src/components/ui/PasswordInput.test.tsx`
Expected: FAIL — `PasswordInput` 모듈/export 없음.

- [ ] **Step 3: 최소 구현 작성**

`frontend/src/components/ui/PasswordInput.tsx`:

```tsx
"use client";

import { useState, type InputHTMLAttributes } from "react";
import { FormInput } from "./FormInput";

/**
 * PasswordInput — 비밀번호 입력 + 표시/숨김 토글 래퍼.
 *
 * FormInput 을 감싸고(공통 컴포넌트 미수정), 우측에 평문 보기 버튼을 절대배치한다.
 * 버튼은 FormInput 의 <label> 바깥에 두어 getByLabelText 셀렉터를 보존한다.
 */

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
    error?: boolean;
    label?: string;
};

export function PasswordInput({ className = "", ...rest }: PasswordInputProps) {
    const [visible, setVisible] = useState(false);

    return (
        <div style={{ position: "relative" }}>
            <FormInput
                {...rest}
                type={visible ? "text" : "password"}
                className={`pr-12 ${className}`}
            />
            <button
                type="button"
                aria-label={visible ? "비밀번호 숨기기" : "비밀번호 표시"}
                aria-pressed={visible}
                onClick={() => setVisible((v) => !v)}
                className="absolute"
                style={{
                    right: "12px",
                    bottom: "12px",
                    color: "var(--w-ink)",
                    opacity: 0.55,
                    fontSize: "13px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                }}
            >
                {visible ? "숨기기" : "표시"}
            </button>
        </div>
    );
}
```

> 위치 메모: `bottom: 12px`는 `FormInput`의 input(`py-3` = 12px 상하 패딩) 기준 초기값. label `<span>`이 위에 있어 input은 컨테이너 하단에 위치하므로 bottom 정렬이 안정적. 정밀 위치는 dogfooding에서 조정.

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && npx vitest run src/components/ui/PasswordInput.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/components/ui/PasswordInput.tsx frontend/src/components/ui/PasswordInput.test.tsx
git commit -m "feat(ui): 비밀번호 표시/숨김 토글 PasswordInput 컴포넌트"
```

---

### Task 2: `SignupEmailForm` password 필드 교체

**Files:**
- Modify: `frontend/src/components/auth/SignupEmailForm.tsx:90-108` (두 password `FormInput`)
- Test: `frontend/src/components/auth/SignupEmailForm.test.tsx` (기존 — 회귀 확인용, 신규 작성 없음)

**Interfaces:**
- Consumes: `PasswordInput` (Task 1).
- Produces: 동작 변화 없음(기존 회원가입 흐름 유지) + 두 비밀번호 필드에 독립 토글.

- [ ] **Step 1: 기존 회원가입 테스트가 GREEN인지 먼저 확인**

Run: `cd frontend && npx vitest run src/components/auth/SignupEmailForm.test.tsx`
Expected: PASS (현 상태 baseline).

- [ ] **Step 2: import 추가 + 두 password 필드 교체**

`SignupEmailForm.tsx` 상단 import에 추가 (FormInput import은 email 필드가 계속 쓰므로 유지):

```tsx
import { PasswordInput } from "@/components/ui/PasswordInput";
```

`90-98` 라인의 비밀번호 `FormInput`을 교체:

```tsx
<PasswordInput
    name="password"
    label="비밀번호"
    error={Boolean(passwordError)}
    autoComplete="new-password"
    value={password}
    onChange={(e) => setPassword(e.target.value)}
/>
```

`101-108` 라인의 비밀번호 확인 `FormInput`을 교체:

```tsx
<PasswordInput
    name="passwordConfirm"
    label="비밀번호 확인"
    autoComplete="new-password"
    value={passwordConfirm}
    onChange={(e) => setPasswordConfirm(e.target.value)}
/>
```

> `type="password"` prop은 `PasswordInput`이 내부 제어하므로 제거한다(props에서 `type` 생략).

- [ ] **Step 3: 회귀 테스트 통과 확인**

Run: `cd frontend && npx vitest run src/components/auth/SignupEmailForm.test.tsx`
Expected: PASS — `getByLabelText("비밀번호")`/`getByLabelText("비밀번호 확인")` 셀렉터가 label 보존으로 계속 동작.

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/components/auth/SignupEmailForm.tsx
git commit -m "feat(auth): 회원가입 비밀번호·비밀번호확인 필드 표시 토글"
```

---

### Task 3: `LoginForm` — password 토글 + 이메일 기억하기

**Files:**
- Modify: `frontend/src/components/auth/LoginForm.tsx`
- Test: `frontend/src/components/auth/LoginForm.test.tsx` (기존 확장)

**Interfaces:**
- Consumes: `PasswordInput` (Task 1).
- Produces: 로그인 password 필드 토글 + "이메일 기억하기" 체크박스(localStorage `writenote.rememberedEmail.v1`).

- [ ] **Step 1: 실패하는 테스트 작성 (기존 파일에 추가)**

`LoginForm.test.tsx`에 다음을 추가. 파일 상단 `afterEach`에 localStorage 정리를 더한다:

기존 `afterEach`를 다음으로 교체:

```tsx
afterEach(() => {
    pushMock.mockClear();
    localStorage.clear();
});
```

`describe("LoginForm", ...)` 블록 안에 테스트 3개 추가:

```tsx
it("이메일 기억하기 체크 후 로그인 성공 시 이메일을 localStorage에 저장한다", async () => {
    server.use(
        http.post(`${ORIGIN}/api/auth/login`, () =>
            HttpResponse.json({ success: true, data: { accessToken: "x" }, error: null }),
        ),
    );
    renderWithClient(<LoginForm />);

    await userEvent.type(screen.getByLabelText("이메일"), "writer@example.com");
    await userEvent.type(screen.getByLabelText("비밀번호"), "Strong!Pass123");
    await userEvent.click(screen.getByLabelText("이메일 기억하기"));
    await userEvent.click(screen.getByRole("button", { name: "로그인" }));

    await waitFor(() =>
        expect(localStorage.getItem("writenote.rememberedEmail.v1")).toBe("writer@example.com"),
    );
});

it("이메일 기억하기 미체크로 로그인 성공 시 저장된 이메일을 삭제한다", async () => {
    localStorage.setItem("writenote.rememberedEmail.v1", "old@example.com");
    server.use(
        http.post(`${ORIGIN}/api/auth/login`, () =>
            HttpResponse.json({ success: true, data: { accessToken: "x" }, error: null }),
        ),
    );
    renderWithClient(<LoginForm />);

    // 마운트 복원으로 체크가 켜지므로 끈다.
    await userEvent.clear(screen.getByLabelText("이메일"));
    await userEvent.type(screen.getByLabelText("이메일"), "writer@example.com");
    const remember = screen.getByLabelText("이메일 기억하기");
    if ((remember as HTMLInputElement).checked) await userEvent.click(remember);
    await userEvent.type(screen.getByLabelText("비밀번호"), "Strong!Pass123");
    await userEvent.click(screen.getByRole("button", { name: "로그인" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/"));
    expect(localStorage.getItem("writenote.rememberedEmail.v1")).toBeNull();
});

it("저장된 이메일이 있으면 마운트 시 이메일칸을 복원하고 체크박스를 켠다", async () => {
    localStorage.setItem("writenote.rememberedEmail.v1", "saved@example.com");
    renderWithClient(<LoginForm />);

    await waitFor(() =>
        expect(screen.getByLabelText("이메일")).toHaveValue("saved@example.com"),
    );
    expect(screen.getByLabelText("이메일 기억하기")).toBeChecked();
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && npx vitest run src/components/auth/LoginForm.test.tsx`
Expected: FAIL — `getByLabelText("이메일 기억하기")` 없음 / localStorage 미저장.

- [ ] **Step 3: `LoginForm` 구현**

`LoginForm.tsx` 변경:

(a) import 추가:

```tsx
import { useEffect, useState } from "react";
```
및
```tsx
import { PasswordInput } from "@/components/ui/PasswordInput";
```

(b) 컴포넌트 상단 상수 + 상태 추가 (`const [password, setPassword] = useState("");` 아래):

```tsx
const [remember, setRemember] = useState(false);

useEffect(() => {
    const saved = localStorage.getItem(REMEMBERED_EMAIL_KEY);
    if (saved) {
        setEmail(saved);
        setRemember(true);
    }
}, []);
```

파일 상단(컴포넌트 바깥, import 아래)에 상수:

```tsx
const REMEMBERED_EMAIL_KEY = "writenote.rememberedEmail.v1";
```

(c) `loginMutation`의 `onSuccess`에 저장/삭제 반영:

```tsx
const loginMutation = useMutation({
    mutationFn: () => login({ email, password }),
    onSuccess: async () => {
        if (remember) localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
        else localStorage.removeItem(REMEMBERED_EMAIL_KEY);
        await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
        router.push("/");
    },
});
```

(d) password `FormInput`(73-81)을 `PasswordInput`으로 교체:

```tsx
<PasswordInput
    name="password"
    label="비밀번호"
    autoComplete="current-password"
    error={errorMessage !== null}
    value={password}
    onChange={(e) => setPassword(e.target.value)}
/>
```

(e) password 필드 아래에 "이메일 기억하기" 체크박스 추가 (password `PasswordInput` 직후, error `<p>` 앞):

```tsx
<label className="flex items-center gap-2 text-sm" style={{ color: "var(--w-ink)" }}>
    <input
        type="checkbox"
        name="rememberEmail"
        checked={remember}
        onChange={(e) => setRemember(e.target.checked)}
    />
    <span>이메일 기억하기</span>
</label>
```

> `FormInput` import는 email 필드가 계속 쓰므로 유지한다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && npx vitest run src/components/auth/LoginForm.test.tsx`
Expected: PASS (기존 3 + 신규 3 = 6 tests).

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/components/auth/LoginForm.tsx frontend/src/components/auth/LoginForm.test.tsx
git commit -m "feat(auth): 로그인 비밀번호 표시 토글 + 이메일 기억하기"
```

---

### Task 4: 전체 검증

**Files:** 없음 (검증만)

- [ ] **Step 1: 프론트 전체 게이트**

Run: `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: 모두 GREEN. (`pnpm build`로 RSC 서버/클라이언트 경계 위반 검출 — `PasswordInput`은 `'use client'` 보유.)

- [ ] **Step 2: dogfooding 안내**

`pnpm dev` 후 `/auth/login`·`/auth/signup`에서:
- 비밀번호 "표시/숨기기" 버튼 위치·정렬 확인 (input 우측에 겹치는지).
- 로그인 시 "이메일 기억하기" 체크 → 재방문 시 이메일 복원·체크 ON 확인.
- 미체크 로그인 후 재방문 시 이메일칸 빈 상태 확인.
- 비밀번호가 localStorage에 저장되지 않음 확인 (DevTools → Application → Local Storage).

---

## Self-Review

**Spec coverage:**
- 비밀번호 토글(회원가입+로그인) → Task 1(컴포넌트) + Task 2(회원가입) + Task 3(로그인). ✅
- 이메일 기억하기(이메일만, localStorage, 마운트 복원, 성공 시 저장/삭제) → Task 3. ✅
- `FormInput` 미수정 / 별도 래퍼 → Task 1. ✅
- 회원가입 두 필드 독립 토글 → Task 2(각 필드가 독립 `PasswordInput` 인스턴스 = 독립 `visible` 상태). ✅
- 테스트(PasswordInput 토글, LoginForm 저장/삭제/복원) → Task 1, Task 3. ✅
- 백엔드 0 / develop / 검증 게이트 → Global Constraints + Task 4. ✅

**Placeholder scan:** 없음 — 모든 step에 실제 코드/명령/기대출력 포함.

**Type consistency:** `PasswordInput` props = `Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { error?; label? }` — Task 2/3 호출부가 `type` 없이 `name`/`label`/`error`/`autoComplete`/`value`/`onChange`만 전달하여 정합. localStorage 키 `"writenote.rememberedEmail.v1"`는 Task 3 상수·테스트에서 동일 문자열 사용.
