# 어드민 공지 마크다운 스타일링 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 어드민 공지 본문을 마크다운으로 작성(경량 툴바)하고 사용자 `/notice/[id]`에서 제목·볼드·글머리표로 렌더한다(이미지 제외).

**Architecture:** `body`(TEXT)를 마크다운 문자열로 해석 — 백엔드/스키마 변경 0. 사용자앱은 `react-markdown`+`remark-breaks`로 상세만 렌더(원시 HTML 차단 = XSS-safe). 어드민은 textarea + 순수 함수 기반 마커 삽입 툴바 + 미리보기.

**Tech Stack:** Next.js 16(App Router) · React 19 · TypeScript(strict) · Tailwind v4 · `react-markdown@^9` · `remark-breaks@^4` · Vitest+RTL(frontend) / Vitest(admin-site node)

## Global Constraints

- 백엔드 변경 0 — `Announcement.body`는 TEXT 그대로, 마이그레이션/엔드포인트/DTO 무변경.
- `react-markdown`에 `rehype-raw` **미사용**(원시 HTML 차단). sanitize 라이브러리 추가 금지.
- 단일 줄바꿈 보존을 위해 `remark-breaks` 사용(기존 평문 공지 호환).
- 사용자앱 변경은 `/notice/[id]` 상세만 — `/notice` 목록·홈 배너는 제목만이라 **무변경**.
- 이벤트 핸들러/hook 컴포넌트는 `'use client'`. 작성 직후 해당 앱 `pnpm build`로 RSC 경계 검출.
- frontend 명령은 `frontend/`, admin-site 명령은 `admin-site/` cwd 고정.
- Named export(컴포넌트 PascalCase). `any` 금지.
- 배포 = FE 단독(develop 직접). 백엔드 재배포 불필요.

---

### Task 1: 사용자앱 마크다운 렌더 컴포넌트 `AnnouncementBody`

**Files:**
- Create: `frontend/src/components/AnnouncementBody.tsx`
- Create: `frontend/src/components/AnnouncementBody.test.tsx`
- Modify: `frontend/package.json` (deps: react-markdown, remark-breaks)

**Interfaces:**
- Produces: `AnnouncementBody({ body }: { body: string }): JSX.Element` — 마크다운 문자열을 렌더(제목 h2/h3, ul/ol, strong, p, a). 원시 HTML 미렌더.

- [ ] **Step 1: 의존성 추가**

Run: `cd frontend && pnpm add react-markdown@^9 remark-breaks@^4`
Expected: package.json dependencies에 두 패키지 추가, 설치 성공.

- [ ] **Step 2: 실패 테스트 작성**

`frontend/src/components/AnnouncementBody.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnnouncementBody } from "./AnnouncementBody";

describe("AnnouncementBody", () => {
    it("제목·볼드·글머리표를 해당 요소로 렌더한다", () => {
        render(<AnnouncementBody body={"## 이벤트 안내\n\n**메가커피** 증정\n\n- 항목 1\n- 항목 2"} />);
        expect(screen.getByRole("heading", { level: 2, name: "이벤트 안내" })).toBeInTheDocument();
        expect(screen.getByText("메가커피").tagName).toBe("STRONG");
        expect(screen.getAllByRole("listitem")).toHaveLength(2);
    });

    it("단일 줄바꿈을 br 로 보존한다(기존 평문 호환)", () => {
        const { container } = render(<AnnouncementBody body={"첫째 줄\n둘째 줄"} />);
        expect(container.querySelector("br")).not.toBeNull();
    });

    it("원시 HTML 을 실행하지 않는다(XSS-safe)", () => {
        const { container } = render(<AnnouncementBody body={"<script>alert(1)</script> 안전"} />);
        expect(container.querySelector("script")).toBeNull();
    });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `cd frontend && npx vitest run src/components/AnnouncementBody.test.tsx`
Expected: FAIL — `AnnouncementBody` 모듈 없음.

- [ ] **Step 4: 컴포넌트 구현**

`frontend/src/components/AnnouncementBody.tsx`:
```tsx
"use client";

import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";

