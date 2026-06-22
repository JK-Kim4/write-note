# 시리즈 단위 내보내기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 시리즈 드릴인 화면에서 작품을 골라 순서를 정해 하나의 파일로 합본 내보내기(PDF/HWPX/DOCX/TXT/JSON). 작품당 내보내기는 그대로 유지.

**Architecture:** 기존 export 파이프라인(`collectChapters` → `usePdfExport`/`useWordExport`/`useTextExport`)이 `orderedIds: number[]`(본문 id 배열)를 이미 다중 합본 처리한다. 시리즈 내보내기는 (1) 선택·정렬된 작품 projectId → 본문 documentId 변환, (2) 작품 선택 다이얼로그(`SeriesExportDialog`), (3) `LibraryBoard` 드릴인에 진입 버튼+핸들러 결선만 추가한다. 백엔드 변경 0(Word 파일명만 FE override).

**Tech Stack:** Next.js 16 / React 19 / TypeScript / @dnd-kit / Vitest + RTL. 자체 에디터 export 모듈(`lib/export/*`).

## Global Constraints

- 백엔드 변경 0 — 기존 `POST /api/export/{projectId}/{docx|hwpx}` + `getProjectDocument`/`getDocument` 재사용.
- 작품당 내보내기(`ExportDialog`, 집필실 `BStudioShell` 결선) 미접촉.
- 합본 본문 무손실 — 선택 작품이 순서대로 누락 없이 포함.
- 시리즈 판형 = `currentCategory.paperSize ?? "A4"`(effective fallback) — PDF 렌더·Word·exportDoc paperSize.
- export 핸들러 시그니처(`ExportRequest = { orderedIds: number[]; joinMode: JoinMode }`)는 기존 그대로.
- TDD: 순수 로직(orderedIds 조립)·다이얼로그 행위는 테스트 선행. 다중 합본 렌더 정합은 dogfooding(생성물 검증 한계 §14).

---

### Task 1: 작품 → 본문 orderedIds 변환

선택·정렬된 작품(projectId)을 본문(documentId) 배열로 변환한다. `collectChapters`는 documentId 배열을 받으므로 이 변환이 시리즈 export의 유일한 신규 데이터 로직이다.

**Files:**
- Create: `frontend/src/lib/export/seriesExport.ts`
- Test: `frontend/src/lib/export/seriesExport.test.ts`

**Interfaces:**
- Consumes: `getProjectDocument(projectId: number): Promise<DocumentResponse>` (기존 `@/lib/api/document`), `DocumentResponse.id`(본문 id).
- Produces: `collectSeriesOrderedIds(projectIds: number[], fetchProjectDoc: (projectId: number) => Promise<DocumentResponse>): Promise<number[]>` — projectIds 순서를 보존한 documentId 배열.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/lib/export/seriesExport.test.ts
import { describe, expect, it } from "vitest";
import { collectSeriesOrderedIds } from "./seriesExport";
import type { DocumentResponse } from "@/types/api";

function doc(projectId: number, docId: number): DocumentResponse {
    return {
        id: docId, projectId, title: `작품${projectId}`, body: '{"type":"doc","content":[]}',
        wordCount: 0, version: "2026-06-23T00:00:00Z", updatedAt: "2026-06-23T00:00:00Z",
    };
}

