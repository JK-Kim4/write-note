# 회원가입 약관 동의 모달 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 회원가입 화면에서 이용약관·개인정보처리방침을 모달로 열람하고 개별 동의(둘 다 필수)할 수 있게 한다.

**Architecture:** 두 약관 본문을 `src/content/legal/` 공유 모듈로 추출해 `/privacy` 페이지와 모달이 같은 소스를 쓰게 한다. `QuickCaptureModal` 패턴을 차용한 범용 `TermsModal`을 신설하고, `SignupEmailForm`을 통합 체크박스 1개 → 개별 2개 + "(보기)" 버튼 구조로 바꾼다.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest + React Testing Library + msw, Tailwind + `--w-*` CSS 토큰.

## Global Constraints

- 백엔드/DB/마이그레이션 변경 **0**. FE 단독 (`vercel --prod`).
- 이벤트 핸들러·`useState`·`useEffect` 사용 컴포넌트는 `'use client'` 의무 (RSC 경계). 작성 직후 `pnpm build`로 검증.
- 약관 본문 공유 모듈(`PrivacyContent`/`TermsContent`/`legalPrimitives`)은 핸들러 없는 순수 표시 컴포넌트 → server component 유지.
- TypeScript: `any` 금지, named export 의무(Next.js page/layout 예외), `type` 우선.
- 테스트: 행위 기준(`getByRole`/`getByText`), mock 은 시스템 경계(msw)만.
- 스타일: 기존 `--w-canvas`/`--w-ink`/`--w-hairline`/`--w-accent`/`--w-ink-faint` 토큰·인라인 스타일 패턴 답습.
- 검증 명령: `cd frontend && npx vitest run <파일>` (단위), `cd frontend && pnpm build` (RSC 경계), 최종 `pnpm lint`.

## 선행 사실 (코드 확인 완료 2026-06-21)

- `SignupEmailForm.test.tsx` 첫 테스트는 **baseline 에서 이미 실패**(코드는 `/auth/verify-pending?email=...` push, 테스트는 `/auth/verify-pending` 기대). 내 작업과 무관한 선행 회귀. Task 4 에서 테스트 파일을 수정하는 김에 assertion 을 `stringContaining` 으로 정정한다(최소 수정).
- 기존 `fillForm()` 은 `getByRole("checkbox")` 단수 사용 → 체크박스 2개가 되면 깨짐 → Task 4 에서 갱신.
- `/privacy` 페이지 전용 테스트 없음. msw signup 기본 핸들러 없음(테스트마다 `server.use`).

---

### Task 1: 약관 본문 공유 모듈 추출 (개인정보처리방침)

**목표:** `/privacy/page.tsx` 의 헬퍼(`Section`/`SubTitle`/`Table`)와 본문을 `src/content/legal/` 로 추출하고, 페이지는 추출본을 import 하도록 리팩토링한다. 외관·URL·metadata 불변. (순수 리팩토링)

**Files:**
- Create: `frontend/src/content/legal/legalPrimitives.tsx`
- Create: `frontend/src/content/legal/PrivacyContent.tsx`
- Create: `frontend/src/content/legal/PrivacyContent.test.tsx`
- Modify: `frontend/src/app/privacy/page.tsx`

**Interfaces:**
- Produces:
  - `legalPrimitives.tsx`: `export function Section({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element`, `export function SubTitle({ children }: { children: React.ReactNode }): React.JSX.Element`, `export function Table({ headers, rows }: { headers: string[]; rows: string[][] }): React.JSX.Element`
  - `PrivacyContent.tsx`: `export function PrivacyContent(): React.JSX.Element` (개인정보처리방침 `<h1>`+최종수정일+8개 Section 본문. 바깥 `<main>` 래퍼는 포함하지 않음)

- [ ] **Step 1: 헬퍼 모듈 작성** — `frontend/src/content/legal/legalPrimitives.tsx`

```tsx
/**
 * 약관 본문 공유 프리미티브 — /privacy 페이지와 회원가입 약관 모달이 동일 스타일로 렌더.
 * 핸들러 없는 순수 표시 컴포넌트 (server component 가능).
 */

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section style={{ marginTop: "36px" }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "12px" }}>{title}</h2>
            {children}
        </section>
    );
}

export function SubTitle({ children }: { children: React.ReactNode }) {
    return <p style={{ fontWeight: 600, marginTop: "16px", marginBottom: "8px" }}>{children}</p>;
}

export function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
    return (
        <div style={{ overflowX: "auto", marginBottom: "16px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                <thead>
                    <tr>
                        {headers.map((h) => (
                            <th
                                key={h}
                                style={{
                                    textAlign: "left",
                                    padding: "8px 12px",
                                    borderBottom: "2px solid var(--w-hairline, #e5e5e5)",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i}>
                            {row.map((cell, j) => (
                                <td
                                    key={j}
                                    style={{
                                        padding: "8px 12px",
                                        borderBottom: "1px solid var(--w-hairline, #e5e5e5)",
                                        verticalAlign: "top",
                                    }}
                                >
                                    {cell}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
```

