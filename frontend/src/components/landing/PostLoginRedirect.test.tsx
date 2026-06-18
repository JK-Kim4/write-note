import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PostLoginRedirect } from "./PostLoginRedirect";

const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: replaceMock, back: vi.fn() }),
}));

describe("PostLoginRedirect", () => {
    beforeEach(() => {
        replaceMock.mockClear();
    });

    it("마운트 후 앱 홈(/)으로 replace 한다", async () => {
        render(<PostLoginRedirect />);
        await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/"));
    });
});