/**
 * 공지 본문 마크다운 렌더 (032) — 제목/볼드/글머리표 수준.
 * remark-breaks 로 단일 줄바꿈 보존(기존 평문 공지 호환). rehype-raw 미사용 → 원시 HTML 차단(XSS-safe).
 */
export function AnnouncementBody({ body }: { body: string }) {
    return (
        <div className="text-sm leading-relaxed text-gray-800">
            <ReactMarkdown
                remarkPlugins={[remarkBreaks]}
                components={{
                    h2: (props) => <h2 className="mb-2 mt-4 text-lg font-bold text-gray-900" {...props} />,
                    h3: (props) => <h3 className="mb-1.5 mt-3 text-base font-bold text-gray-900" {...props} />,
                    p: (props) => <p className="my-2" {...props} />,
                    ul: (props) => <ul className="my-2 list-disc space-y-1 pl-5" {...props} />,
                    ol: (props) => <ol className="my-2 list-decimal space-y-1 pl-5" {...props} />,
                    strong: (props) => <strong className="font-semibold" {...props} />,
                    a: (props) => <a className="text-teal-700 underline" {...props} />,
                }}
            >
                {body}
            </ReactMarkdown>
        </div>
    );
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd frontend && npx vitest run src/components/AnnouncementBody.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: 커밋**

```bash
git add frontend/package.json frontend/pnpm-lock.yaml frontend/src/components/AnnouncementBody.tsx frontend/src/components/AnnouncementBody.test.tsx
git commit -m "feat(notice): 공지 본문 마크다운 렌더 컴포넌트 AnnouncementBody (032)"
```

---

### Task 2: `/notice/[id]` 상세에 `AnnouncementBody` 적용

**Files:**
- Modify: `frontend/src/app/(main)/notice/[id]/page.tsx`

**Interfaces:**
- Consumes: `AnnouncementBody({ body })` (Task 1)

- [ ] **Step 1: 본문 렌더 교체**

`frontend/src/app/(main)/notice/[id]/page.tsx` 에서 import 추가:
```tsx
import { AnnouncementBody } from "@/components/AnnouncementBody";
```
그리고 본문 div 교체 — 기존:
```tsx
                    <div className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{data.body}</div>
```
신규:
```tsx
                    <div className="mt-5">
                        <AnnouncementBody body={data.body} />
                    </div>
```

- [ ] **Step 2: 빌드(RSC 경계) 확인**

Run: `cd frontend && pnpm build`
Expected: 성공. `/notice/[id]` 라우트 정상 생성.

- [ ] **Step 3: 커밋**

```bash
git add "frontend/src/app/(main)/notice/[id]/page.tsx"
git commit -m "feat(notice): 공지 상세를 마크다운 렌더로 교체 (032)"
```

---

### Task 3: 어드민 마크다운 툴바 순수 함수 `applyMarkdown` (+ admin-site vitest 셋업)

**Files:**
- Create: `admin-site/src/lib/markdownToolbar.ts`
- Create: `admin-site/src/lib/markdownToolbar.test.ts`
- Modify: `admin-site/package.json` (devDep: vitest, script: test)
- Create: `admin-site/vitest.config.ts`

**Interfaces:**
- Produces:
  - `type MarkdownKind = "h2" | "h3" | "bold" | "bullet"`
  - `interface MarkdownEdit { text: string; selStart: number; selEnd: number }`
  - `applyMarkdown(text: string, start: number, end: number, kind: MarkdownKind): MarkdownEdit` — 선택영역/커서 위치에 마크다운 마커를 삽입한 새 텍스트 + 갱신된 선택 범위 반환(순수).

- [ ] **Step 1: vitest 셋업**

Run: `cd admin-site && pnpm add -D vitest`
그리고 `admin-site/package.json` scripts 에 추가:
```json
    "test": "vitest run",
```
`admin-site/vitest.config.ts` 생성(순수 함수라 node 환경):
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node" },
});
```

- [ ] **Step 2: 실패 테스트 작성**

`admin-site/src/lib/markdownToolbar.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { applyMarkdown } from "./markdownToolbar";