- [ ] **Step 2: 개인정보처리방침 본문 추출** — `frontend/src/content/legal/PrivacyContent.tsx`

기존 `/privacy/page.tsx` 의 `<h1>`부터 마지막 `</Section>`까지를 그대로 옮긴다(헬퍼는 import). 본문 텍스트는 변경 없음.

```tsx
import { Section, SubTitle, Table } from "./legalPrimitives";

/**
 * 개인정보처리방침 본문 — /privacy 페이지 + 회원가입 약관 모달 공유 소스.
 * 카카오 로그인 동의항목 심사 제출용 공개 내용(https://soseolbi.com/privacy)과 동일.
 */
export function PrivacyContent() {
    return (
        <>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "8px" }}>개인정보처리방침</h1>
            <p style={{ color: "var(--w-ink-faint, #888)", fontSize: "0.875rem", marginBottom: "40px" }}>
                최종 수정일: 2026년 6월 17일
            </p>

            <p>
                소설비(이하 &quot;서비스&quot;)은 개인정보보호법 및 관련 법령에 따라 이용자의 개인정보를 보호하고
                이에 관한 고충을 신속하게 처리할 수 있도록 다음과 같이 개인정보처리방침을 수립·공개합니다.
            </p>

            <Section title="1. 수집하는 개인정보 항목 및 수집 방법">
                <p>서비스는 다음의 개인정보를 수집합니다.</p>
                <SubTitle>가. 카카오 로그인 시 수집 항목</SubTitle>
                <Table
                    headers={["항목", "필수/선택", "수집 방법"]}
                    rows={[
                        ["카카오계정 이메일 주소", "필수", "카카오 OAuth2 동의항목"],
                        ["닉네임(프로필 이름)", "필수", "카카오 OAuth2 동의항목"],
                    ]}
                />
                <SubTitle>나. 이메일 직접 가입 시 수집 항목</SubTitle>
                <Table
                    headers={["항목", "필수/선택", "수집 방법"]}
                    rows={[
                        ["이메일 주소", "필수", "회원가입 양식 직접 입력"],
                        ["비밀번호(암호화 저장)", "필수", "회원가입 양식 직접 입력"],
                    ]}
                />
                <SubTitle>다. 서비스 이용 과정에서 자동 생성·수집</SubTitle>
                <ul>
                    <li>서비스 가입 일시, 마지막 로그인 일시</li>
                    <li>서비스 내 작성 콘텐츠(메모, 작품 본문 등) — 이용자가 직접 입력한 데이터</li>
                </ul>
            </Section>

            <Section title="2. 개인정보의 수집 및 이용 목적">
                <Table
                    headers={["수집 항목", "이용 목적"]}
                    rows={[
                        ["이메일 주소, 닉네임", "회원 가입 및 계정 식별·관리, 서비스 이용 안내"],
                        ["이메일 주소", "이메일 인증, 비밀번호 재설정 안내 발송"],
                        ["서비스 이용 일시", "서비스 운영 및 보안 관리"],
                    ]}
                />
            </Section>

            <Section title="3. 개인정보의 보유 및 이용 기간">
                <p>
                    이용자의 개인정보는 회원 탈퇴 시 지체 없이 파기합니다. 단, 관련 법령에 의해 보존할 필요가 있는
                    경우에는 해당 법령에서 정한 기간 동안 보관합니다.
                </p>
                <Table
                    headers={["근거 법령", "보유 항목", "보유 기간"]}
                    rows={[
                        ["전자상거래법", "계약·청약 철회 기록", "5년"],
                        ["전자상거래법", "소비자 불만·분쟁 기록", "3년"],
                        ["통신비밀보호법", "서비스 이용 기록, 접속 로그", "3개월"],
                    ]}
                />
            </Section>

            <Section title="4. 개인정보의 제3자 제공">
                <p>
                    서비스는 원칙적으로 이용자의 개인정보를 외부에 제공하지 않습니다. 다만, 이용자가 사전에 동의한
                    경우 또는 법령의 규정에 의거하거나 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의
                    요구가 있는 경우에는 예외로 합니다.
                </p>
            </Section>

            <Section title="5. 개인정보의 파기 절차 및 방법">
                <p>
                    서비스는 개인정보 보유 기간의 경과, 처리 목적 달성 등으로 인해 개인정보가 불필요하게 되었을 때는
                    지체 없이 해당 개인정보를 파기합니다. 전자적 파일 형태로 기록·저장된 개인정보는 기록을 재생할 수
                    없도록 파기합니다.
                </p>
            </Section>

            <Section title="6. 이용자 및 법정대리인의 권리와 행사 방법">
                <p>이용자는 언제든지 다음 권리를 행사할 수 있습니다.</p>
                <ul>
                    <li>개인정보 열람 요청</li>
                    <li>오류 등이 있을 경우 정정 요청</li>
                    <li>삭제 요청(회원 탈퇴)</li>
                    <li>처리 정지 요청</li>
                </ul>
                <p>
                    권리 행사는 서비스 내 문의 기능 또는 아래 개인정보 보호책임자 이메일을 통해 요청하실 수 있으며,
                    지체 없이 조치하겠습니다.
                </p>
            </Section>

            <Section title="7. 개인정보 보호책임자">
                <Table
                    headers={["항목", "내용"]}
                    rows={[
                        ["성명", "김종완"],
                        ["이메일", "jongbell4@gmail.com"],
                    ]}
                />
                <p>
                    개인정보 처리에 관한 불만, 피해 구제는 개인정보 보호책임자에게 문의하거나 아래 기관에 신고할 수
                    있습니다.
                </p>
                <ul>
                    <li>개인정보침해 신고센터 (privacy.kisa.or.kr / 118)</li>
                    <li>개인정보 분쟁조정위원회 (www.kopico.go.kr / 1833-6972)</li>
                </ul>
            </Section>

            <Section title="8. 개인정보처리방침 변경">
                <p>
                    본 방침은 법령·정책 변경 또는 서비스 변경에 따라 내용이 추가·삭제·수정될 수 있으며, 변경 시
                    서비스 화면을 통해 공지합니다.
                </p>
            </Section>
        </>
    );
}
```