describe("collectSeriesOrderedIds", () => {
    it("projectId 순서 그대로 documentId 배열로 변환한다", async () => {
        const docs: Record<number, DocumentResponse> = { 11: doc(11, 101), 22: doc(22, 202), 33: doc(33, 303) };
        const orderedIds = await collectSeriesOrderedIds([33, 11, 22], (pid) => Promise.resolve(docs[pid]));
        expect(orderedIds).toEqual([303, 101, 202]);
    });

    it("빈 선택이면 빈 배열", async () => {
        const orderedIds = await collectSeriesOrderedIds([], () => Promise.reject(new Error("불려선 안 됨")));
        expect(orderedIds).toEqual([]);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/export/seriesExport.test.ts`
Expected: FAIL — `collectSeriesOrderedIds` is not defined / 모듈 없음

- [ ] **Step 3: Write minimal implementation**

```ts
// frontend/src/lib/export/seriesExport.ts
import type { DocumentResponse } from "@/types/api";

/**
 * 선택·정렬된 작품(projectId)을 본문(documentId) 배열로 변환(시리즈 합본 export).
 * fetchProjectDoc 은 시스템 경계(HTTP) 주입 — 호출부가 getProjectDocument 전달, 테스트는 mock.
 * orderedIds 순서 = projectIds 순서(작품 정렬 = 합본 장 순서).
 */
export async function collectSeriesOrderedIds(
    projectIds: number[],
    fetchProjectDoc: (projectId: number) => Promise<DocumentResponse>,
): Promise<number[]> {
    const docs = await Promise.all(projectIds.map(fetchProjectDoc));
    return docs.map((d) => d.id);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/export/seriesExport.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/export/seriesExport.ts frontend/src/lib/export/seriesExport.test.ts
git commit -m "feat(033): 시리즈 export — 작품 projectId → 본문 orderedIds 변환"
```

---

### Task 2: useWordExport 파일명 override

Word export는 `POST /api/export/{projectId}/{format}`로 projectId가 소유권 검증+파일명에 쓰인다. 시리즈 합본은 대표 projectId(선택 첫 작품)로 소유권을 통과하되, **파일명은 시리즈명**이어야 한다. `useWordExport`에 optional `downloadName`을 추가해 BE 파일명을 override한다(집필실은 미전달 → 기존 BE 파일명 유지).

**Files:**
- Modify: `frontend/src/lib/export/useWordExport.ts`
- Test: `frontend/src/lib/export/useWordExport.test.ts` (create)

**Interfaces:**
- Consumes: `exportWord(projectId, format, doc): Promise<{ blob: Blob; filename: string }>`, `downloadBlob(blob, filename)` (기존 `@/lib/api/export`).
- Produces: `useWordExport(projectId: number, paperSize: PaperSize, downloadName?: string)` — `downloadName` 있으면 `${downloadName}.${format}`로 다운로드, 없으면 기존 BE filename.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/lib/export/useWordExport.test.ts
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useWordExport } from "./useWordExport";

const exportWordMock = vi.fn();
const downloadBlobMock = vi.fn();
vi.mock("@/lib/api/export", () => ({
    exportWord: (...args: unknown[]) => exportWordMock(...args),
    downloadBlob: (...args: unknown[]) => downloadBlobMock(...args),
}));
vi.mock("@/lib/api/document", () => ({
    getDocument: (id: number) => Promise.resolve({ id, projectId: 1, title: "t", body: '{"type":"doc","content":[]}', wordCount: 0, version: "v", updatedAt: "v" }),
}));

describe("useWordExport — downloadName override", () => {
    beforeEach(() => { exportWordMock.mockReset(); downloadBlobMock.mockReset(); exportWordMock.mockResolvedValue({ blob: new Blob(["x"]), filename: "be-name.docx" }); });

    it("downloadName 있으면 시리즈명으로 다운로드한다", async () => {
        const { result } = renderHook(() => useWordExport(7, "A4", "나의 시리즈"));
        await result.current("docx", { orderedIds: [101], joinMode: "page-title" });
        expect(downloadBlobMock).toHaveBeenCalledWith(expect.any(Blob), "나의 시리즈.docx");
    });

    it("downloadName 없으면 BE filename 유지", async () => {
        const { result } = renderHook(() => useWordExport(7, "A4"));
        await result.current("docx", { orderedIds: [101], joinMode: "page-title" });
        expect(downloadBlobMock).toHaveBeenCalledWith(expect.any(Blob), "be-name.docx");
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/export/useWordExport.test.ts`
Expected: FAIL — `downloadName` 미지원이라 두 번째 인자가 항상 BE filename

- [ ] **Step 3: Write minimal implementation**

`frontend/src/lib/export/useWordExport.ts` 전체를 다음으로 교체:

```ts
"use client";
import { useCallback } from "react";
import { collectChapters } from "./collectChapters";
import { getDocument } from "@/lib/api/document";
import { buildExportDoc } from "./exportDoc";
import { exportWord, downloadBlob } from "@/lib/api/export";
import type { PaperSize } from "@/components/editor/pageLayout";
import type { ExportRequest } from "@/components/export/ExportDialog";

/**
 * 워드(HWPX/DOCX) 내보내기 핸들러. A·B 집필실(작품당) + 시리즈 합본 공유.
 * [downloadName] 지정 시 BE 파일명 대신 `${downloadName}.${format}` 로 저장(시리즈명). 미지정 시 BE filename.
 */
export function useWordExport(projectId: number, paperSize: PaperSize, downloadName?: string) {
    return useCallback(
        async (format: "hwpx" | "docx", req: ExportRequest) => {
            const data = await collectChapters(req.orderedIds, getDocument);
            const doc = buildExportDoc(data, paperSize, req.joinMode);
            const { blob, filename } = await exportWord(projectId, format, doc);
            const safe = downloadName?.trim().replace(/[/\\?%*:|"<>]/g, "_");
            downloadBlob(blob, safe ? `${safe}.${format}` : filename);
        },
        [projectId, paperSize, downloadName],
    );
}

/**
 * 훅 밖에서 1회 호출하는 순수 Word 내보내기(시리즈 합본용 — 대표 projectId로 소유권, 파일명은 시리즈명).
 * 시리즈는 제출 시점에 대표 projectId가 정해져 훅(고정 projectId)으로 못 쓰므로 함수로 분리.
 */
export async function exportSeriesWord(
    projectId: number,
    paperSize: PaperSize,
    downloadName: string,
    format: "hwpx" | "docx",
    req: ExportRequest,
): Promise<void> {
    const data = await collectChapters(req.orderedIds, getDocument);
    const doc = buildExportDoc(data, paperSize, req.joinMode);
    const { blob } = await exportWord(projectId, format, doc);
    const safe = downloadName.trim().replace(/[/\\?%*:|"<>]/g, "_") || "series";
    downloadBlob(blob, `${safe}.${format}`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/export/useWordExport.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/export/useWordExport.ts frontend/src/lib/export/useWordExport.test.ts
git commit -m "feat(033): useWordExport 파일명 override(시리즈명) — 집필실 무회귀"
```

---

### Task 3: SeriesExportDialog 컴포넌트

시리즈 작품 목록에서 작품 선택(체크박스, 기본 전체)·순서 조절(위/아래 버튼)·소제목 포함(joinMode)·형식(format)을 받아, **선택·정렬된 projectId 배열 + joinMode + format**을 콜백으로 넘긴다. (순서 조절은 v1에서 위/아래 버튼 — @dnd-kit 드래그는 Task 5 dogfooding 후 여력 시 교체. 위/아래 버튼이 테스트·접근성이 단순하고 본질 충족.)

**Files:**
- Create: `frontend/src/components/library/SeriesExportDialog.tsx`
- Test: `frontend/src/components/library/SeriesExportDialog.test.tsx`

**Interfaces:**
- Consumes: `ProjectCard`(`@/lib/types/domain` — `id`, `title`), `JoinMode`(`@/lib/export/exportDoc`).
- Produces:
  - `type SeriesExportKind = { kind: "pdf" } | { kind: "word"; format: "hwpx" | "docx" } | { kind: "text"; format: "txt" | "json" }`
  - `type SeriesExportSubmit = { orderedProjectIds: number[]; joinMode: JoinMode; target: SeriesExportKind }`
  - `function SeriesExportDialog(props: { open: boolean; works: ProjectCard[]; seriesName: string; onSubmit: (s: SeriesExportSubmit) => void; onClose: () => void }): JSX.Element | null`

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/components/library/SeriesExportDialog.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SeriesExportDialog } from "./SeriesExportDialog";
import type { ProjectCard } from "@/lib/types/domain";

function card(id: number, title: string): ProjectCard {
    return {
        id, title, genre: null, targetLength: null, toneNotes: null, synopsis: null, worldNotes: null,
        nextScene: "", categoryId: 9, paperSize: "A4", layoutMode: "paper", effectivePaperSize: "A4",
        effectiveLayoutMode: "paper", fontScale: "m", archivedAt: null, createdAt: "2026-06-23T00:00:00Z",
        updatedAt: "2026-06-23T00:00:00Z", lastSentenceSource: "", wordCount: 0, docUpdatedAt: "2026-06-23T00:00:00Z", totalDurationMs: 0,
    };
}
const works = [card(11, "1장"), card(22, "2장"), card(33, "3장")];

describe("SeriesExportDialog", () => {
    it("기본 전체 선택 + 순서대로 projectId 를 제출한다", () => {
        const onSubmit = vi.fn();
        render(<SeriesExportDialog open works={works} seriesName="시집" onSubmit={onSubmit} onClose={() => {}} />);
        fireEvent.click(screen.getByRole("button", { name: "PDF" }));
        fireEvent.click(screen.getByRole("button", { name: "내보내기" }));
        expect(onSubmit).toHaveBeenCalledWith({ orderedProjectIds: [11, 22, 33], joinMode: "page-title", target: { kind: "pdf" } });
    });

    it("작품 체크 해제 시 제외된다", () => {
        const onSubmit = vi.fn();
        render(<SeriesExportDialog open works={works} seriesName="시집" onSubmit={onSubmit} onClose={() => {}} />);
        fireEvent.click(screen.getByRole("checkbox", { name: /2장/ })); // 해제
        fireEvent.click(screen.getByRole("button", { name: "PDF" }));
        fireEvent.click(screen.getByRole("button", { name: "내보내기" }));
        expect(onSubmit).toHaveBeenCalledWith({ orderedProjectIds: [11, 33], joinMode: "page-title", target: { kind: "pdf" } });
    });

    it("위로 버튼으로 순서를 바꾼다", () => {
        const onSubmit = vi.fn();
        render(<SeriesExportDialog open works={works} seriesName="시집" onSubmit={onSubmit} onClose={() => {}} />);
        fireEvent.click(screen.getByRole("button", { name: "3장 위로" }));
        fireEvent.click(screen.getByRole("button", { name: "PDF" }));
        fireEvent.click(screen.getByRole("button", { name: "내보내기" }));
        expect(onSubmit).toHaveBeenCalledWith({ orderedProjectIds: [11, 33, 22], joinMode: "page-title", target: { kind: "pdf" } });
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/library/SeriesExportDialog.test.tsx`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: Write minimal implementation**

```tsx
// frontend/src/components/library/SeriesExportDialog.tsx
"use client";

import { useState } from "react";
import type { JoinMode } from "@/lib/export/exportDoc";
import type { ProjectCard } from "@/lib/types/domain";

export type SeriesExportKind =
    | { kind: "pdf" }
    | { kind: "word"; format: "hwpx" | "docx" }
    | { kind: "text"; format: "txt" | "json" };
export type SeriesExportSubmit = { orderedProjectIds: number[]; joinMode: JoinMode; target: SeriesExportKind };

type Props = { open: boolean; works: ProjectCard[]; seriesName: string; onSubmit: (s: SeriesExportSubmit) => void; onClose: () => void };

const FORMATS: { label: string; target: SeriesExportKind }[] = [
    { label: "PDF", target: { kind: "pdf" } },
    { label: "HWPX", target: { kind: "word", format: "hwpx" } },
    { label: "DOCX", target: { kind: "word", format: "docx" } },
    { label: "TXT", target: { kind: "text", format: "txt" } },
    { label: "JSON", target: { kind: "text", format: "json" } },
];

export function SeriesExportDialog({ open, works, seriesName, onSubmit, onClose }: Props) {
    // 순서 = order(projectId 배열), 선택 = selected(Set). 기본: works 순서 전체 선택.
    const [order, setOrder] = useState<number[]>(() => works.map((w) => w.id));
    const [selected, setSelected] = useState<Set<number>>(() => new Set(works.map((w) => w.id)));
    const [joinMode, setJoinMode] = useState<JoinMode>("page-title");
    const [formatLabel, setFormatLabel] = useState<string>("PDF");

    if (!open) return null;

    const titleOf = (id: number) => works.find((w) => w.id === id)?.title ?? "";
    const move = (id: number, dir: -1 | 1) => {
        setOrder((prev) => {
            const i = prev.indexOf(id);
            const j = i + dir;
            if (i < 0 || j < 0 || j >= prev.length) return prev;
            const next = [...prev];
            [next[i], next[j]] = [next[j], next[i]];
            return next;
        });
    };
    const toggle = (id: number) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const submit = () => {
        const orderedProjectIds = order.filter((id) => selected.has(id));
        const target = FORMATS.find((f) => f.label === formatLabel)?.target ?? { kind: "pdf" };
        onSubmit({ orderedProjectIds, joinMode, target });
    };

    return (
        <div role="dialog" aria-label="시리즈 내보내기" className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
            <div className="w-[28rem] max-w-[92vw] rounded-2xl bg-white p-5 shadow-xl">
                <h2 className="text-base font-bold text-gray-900">{seriesName} 내보내기</h2>
                <p className="mt-1 text-xs text-gray-500">포함할 작품과 순서를 정하세요. 선택한 작품이 한 파일로 합쳐집니다.</p>

                <ul className="mt-3 max-h-60 space-y-1 overflow-auto">
                    {order.map((id, idx) => (
                        <li key={id} className="flex items-center gap-2 rounded-md border border-gray-100 px-2 py-1.5">
                            <input
                                type="checkbox"
                                checked={selected.has(id)}
                                onChange={() => toggle(id)}
                                aria-label={`${titleOf(id)} 포함`}
                            />
                            <span className="flex-1 truncate text-sm">{titleOf(id)}</span>
                            <button type="button" aria-label={`${titleOf(id)} 위로`} disabled={idx === 0} onClick={() => move(id, -1)} className="px-1 text-gray-400 disabled:opacity-30">↑</button>
                            <button type="button" aria-label={`${titleOf(id)} 아래로`} disabled={idx === order.length - 1} onClick={() => move(id, 1)} className="px-1 text-gray-400 disabled:opacity-30">↓</button>
                        </li>
                    ))}
                </ul>

                <label className="mt-3 block text-xs text-gray-500">
                    소제목(작품 제목)
                    <select value={joinMode} onChange={(e) => setJoinMode(e.target.value as JoinMode)} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm">
                        <option value="page-title">작품마다 제목 페이지 포함</option>
                        <option value="body-only">제목 없이 본문만</option>
                    </select>
                </label>

                <div className="mt-3 flex flex-wrap gap-1.5">
                    {FORMATS.map((f) => (
                        <button key={f.label} type="button" aria-pressed={formatLabel === f.label} onClick={() => setFormatLabel(f.label)}
                            className={`rounded-md border px-2.5 py-1 text-xs ${formatLabel === f.label ? "border-terracotta-500 bg-terracotta-50 text-terracotta-700" : "border-gray-200 text-gray-600"}`}>
                            {f.label}
                        </button>
                    ))}
                </div>

                <div className="mt-4 flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-600">취소</button>
                    <button type="button" onClick={submit} disabled={order.filter((id) => selected.has(id)).length === 0}
                        className="rounded-md bg-terracotta-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">내보내기</button>
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/library/SeriesExportDialog.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/library/SeriesExportDialog.tsx frontend/src/components/library/SeriesExportDialog.test.tsx
git commit -m "feat(033): SeriesExportDialog — 작품 선택·순서·joinMode·format"
```

---

### Task 4: LibraryBoard 드릴인 결선

시리즈 드릴인(`activeFolder != null`) 화면에 "내보내기" 버튼 + `SeriesExportDialog` + export 핸들러(PDF는 `PrintOverlay` 렌더)를 결선한다. 제출 시 `collectSeriesOrderedIds`로 orderedIds를 만들어 기존 export 훅을 호출한다.

**Files:**
- Modify: `frontend/src/components/library/LibraryBoard.tsx`
- Test: `frontend/src/components/library/LibraryBoard.test.tsx` (시리즈 export 진입 1건 추가)

**Interfaces:**
- Consumes: `collectSeriesOrderedIds`(Task 1), `SeriesExportDialog`/`SeriesExportSubmit`(Task 3), `usePdfExport`(`{ printModels, exportPdf, clearPrint }`), `useWordExport(projectId, paperSize, downloadName?)`(Task 2), `useTextExport(projectTitle)`, `PrintOverlay`(`{ models, paperSize, onDone }`), `getProjectDocument`(`@/lib/api/document`), `currentCategory`(기존 `LibraryBoard` 지역값, `name`/`paperSize`), `folderCards`(기존).
- Produces: 없음(화면 결선).

- [ ] **Step 1: Write the failing test**

```tsx
// LibraryBoard.test.tsx 에 추가 — 드릴인 화면에 "내보내기" 버튼이 뜨고 다이얼로그가 열린다.
// (기존 setup: 시리즈 1개 + 그 안 작품 ≥1개로 activeFolder 진입한 상태를 만든 뒤)
it("시리즈 드릴인에서 내보내기 버튼으로 다이얼로그를 연다", async () => {
    // ...기존 LibraryBoard 렌더 + ?folder 진입 헬퍼 재사용...
    // 드릴인 후:
    fireEvent.click(screen.getByRole("button", { name: "내보내기" }));
    expect(screen.getByRole("dialog", { name: "시리즈 내보내기" })).toBeInTheDocument();
});
```

> 주의: 기존 `LibraryBoard.test.tsx`의 드릴인 진입 패턴(navigateFolder/`?folder=`)을 그대로 재사용해 setup을 구성한다. 새 mock 도입 금지 — 기존 msw/스토어 setup 따름.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/library/LibraryBoard.test.tsx`
Expected: FAIL — "내보내기" 버튼 없음

- [ ] **Step 3: Implement — LibraryBoard 결선**

import 추가:
```tsx
import { SeriesExportDialog, type SeriesExportSubmit } from "./SeriesExportDialog";
import { PrintOverlay } from "@/components/export/PrintOverlay";
import { usePdfExport } from "@/lib/export/usePdfExport";
import { exportSeriesWord } from "@/lib/export/useWordExport";
import { useTextExport } from "@/lib/export/useTextExport";
import { collectSeriesOrderedIds } from "@/lib/export/seriesExport";
import { getProjectDocument } from "@/lib/api/document";
import type { PaperSize } from "@/components/editor/pageLayout";
```

컴포넌트 본문(기존 `currentCategory`/`folderCards`/`activeFolder` 지역값 아래)에 상태·핸들러 추가:
```tsx
const [exportOpen, setExportOpen] = useState(false);
const seriesPaper: PaperSize = (currentCategory?.paperSize as PaperSize | null) ?? "A4";
const seriesName = currentCategory?.name ?? "시리즈";
const { printModels, exportPdf, clearPrint } = usePdfExport();
const exportText = useTextExport(seriesName);

const handleSeriesExport = useCallback(async (s: SeriesExportSubmit) => {
    setExportOpen(false);
    const orderedIds = await collectSeriesOrderedIds(s.orderedProjectIds, getProjectDocument);
    const req = { orderedIds, joinMode: s.joinMode };
    if (s.target.kind === "pdf") {
        exportPdf(req);
    } else if (s.target.kind === "text") {
        exportText(s.target.format, req);
    } else {
        // Word: 대표 projectId(선택 첫 작품)로 소유권 통과, 본문은 doc(전체 합본), 파일명은 시리즈명(Task 2 exportSeriesWord).
        await exportSeriesWord(s.orderedProjectIds[0], seriesPaper, seriesName, s.target.format, req);
    }
}, [exportPdf, exportText, seriesPaper, seriesName]);
```

> **Word 처리:** `exportSeriesWord`(Task 2에서 구현)는 훅이 아닌 순수 함수라 제출 시점에 대표 projectId로 1회 호출한다(시리즈는 제출 전까지 대표 projectId가 안 정해져 훅 고정 projectId로는 못 씀).

드릴인 헤더(작품 추가/시리즈명 표시 영역)에 버튼 추가(작품이 1개 이상일 때만):
```tsx
{folderCards.length > 0 && (
    <button type="button" onClick={() => setExportOpen(true)}
        className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-terracotta-50 hover:text-terracotta-700">
        내보내기
    </button>
)}
```

다이얼로그·PrintOverlay 렌더(컴포넌트 return 말미):
```tsx
<SeriesExportDialog open={exportOpen} works={folderCards} seriesName={seriesName} onSubmit={handleSeriesExport} onClose={() => setExportOpen(false)} />
{printModels && <PrintOverlay models={printModels} paperSize={seriesPaper} onDone={clearPrint} />}
```

> `useCallback` deps에 `seriesPaper`/`seriesName` 포함(Word 분기에서 사용). `exportPdf`/`exportText`는 훅이 `useCallback` 안정화한 값이라 deps 안전. 최종 deps: `[exportPdf, exportText, seriesPaper, seriesName]`.

- [ ] **Step 4: Run tests + build**

Run: `cd frontend && npx vitest run src/components/library/LibraryBoard.test.tsx && pnpm build`
Expected: PASS + build 성공(RSC 경계 — LibraryBoard는 이미 `'use client'`)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/library/LibraryBoard.tsx frontend/src/components/library/LibraryBoard.test.tsx frontend/src/lib/export/useWordExport.ts
git commit -m "feat(033): 시리즈 드릴인 내보내기 결선(SeriesExportDialog + PDF/Word/Text 핸들러)"
```

---

### Task 5: 전체 게이트 + dogfooding

**Files:** 없음(검증).

- [ ] **Step 1: 전체 게이트**

Run: `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: 전부 GREEN

- [ ] **Step 2: dogfooding (생성물 렌더 정합 §14 — 단위테스트로 못 잡는 영역)**

로컬 dev에서 시리즈 드릴인 → "내보내기":
1. 작품 2개 이상 든 시리즈에서 내보내기 → 다이얼로그에 작품 목록(기본 전체 선택)
2. 일부 체크 해제 → 제외 확인
3. 위/아래로 순서 변경 → 합본 순서 반영
4. **PDF**: 선택 작품들이 순서대로 한 PDF에 합본, `joinMode`=제목 페이지 포함/미포함 동작
5. **DOCX/HWPX**: 한글/워드에서 합본 1파일, 파일명 = 시리즈명
6. **TXT/JSON**: 합본 텍스트, 파일명 = 시리즈명
7. 무손실: 어떤 작품도 누락·순서 뒤바뀜 없음
8. 작품당 내보내기(집필실)는 기존대로 동작(무회귀)

- [ ] **Step 3: dogfooding 통과 후 커밋 (필요 시 수정)**

```bash
# dogfooding 중 수정이 있으면 그 커밋. 없으면 Task 4 커밋으로 종료.
git commit -am "fix(033): 시리즈 내보내기 dogfooding 반영"  # (수정 있을 때만)
```

---

## 실행 후

전 Task GREEN + dogfooding 통과 시 이슈 7 완료. 033 전체(R1~R4 + 이슈 7)를 `buffer`에 모아 검증 후 develop 머지(사용자 승인 시 main) — finish-work.
