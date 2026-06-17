import { render, screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, test, vi } from "vitest";
import { CustomEditor } from "./CustomEditor";
import { pmJsonToModel } from "./pmConvert";

// jsdom 에는 ResizeObserver 가 없다 — CustomEditor 의 fit-to-width effect 가 호출하므로 stub.
beforeAll(() => {
    vi.stubGlobal(
        "ResizeObserver",
        class {
            observe() {}
            unobserve() {}
            disconnect() {}
        },
    );
});

describe("CustomEditor — EditContext 미지원 브라우저 안내", () => {
    // jsdom(과 iOS WebKit·Firefox)에는 EditContext 가 없다 → 입력 루프가 부착되지 않아
    // 글씨가 안 써진다. 그 경우 사용자가 영문 모르고 못 쓰지 않도록 안내를 표시한다.
    test("EditContext 가 없으면 글쓰기 미지원 안내를 보여준다", async () => {
        const model = pmJsonToModel(JSON.stringify({ type: "doc", content: [] }));
        render(<CustomEditor model={model} onModelChange={() => {}} paperSize="A4" />);
        await waitFor(() => {
            expect(screen.getByText(/지원하지 않/)).toBeInTheDocument();
        });
    });
});
