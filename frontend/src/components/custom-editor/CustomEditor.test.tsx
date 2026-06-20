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

describe("CustomEditor — 029 페이지 넘김 뷰", () => {
    // jsdom 은 실제 줄 측정이 안 돼 내용이 1페이지로 접힌다 → "여러 페이지 중 1장" 강한 단정은 불가(dogfooding 게이트).
    // 여기서는 단일 페이지 렌더 경로가 정확히 한 개의 페이지(data-poc-page)만 렌더하는지(전체 map 아님)와
    // 단일 페이지일 때 네비 오버레이가 안 뜨는지(pageCount>1 조건)를 스모크로 확인한다.
    test("페이지 컨테이너를 한 개만 렌더하고, 단일 페이지면 네비를 띄우지 않는다", async () => {
        const model = pmJsonToModel(JSON.stringify({ type: "doc", content: [] }));
        const { container } = render(<CustomEditor model={model} onModelChange={() => {}} paperSize="A4" />);
        await waitFor(() => {
            expect(container.querySelectorAll("[data-poc-page]").length).toBe(1);
        });
        // 단일 페이지 → 이전/다음 페이지 버튼 없음(pageCount>1 조건)
        expect(screen.queryByLabelText("다음 페이지")).toBeNull();
        expect(screen.queryByLabelText("이전 페이지")).toBeNull();
    });
});