- [ ] **Step 3: /privacy 페이지 리팩토링** — `frontend/src/app/privacy/page.tsx` 전체 교체

```tsx
import type { Metadata } from "next";
import { PrivacyContent } from "@/content/legal/PrivacyContent";

export const metadata: Metadata = {
    title: "개인정보처리방침 | 소설비",
};

/**
 * 개인정보처리방침 — 카카오 로그인 동의항목(이메일·닉네임 필수) 심사 제출용 공개 URL.
 * https://soseolbi.com/privacy. 본문은 src/content/legal/PrivacyContent 공유.
 */
export default function PrivacyPage() {
    return (
        <main
            style={{
                maxWidth: 720,
                margin: "0 auto",
                padding: "48px 24px 80px",
                fontFamily: "var(--font-noto-serif-kr, 'Apple SD Gothic Neo', sans-serif)",
                lineHeight: 1.8,
                color: "var(--w-ink, #1a1a1a)",
            }}
        >
            <PrivacyContent />
        </main>
    );
}
```

- [ ] **Step 4: PrivacyContent 렌더 테스트 작성** — `frontend/src/content/legal/PrivacyContent.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PrivacyContent } from "./PrivacyContent";

describe("PrivacyContent", () => {
    it("개인정보처리방침 핵심 섹션을 렌더한다", () => {
        render(<PrivacyContent />);
        expect(screen.getByRole("heading", { name: "개인정보처리방침", level: 1 })).toBeInTheDocument();
        expect(screen.getByText(/개인정보 보호책임자/)).toBeInTheDocument();
        expect(screen.getByText("jongbell4@gmail.com")).toBeInTheDocument();
    });
});
```

- [ ] **Step 5: 테스트 실행 (GREEN 확인)**

Run: `cd frontend && npx vitest run src/content/legal/PrivacyContent.test.tsx`
Expected: PASS (3 assertions)

- [ ] **Step 6: 빌드로 RSC 경계 검증**

Run: `cd frontend && pnpm build`
Expected: 빌드 성공 (server component 만 추가, 경계 위반 없음)

- [ ] **Step 7: 커밋**

```bash
git add frontend/src/content/legal/legalPrimitives.tsx frontend/src/content/legal/PrivacyContent.tsx frontend/src/content/legal/PrivacyContent.test.tsx frontend/src/app/privacy/page.tsx
git commit -m "refactor(legal): 개인정보처리방침 본문을 공유 모듈로 추출"
```

---