describe("applyMarkdown", () => {
    it("선택영역을 볼드로 감싼다", () => {
        const r = applyMarkdown("abc", 0, 3, "bold");
        expect(r.text).toBe("**abc**");
        expect([r.selStart, r.selEnd]).toEqual([2, 5]);
    });

    it("빈 커서에서 볼드는 ** ** 삽입 후 가운데 커서", () => {
        const r = applyMarkdown("", 0, 0, "bold");
        expect(r.text).toBe("****");
        expect([r.selStart, r.selEnd]).toEqual([2, 2]);
    });

    it("h2 는 현재 줄 앞에 '## ' 삽입", () => {
        const r = applyMarkdown("제목", 0, 0, "h2");
        expect(r.text).toBe("## 제목");
    });

    it("h3 는 현재 줄 앞에 '### ' 삽입(줄 중간 커서도 줄 시작에)", () => {
        const r = applyMarkdown("ab\ncd", 4, 4, "h3");
        expect(r.text).toBe("ab\n### cd");
    });

    it("글머리표는 선택된 각 줄 앞에 '- ' 삽입", () => {
        const r = applyMarkdown("a\nb", 0, 3, "bullet");
        expect(r.text).toBe("- a\n- b");
    });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `cd admin-site && npx vitest run src/lib/markdownToolbar.test.ts`
Expected: FAIL — `applyMarkdown` 없음.

- [ ] **Step 4: 구현**

`admin-site/src/lib/markdownToolbar.ts`:
```ts
/** 어드민 공지 마크다운 툴바 (032) — 순수 마커 삽입. */
export type MarkdownKind = "h2" | "h3" | "bold" | "bullet";

export interface MarkdownEdit {
    text: string;
    selStart: number;
    selEnd: number;
}

const linePrefix = (
    text: string,
    start: number,
    end: number,
    prefix: string,
): MarkdownEdit => {
    const lineStart = text.lastIndexOf("\n", start - 1) + 1;
    const before = text.slice(0, lineStart);
    const region = text.slice(lineStart, end);
    const rest = text.slice(end);
    const prefixed = region
        .split("\n")
        .map((line) => prefix + line)
        .join("\n");
    const next = before + prefixed + rest;
    return { text: next, selStart: lineStart, selEnd: lineStart + prefixed.length };
};

export function applyMarkdown(
    text: string,
    start: number,
    end: number,
    kind: MarkdownKind,
): MarkdownEdit {
    if (kind === "bold") {
        const selected = text.slice(start, end);
        const next = text.slice(0, start) + "**" + selected + "**" + text.slice(end);
        return { text: next, selStart: start + 2, selEnd: start + 2 + selected.length };
    }
    if (kind === "h2") return linePrefix(text, start, end, "## ");
    if (kind === "h3") return linePrefix(text, start, end, "### ");
    return linePrefix(text, start, end, "- "); // bullet
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd admin-site && npx vitest run src/lib/markdownToolbar.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: 커밋**

```bash
git add admin-site/package.json admin-site/pnpm-lock.yaml admin-site/vitest.config.ts admin-site/src/lib/markdownToolbar.ts admin-site/src/lib/markdownToolbar.test.ts
git commit -m "feat(admin): 공지 마크다운 툴바 순수 함수 applyMarkdown + vitest (032)"
```

---

### Task 4: 어드민 `AnnouncementForm` 툴바 버튼 + 미리보기

**Files:**
- Modify: `admin-site/src/app/(admin)/announcements/AnnouncementForm.tsx`
- Modify: `admin-site/package.json` (deps: react-markdown, remark-breaks)

**Interfaces:**
- Consumes: `applyMarkdown` (Task 3)

- [ ] **Step 1: 렌더 의존성 추가(미리보기용)**

Run: `cd admin-site && pnpm add react-markdown@^9 remark-breaks@^4`
Expected: 설치 성공.

- [ ] **Step 2: 폼에 툴바·미리보기 결선**

`admin-site/src/app/(admin)/announcements/AnnouncementForm.tsx` 수정. import 추가:
```tsx
import { useRef, useState, type FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import { applyMarkdown, type MarkdownKind } from "@/lib/markdownToolbar";
```
(기존 `useState`/`FormEvent` import 줄은 위 한 줄로 대체)

body textarea 를 ref 로 잡고 툴바 추가 — 기존 body `<div>` 블록을 아래로 교체:
```tsx
            <div>
                <div className="mb-1 flex items-center gap-2">
                    <label htmlFor="body" className="text-sm font-medium text-slate-700">본문</label>
                    <div className="ml-auto flex gap-1">
                        {([
                            ["h2", "제목"],
                            ["h3", "소제목"],
                            ["bold", "굵게"],
                            ["bullet", "목록"],
                        ] as [MarkdownKind, string][]).map(([kind, label]) => (
                            <button
                                key={kind}
                                type="button"
                                onClick={() => runMarker(kind)}
                                className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100"
                            >
                                {label}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={() => setPreview((p) => !p)}
                            className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100"
                        >
                            {preview ? "편집" : "미리보기"}
                        </button>
                    </div>
                </div>
                {preview ? (
                    <div className="min-h-[16rem] rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-800">
                        <ReactMarkdown remarkPlugins={[remarkBreaks]}>{body}</ReactMarkdown>
                    </div>
                ) : (
                    <textarea
                        id="body"
                        ref={bodyRef}
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        rows={12}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-slate-500"
                    />
                )}
            </div>
```
컴포넌트 상단(상태 선언부)에 추가:
```tsx
    const bodyRef = useRef<HTMLTextAreaElement>(null);
    const [preview, setPreview] = useState(false);

    const runMarker = (kind: MarkdownKind) => {
        const ta = bodyRef.current;
        if (!ta) return;
        const result = applyMarkdown(body, ta.selectionStart, ta.selectionEnd, kind);
        setBody(result.text);
        // 다음 틱에 선택 복원
        requestAnimationFrame(() => {
            ta.focus();
            ta.setSelectionRange(result.selStart, result.selEnd);
        });
    };
```
(기존 textarea 블록은 위 분기 textarea 로 대체 — 중복 제거.)

- [ ] **Step 3: 빌드(RSC 경계) 확인**

Run: `cd admin-site && pnpm build`
Expected: 성공(컴포넌트는 이미 `"use client"`). 라우트 정상.

- [ ] **Step 4: 커밋**

```bash
git add admin-site/package.json admin-site/pnpm-lock.yaml "admin-site/src/app/(admin)/announcements/AnnouncementForm.tsx"
git commit -m "feat(admin): 공지 작성 마크다운 툴바 + 미리보기 (032)"
```

---

### Task 5: 전체 게이트 + 정리

**Files:** (없음 — 검증)

- [ ] **Step 1: frontend 게이트**

Run: `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: 전부 GREEN(AnnouncementBody 테스트 포함).

- [ ] **Step 2: admin-site 게이트**

Run: `cd admin-site && pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: 전부 GREEN(markdownToolbar 테스트 포함).

- [ ] **Step 3: dogfooding 게이트(자동 미검출 영역, §14)**

- 어드민: 공지 작성 → 툴바(제목/굵게/목록) 삽입 동작 + 미리보기 토글 → 발행.
- 사용자앱 `/notice/[id]`: 제목·볼드·글머리표가 시각적으로 렌더되는지(라이트/다크/모바일).
- 기존 평문 공지(예: prod id 15) 줄바꿈 유지 확인.

- [ ] **Step 4: 배포(FE 단독, 사용자 컨펌 시)**

- develop push → preview, main 승격 → soseolbi.com production(사용자앱). admin-site = `cd admin-site && vercel deploy --prod`(수동, 현재 git 자동배포 미연결).
- 백엔드 재배포 불필요.

---

## Self-Review

- **Spec coverage**: 저장(변경0)=Task 전반 / 어드민 툴바=Task 3·4 / 미리보기=Task 4 / 사용자 렌더=Task 1·2 / remark-breaks 호환=Task 1 / XSS-safe=Task 1 / 배포=Task 5. 이미지=범위 밖(spec 명시). ✅ 누락 없음.
- **Placeholder scan**: 모든 코드 step에 실제 코드 포함. TODO/TBD 없음. ✅
- **Type consistency**: `applyMarkdown(text,start,end,kind): MarkdownEdit{text,selStart,selEnd}` — Task 3 정의, Task 4 소비 일치. `AnnouncementBody({body})` — Task 1 정의, Task 2 소비 일치. ✅
