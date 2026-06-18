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

describe("CustomEditor — EditContext 미지원(iOS) 글쓰기 미지원 안내", () => {
    // jsdom(과 iOS WebKit)에는 EditContext 가 없다 → 자체 에디터 글쓰기 미지원: 안내 배너 표시 +
    // 입력 어댑터 미부착(읽기 전용). (026 textarea 프록시 시도는 네이티브 선택 발산으로 폐기, 사용자 결정 2026-06-18.)
    test("EditContext 가 없으면 미지원 안내를 띄우고 입력 표면을 부착하지 않는다", async () => {
        const model = pmJsonToModel(JSON.stringify({ type: "doc", content: [] }));
        const { container } = render(<CustomEditor model={model} onModelChange={() => {}} paperSize="A4" />);
        await waitFor(() => {
            expect(screen.queryByText(/지원하지 않/)).not.toBeNull();
        });
        expect(container.querySelector("textarea")).toBeNull();
    });
});