### Task 2: 이용약관 본문 작성 (신규 초안)

**목표:** 소설비 맞춤 이용약관 초안을 `TermsContent` 컴포넌트로 작성한다. 운영자/문의 연락처 섹션 없음(개인정보처리방침에 위임).

**Files:**
- Create: `frontend/src/content/legal/TermsContent.tsx`
- Create: `frontend/src/content/legal/TermsContent.test.tsx`

**Interfaces:**
- Consumes: `legalPrimitives` 의 `Section` (Task 1)
- Produces: `export function TermsContent(): React.JSX.Element` (이용약관 `<h1>`+최종수정일+10개 Section. 바깥 `<main>` 래퍼 없음)

- [ ] **Step 1: 이용약관 본문 작성** — `frontend/src/content/legal/TermsContent.tsx`

```tsx
import { Section } from "./legalPrimitives";

/**
 * 이용약관 본문 — 회원가입 약관 모달 공유 소스.
 * 표준 템플릿 기반 초안(법률 자문 아님). 운영 중 보완될 수 있음.
 */
export function TermsContent() {
    return (
        <>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "8px" }}>이용약관</h1>
            <p style={{ color: "var(--w-ink-faint, #888)", fontSize: "0.875rem", marginBottom: "40px" }}>
                최종 수정일: 2026년 6월 21일
            </p>

            <p>
                본 약관은 소설비(이하 &quot;서비스&quot;)가 제공하는 글쓰기·메모 작업공간 서비스의 이용 조건과
                절차, 이용자와 서비스의 권리·의무 및 책임 사항을 규정합니다. 본 약관은 서비스 운영 과정에서 보완될
                수 있는 초안 성격의 문서이며, 변경 시 서비스 화면을 통해 공지합니다.
            </p>

            <Section title="제1조 (목적)">
                <p>
                    본 약관은 이용자가 서비스를 이용함에 있어 서비스와 이용자 간의 권리, 의무 및 책임사항, 이용
                    조건 및 절차 등 기본적인 사항을 규정함을 목적으로 합니다.
                </p>
            </Section>

            <Section title="제2조 (정의)">
                <ul>
                    <li>&quot;서비스&quot;란 이용자가 메모와 글을 작성·보관·관리할 수 있도록 제공되는 온라인 작업공간을 말합니다.</li>
                    <li>&quot;이용자&quot;란 본 약관에 동의하고 서비스에 가입하여 서비스를 이용하는 자를 말합니다.</li>
                    <li>&quot;콘텐츠&quot;란 이용자가 서비스 내에서 작성·저장한 메모, 작품 본문, 등장인물 정보 등 일체의 데이터를 말합니다.</li>
                </ul>
            </Section>

            <Section title="제3조 (약관의 효력 및 변경)">
                <p>
                    본 약관은 서비스 화면에 게시하거나 기타의 방법으로 이용자에게 공지함으로써 효력이 발생합니다.
                    서비스는 관련 법령을 위배하지 않는 범위에서 본 약관을 변경할 수 있으며, 변경 시 적용일자 및
                    변경 사유를 명시하여 사전에 공지합니다.
                </p>
            </Section>

            <Section title="제4조 (서비스의 제공 및 변경)">
                <p>
                    서비스는 이용자에게 메모·글 작성, 저장, 조회 및 이와 관련된 부가 기능을 제공합니다. 서비스는
                    운영상·기술상의 필요에 따라 제공하는 서비스의 내용을 변경하거나 중단할 수 있으며, 이 경우 사전에
                    공지하도록 노력합니다.
                </p>
            </Section>

            <Section title="제5조 (회원가입 및 계정)">
                <p>
                    이용자는 서비스가 정한 절차에 따라 이메일 또는 외부 인증(카카오 등)을 통해 회원가입을 신청하며,
                    서비스가 이를 승낙함으로써 계정이 생성됩니다. 이용자는 계정 정보를 정확하게 유지할 책임이 있으며,
                    계정의 관리 소홀로 발생한 불이익에 대한 책임은 이용자 본인에게 있습니다.
                </p>
            </Section>

            <Section title="제6조 (이용자의 의무)">
                <p>이용자는 다음 각 호의 행위를 하여서는 안 됩니다.</p>
                <ul>
                    <li>타인의 계정·개인정보를 도용하거나 부정하게 사용하는 행위</li>
                    <li>서비스의 정상적인 운영을 방해하는 행위</li>
                    <li>법령 또는 공서양속에 위반되는 콘텐츠를 작성·유포하는 행위</li>
                    <li>타인의 권리(저작권 등)를 침해하는 행위</li>
                </ul>
            </Section>

            <Section title="제7조 (콘텐츠의 저작권)">
                <p>
                    이용자가 서비스 내에서 작성한 콘텐츠의 저작권은 작성자인 이용자 본인에게 귀속됩니다. 서비스는
                    콘텐츠를 이용자에게 표시·보관·전송하는 등 서비스 제공 및 운영에 필요한 범위 내에서만 콘텐츠를
                    처리하며, 이용자의 동의 없이 콘텐츠를 외부에 공개하거나 제3자에게 제공하지 않습니다.
                </p>
            </Section>

            <Section title="제8조 (서비스 이용의 중단 및 해지)">
                <p>
                    이용자는 언제든지 서비스 내 기능 또는 문의를 통해 회원 탈퇴(이용계약 해지)를 신청할 수 있습니다.
                    탈퇴 시 이용자의 개인정보 및 콘텐츠는 개인정보처리방침에 따라 처리됩니다. 서비스는 이용자가 본
                    약관을 위반한 경우 사전 통지 후 이용을 제한하거나 계약을 해지할 수 있습니다.
                </p>
            </Section>

            <Section title="제9조 (면책)">
                <p>
                    서비스는 천재지변, 불가항력, 이용자의 귀책사유로 인한 서비스 이용 장애에 대하여 책임을 지지
                    않습니다. 서비스는 무료로 제공되는 서비스의 이용과 관련하여 관련 법령에 특별한 규정이 없는 한
                    책임을 지지 않으나, 이용자의 콘텐츠가 유실되지 않도록 합리적인 수준의 보관 조치를 취합니다.
                </p>
            </Section>

            <Section title="제10조 (준거법 및 분쟁 해결)">
                <p>
                    본 약관은 대한민국 법령에 따라 해석되며, 서비스 이용과 관련하여 분쟁이 발생한 경우 서비스와
                    이용자는 신의성실의 원칙에 따라 원만히 해결하도록 노력합니다. 협의가 이루어지지 않을 경우
                    관련 법령 및 절차에 따릅니다.
                </p>
            </Section>
        </>
    );
}
```

