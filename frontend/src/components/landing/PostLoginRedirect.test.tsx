import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePreferences } from "@/stores/preferences";
import { PostLoginRedirect } from "./PostLoginRedirect";

const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: replaceMock, back: vi.fn() }),
}));
vi.mock("@/stores/preferences", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/stores/preferences")>();
    return { ...actual, useIsPreferencesHydrated: () => true };
});

describe("PostLoginRedirect", () => {
    beforeEach(() => {
        replaceMock.mockClear();
    });

    it("A 디자인이면 수화 후 /home 으로 replace 한다", async () => {
        usePreferences.setState({ design: "default" });
        render(<PostLoginRedirect />);
        await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/home"));
    });

    it("B 디자인이면 수화 후 /b 로 replace 한다", async () => {
        usePreferences.setState({ design: "b" });
        render(<PostLoginRedirect />);
        await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/b"));
    });
});
