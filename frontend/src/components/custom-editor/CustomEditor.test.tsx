import { act, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { CustomEditor } from "./CustomEditor";
import type { DocModel } from "./model";
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

// jsdom 에 없는 브라우저 EditContext 를 흉내내는 시스템 경계 stub(adapter 테스트와 동일 패턴).
// 자체 에디터 입력 경로(EditContext 어댑터)를 통합 레벨에서 구동하기 위함.
class FakeEditContext extends EventTarget {
    text = "";
    selectionStart = 0;
    selectionEnd = 0;
    updateText(start: number, end: number, t: string) {
        this.text = this.text.slice(0, start) + t + this.text.slice(end);
    }
    updateSelection(s: number, e: number) {
        this.selectionStart = s;
        this.selectionEnd = e;
    }
    updateControlBounds() {}
    updateSelectionBounds() {}
    updateCharacterBounds() {}
}

function textUpdateEvent(rangeStart: number, rangeEnd: number, text: string, sel: number): Event {
    const ev = new Event("textupdate") as Event & Record<string, unknown>;
    ev.updateRangeStart = rangeStart;
    ev.updateRangeEnd = rangeEnd;
    ev.text = text;
    ev.selectionStart = sel;
    ev.selectionEnd = sel;
    return ev;
}

describe("CustomEditor — 빠른 한글 조합 중 뒤 내용 보존(stale modelRef 회귀)", () => {
    let restoreRect: (() => void) | undefined;
    beforeAll(() => {
        // EditContext 는 globalThis 직접 할당(adapter 테스트와 동일) — vi.unstubAllGlobals 가 상단 beforeAll 의
        // ResizeObserver stub 까지 지우는 충돌을 피한다.
        (globalThis as { EditContext?: unknown }).EditContext = FakeEditContext;
        // jsdom 은 Range.getBoundingClientRect 를 미구현 → 측정(measure.ts)이 크래시. 줄 측정 결과는
        // 이 테스트의 관심사가 아니므로(검증 대상=편집 후 model.buffer) 더미 rect 로 측정 경로만 통과시킨다.
        const proto = Range.prototype as unknown as { getBoundingClientRect?: () => DOMRect };
        const original = proto.getBoundingClientRect;
        proto.getBoundingClientRect = () => new DOMRect(0, 0, 10, 20);
        restoreRect = () => {
            proto.getBoundingClientRect = original;
        };
    });
    afterAll(() => {
        delete (globalThis as { EditContext?: unknown }).EditContext;
        restoreRect?.();
    });

    // 회귀: 기존 내용 앞에서 한글을 "빠르게" 치면(= 리렌더 커밋 전에 textupdate 가 연속 발화) 조합 갱신이
    // stale 한 modelRef 버퍼에 EditContext 의 최신 rangeEnd 를 적용 → insertText 의 slice(hi)가 조합 위치
    // 뒤의 실제 글자를 절단해 사라지던 버그. 두 textupdate 를 한 act() 안에서 연속 발화해 그 경합을 재현한다.
    test("조합 갱신이 연속 발화해도 조합 위치 뒤 글자가 사라지지 않는다", async () => {
        const initial = pmJsonToModel(
            JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "기존내용" }] }] }),
        );
        let latest: DocModel = initial;
        function Harness() {
            const [model, setModel] = useState<DocModel>(initial);
            latest = model;
            return (
                <CustomEditor
                    model={model}
                    onModelChange={(m) => setModel(m)}
                    paperSize="A4"
                />
            );
        }
        const { container } = render(<Harness />);
        // 입력 어댑터 부착(host.editContext 세팅) 대기.
        await waitFor(() => {
            const host = container.querySelector<HTMLElement>(".custom-editor-scroll");
            expect((host as unknown as { editContext?: unknown })?.editContext).toBeTruthy();
        });
        const host = container.querySelector<HTMLElement>(".custom-editor-scroll");
        const ctx = (host as unknown as { editContext: EventTarget }).editContext;

        // 캐럿을 맨 앞(0)에서 "ㅎ"→"하" 로 조합. 두 textupdate 가 한 act 안 = 사이 리렌더 없음(빠른 타자).
        act(() => {
            ctx.dispatchEvent(new Event("compositionstart"));
            ctx.dispatchEvent(textUpdateEvent(0, 0, "ㅎ", 1)); // 조합 시작: ㅎ기존내용
            ctx.dispatchEvent(textUpdateEvent(0, 1, "하", 1)); // 조합 갱신: 하기존내용 (ㅎ 자리 치환)
        });

        expect(latest.buffer).toBe("하기존내용");
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