- [ ] **Step 2: 이용약관 렌더 테스트 작성** — `frontend/src/content/legal/TermsContent.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TermsContent } from "./TermsContent";

describe("TermsContent", () => {
    it("이용약관 제목과 콘텐츠 저작권 조항을 렌더한다", () => {
        render(<TermsContent />);
        expect(screen.getByRole("heading", { name: "이용약관", level: 1 })).toBeInTheDocument();
        expect(screen.getByText(/콘텐츠의 저작권/)).toBeInTheDocument();
        expect(screen.getByText(/작성자인 이용자 본인에게 귀속/)).toBeInTheDocument();
    });
});
```

- [ ] **Step 3: 테스트 실행 (GREEN 확인)**

Run: `cd frontend && npx vitest run src/content/legal/TermsContent.test.tsx`
Expected: PASS

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/content/legal/TermsContent.tsx frontend/src/content/legal/TermsContent.test.tsx
git commit -m "feat(legal): 이용약관 초안 작성 (콘텐츠 저작권 작가 귀속)"
```

---

### Task 3: TermsModal 컴포넌트

**목표:** `QuickCaptureModal` 패턴 차용한 범용 약관 모달. 긴 본문 세로 스크롤, 닫기 3경로(✕/Escape/백드롭).

**Files:**
- Create: `frontend/src/components/auth/TermsModal.tsx`
- Create: `frontend/src/components/auth/TermsModal.test.tsx`

**Interfaces:**
- Produces: `export function TermsModal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }): React.JSX.Element`
- 동작: 마운트 즉시 표시(조건부 렌더는 부모가 담당). `role="dialog"`, `aria-modal="true"`, `aria-label={title}`. Escape/✕/백드롭 클릭 시 `onClose` 호출.

- [ ] **Step 1: 실패 테스트 작성** — `frontend/src/components/auth/TermsModal.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TermsModal } from "./TermsModal";

