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

describe("CustomEditor — EditContext 미지원(iOS) 입력 어댑터", () => {
    // 026: jsdom(과 iOS WebKit)에는 EditContext 가 없다 → 기능 감지로 contentEditableAdapter 가 선택되고
    // contenteditable 입력 표면이 부착된다(기존 "미지원 안내" 배너는 입력 지원으로 대체·비활성).
    test("EditContext 가 없으면 contenteditable 입력 표면을 부착하고 미지원 안내를 띄우지 않는다", async () => {
        const model = pmJsonToModel(JSON.stringify({ type: "doc", content: [] }));
        const { container } = render(<CustomEditor model={model} onModelChange={() => {}} paperSize="A4" />);
        await waitFor(() => {
            expect(container.querySelector('[contenteditable="true"]')).not.toBeNull();
        });
        expect(screen.queryByText(/지원하지 않/)).toBeNull();
    });
});