describe("TermsModal", () => {
    it("제목과 본문을 dialog 로 렌더한다", () => {
        render(
            <TermsModal title="이용약관" onClose={vi.fn()}>
                <p>약관 본문입니다.</p>
            </TermsModal>,
        );
        const dialog = screen.getByRole("dialog", { name: "이용약관" });
        expect(dialog).toBeInTheDocument();
        expect(screen.getByText("약관 본문입니다.")).toBeInTheDocument();
    });

    it("닫기 버튼 클릭 시 onClose 를 호출한다", async () => {
        const onClose = vi.fn();
        render(
            <TermsModal title="이용약관" onClose={onClose}>
                <p>본문</p>
            </TermsModal>,
        );
        await userEvent.click(screen.getByRole("button", { name: "닫기" }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("Escape 키 입력 시 onClose 를 호출한다", async () => {
        const onClose = vi.fn();
        render(
            <TermsModal title="이용약관" onClose={onClose}>
                <p>본문</p>
            </TermsModal>,
        );
        await userEvent.keyboard("{Escape}");
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
```

- [ ] **Step 2: 테스트 실행 (FAIL 확인)**

Run: `cd frontend && npx vitest run src/components/auth/TermsModal.test.tsx`
Expected: FAIL ("TermsModal" 미정의 / import 실패)

- [ ] **Step 3: TermsModal 구현** — `frontend/src/components/auth/TermsModal.tsx`

```tsx
"use client";

import { useEffect } from "react";

/**
 * TermsModal — 회원가입 약관(이용약관·개인정보처리방침) 열람 모달.
 * QuickCaptureModal 패턴 차용. 긴 본문 세로 스크롤. 닫기: ✕ / Escape / 백드롭.
 */

interface TermsModalProps {
    title: string;
    children: React.ReactNode;
    onClose: () => void;
}

export function TermsModal({ title, children, onClose }: TermsModalProps) {
    useEffect(() => {
        const handleKey = (e: KeyboardEvent): void => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [onClose]);

    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>): void => {
        if (e.target === e.currentTarget) onClose();
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
            onClick={handleBackdropClick}
        >
            <div
                className="w-full max-w-2xl rounded-card-memo flex flex-col"
                style={{
                    backgroundColor: "var(--w-canvas)",
                    border: "1px solid var(--w-hairline)",
                    maxHeight: "85vh",
                }}
            >
                <div
                    className="flex items-center justify-between px-6 py-4"
                    style={{ borderBottom: "1px solid var(--w-hairline)" }}
                >
                    <h2 className="font-display font-semibold" style={{ fontSize: "18px", color: "var(--w-ink)" }}>
                        {title}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="닫기"
                        className="text-xl leading-none px-2"
                        style={{ color: "var(--w-ink)", background: "none", border: "none", cursor: "pointer" }}
                    >
                        ✕
                    </button>
                </div>
                <div
                    className="overflow-y-auto px-6 py-4"
                    style={{
                        color: "var(--w-ink)",
                        fontFamily: "var(--font-noto-serif-kr, 'Apple SD Gothic Neo', sans-serif)",
                        lineHeight: 1.8,
                    }}
                >
                    {children}
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 4: 테스트 실행 (GREEN 확인)**

Run: `cd frontend && npx vitest run src/components/auth/TermsModal.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/components/auth/TermsModal.tsx frontend/src/components/auth/TermsModal.test.tsx
git commit -m "feat(auth): 약관 열람 모달 TermsModal 추가"
```

---

### Task 4: SignupEmailForm 결선 (개별 2개 동의 + 보기 모달)

**목표:** 통합 체크박스 1개 → 이용약관/개인정보처리방침 개별 2개 + 각 "(보기)" 버튼 → 모달. 검증을 둘 다 동의로 변경. 기존 테스트 갱신 + 신규 행위 테스트.

**Files:**
- Modify: `frontend/src/components/auth/SignupEmailForm.tsx`
- Modify: `frontend/src/components/auth/SignupEmailForm.test.tsx`

**Interfaces:**
- Consumes: `TermsModal` (Task 3), `TermsContent` (Task 2), `PrivacyContent` (Task 1)

- [ ] **Step 1: 기존 테스트 갱신 (2개 체크박스 대응 + 선행 회귀 정정)** — `frontend/src/components/auth/SignupEmailForm.test.tsx`

`fillForm()` 을 2개 체크박스 클릭으로 바꾸고, 선행 실패(verify-pending 쿼리 파라미터) assertion 을 `stringContaining` 으로 정정한다.

`fillForm` 교체:

```tsx
async function fillForm() {
    await userEvent.type(screen.getByLabelText("이메일"), "writer@example.com");
    await userEvent.type(screen.getByLabelText("비밀번호"), "Strong!Pass123");
    await userEvent.type(screen.getByLabelText("비밀번호 확인"), "Strong!Pass123");
    await userEvent.click(screen.getByRole("checkbox", { name: /이용약관/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: /개인정보/ }));
}
```

성공 이동 assertion 정정 (line 48):

```tsx
        await waitFor(() =>
            expect(pushMock).toHaveBeenCalledWith(expect.stringContaining("/auth/verify-pending")),
        );
```

비밀번호 불일치 테스트의 체크박스 클릭(기존 line 81) 교체:

```tsx
        await userEvent.click(screen.getByRole("checkbox", { name: /이용약관/ }));
        await userEvent.click(screen.getByRole("checkbox", { name: /개인정보/ }));
```

- [ ] **Step 2: 신규 행위 테스트 추가** — 같은 파일 `describe` 내에 추가

```tsx
    it("약관에 모두 동의하지 않으면 가입 요청을 보내지 않는다", async () => {
        let posted = false;
        server.use(
            http.post(`${ORIGIN}/api/auth/signup/email`, () => {
                posted = true;
                return HttpResponse.json({ success: true, data: {}, error: null }, { status: 201 });
            }),
        );
        renderWithClient(<SignupEmailForm />);

        await userEvent.type(screen.getByLabelText("이메일"), "writer@example.com");
        await userEvent.type(screen.getByLabelText("비밀번호"), "Strong!Pass123");
        await userEvent.type(screen.getByLabelText("비밀번호 확인"), "Strong!Pass123");
        await userEvent.click(screen.getByRole("checkbox", { name: /이용약관/ }));
        // 개인정보처리방침 미동의 상태로 제출
        await userEvent.click(screen.getByRole("button", { name: "가입하기" }));

        expect(await screen.findByText(/모두 동의/)).toBeInTheDocument();
        expect(posted).toBe(false);
    });

    it("이용약관 보기 클릭 시 약관 모달 본문을 표시한다", async () => {
        renderWithClient(<SignupEmailForm />);
        await userEvent.click(screen.getByRole("button", { name: "이용약관 보기" }));
        const dialog = await screen.findByRole("dialog", { name: "이용약관" });
        expect(dialog).toBeInTheDocument();
        expect(screen.getByText(/콘텐츠의 저작권/)).toBeInTheDocument();
    });
```

- [ ] **Step 3: 테스트 실행 (FAIL 확인)**

Run: `cd frontend && npx vitest run src/components/auth/SignupEmailForm.test.tsx`
Expected: FAIL (체크박스 name 미지정 / "이용약관 보기" 버튼 부재 / "모두 동의" 메시지 부재)

- [ ] **Step 4: SignupEmailForm 구현** — `frontend/src/components/auth/SignupEmailForm.tsx`

import 추가 (파일 상단 import 블록):

```tsx
import { TermsModal } from "@/components/auth/TermsModal";
import { TermsContent } from "@/content/legal/TermsContent";
import { PrivacyContent } from "@/content/legal/PrivacyContent";
```

상태 교체 (기존 `const [agreed, setAgreed] = useState(false);` 대체):

```tsx
    const [agreedTerms, setAgreedTerms] = useState(false);
    const [agreedPrivacy, setAgreedPrivacy] = useState(false);
    const [openModal, setOpenModal] = useState<"terms" | "privacy" | null>(null);
```

검증 교체 (기존 `if (!agreed) { ... }` 블록 대체):

```tsx
        if (!agreedTerms || !agreedPrivacy) {
            setLocalError("이용약관과 개인정보처리방침에 모두 동의해주세요.");
            return;
        }
```

체크박스 UI 교체 (기존 `<label> ... 이용약관 및 개인정보 처리방침에 동의합니다. ... </label>` 한 블록 대체):

```tsx
            <div className="flex flex-col gap-2 mt-2 text-sm" style={{ color: "var(--w-ink)" }}>
                <div className="flex items-center justify-between gap-2">
                    <label className="flex items-start gap-2">
                        <input
                            type="checkbox"
                            name="terms"
                            className="mt-1"
                            checked={agreedTerms}
                            onChange={(e) => setAgreedTerms(e.target.checked)}
                        />
                        <span>(필수) 이용약관에 동의합니다.</span>
                    </label>
                    <button
                        type="button"
                        onClick={() => setOpenModal("terms")}
                        className="underline underline-offset-2 shrink-0"
                        style={{ color: "var(--w-accent)" }}
                    >
                        이용약관 보기
                    </button>
                </div>
                <div className="flex items-center justify-between gap-2">
                    <label className="flex items-start gap-2">
                        <input
                            type="checkbox"
                            name="privacy"
                            className="mt-1"
                            checked={agreedPrivacy}
                            onChange={(e) => setAgreedPrivacy(e.target.checked)}
                        />
                        <span>(필수) 개인정보처리방침에 동의합니다.</span>
                    </label>
                    <button
                        type="button"
                        onClick={() => setOpenModal("privacy")}
                        className="underline underline-offset-2 shrink-0"
                        style={{ color: "var(--w-accent)" }}
                    >
                        개인정보처리방침 보기
                    </button>
                </div>
            </div>
```

모달 렌더 추가 (form 닫는 `</form>` 직후, 컴포넌트 return 의 최상위가 단일 노드가 아니게 되므로 Fragment 로 감싼다). return 을 다음 구조로 변경:

```tsx
    return (
        <>
            <form
                className="flex flex-col gap-4"
                style={{ opacity: pending ? 0.6 : 1, pointerEvents: pending ? "none" : "auto" }}
                onSubmit={handleSubmit}
            >
                {/* ... 기존 FormInput 3개 + 에러 + 위의 체크박스 div + localError + 가입 버튼 그대로 ... */}
            </form>
            {openModal === "terms" ? (
                <TermsModal title="이용약관" onClose={() => setOpenModal(null)}>
                    <TermsContent />
                </TermsModal>
            ) : null}
            {openModal === "privacy" ? (
                <TermsModal title="개인정보처리방침" onClose={() => setOpenModal(null)}>
                    <PrivacyContent />
                </TermsModal>
            ) : null}
        </>
    );
```

> 주의: `PrivacyContent` 의 `<h1>` 은 "개인정보처리방침" 텍스트를 포함하고 모달 헤더 title 도 "개인정보처리방침" 이라 `getByRole("dialog", { name: ... })` 의 accessible name 은 `aria-label`(="개인정보처리방침") 로 결정되므로 충돌 없음. 단 본문 `<h1>` 중복 표시는 허용(스크롤 영역 안). 이용약관도 동일.

- [ ] **Step 5: 테스트 실행 (GREEN 확인)**

Run: `cd frontend && npx vitest run src/components/auth/SignupEmailForm.test.tsx`
Expected: PASS (기존 3개 정정 포함 + 신규 2개 = 5 tests)

- [ ] **Step 6: 커밋**

```bash
git add frontend/src/components/auth/SignupEmailForm.tsx frontend/src/components/auth/SignupEmailForm.test.tsx
git commit -m "feat(auth): 회원가입 약관 개별 2개 동의 + 보기 모달 결선"
```

---

### Task 5: 전체 검증

**목표:** 회귀 없음 + RSC 경계 + lint 통과 확인.

- [ ] **Step 1: 전체 테스트**

Run: `cd frontend && npx vitest run`
Expected: 전체 PASS (신규 파일 포함, 기존 회귀 없음)

- [ ] **Step 2: 빌드 (RSC 경계 검증)**

Run: `cd frontend && pnpm build`
Expected: 빌드 성공

- [ ] **Step 3: lint**

Run: `cd frontend && pnpm lint`
Expected: 통과

- [ ] **Step 4: dogfooding 안내 (사용자)**

자동 검증 GREEN 후, 실제 회원가입 화면(`/auth/signup-email`)에서 다음을 사용자 dogfooding 으로 확인 권장 (자동 테스트가 못 잡는 영역):
- "이용약관 보기"/"개인정보처리방침 보기" 클릭 → 모달 본문 스크롤
- 라이트/다크 테마 표시, 모바일 폭에서 체크박스+버튼 레이아웃
- 두 체크박스 모두 체크해야 가입 진행

---

## Self-Review

**1. Spec coverage:**
- §4-1 약관 본문 모듈(legalPrimitives/PrivacyContent/TermsContent) → Task 1, 2 ✓
- §4-2 TermsModal → Task 3 ✓
- §4-3 SignupEmailForm 개별 2개 + 보기 + 검증 → Task 4 ✓
- §4-4 /privacy 페이지 추출본 사용 → Task 1 Step 3 ✓
- §7 테스트(동의 검증/모달 표시/닫기) → Task 3·4 테스트 ✓
- §8 RSC 경계 → 각 Task 빌드 + Task 5 ✓
- 운영자 연락처 이용약관 제외 (사용자 결정) → Task 2 본문에 문의 섹션 없음 ✓

**2. Placeholder scan:** TBD/TODO 없음. 모든 코드 step 에 완전한 코드 포함. (Task 4 Step 4 의 form 내부 "기존 그대로" 주석은 기존 파일 보존 지시이며 신규 코드 아님 — 실제 구현 시 기존 JSX 유지)

**3. Type consistency:** `TermsModal({ title, children, onClose })` 시그니처가 Task 3 정의와 Task 4 사용처 일치. `openModal: "terms" | "privacy" | null` 일관. `Section`/`SubTitle`/`Table` props 가 Task 1 정의와 Task 2 사용 일치.
