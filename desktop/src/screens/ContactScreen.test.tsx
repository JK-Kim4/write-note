import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContactScreen } from "./ContactScreen";

const BODY_PLACEHOLDER = "의견을 자유롭게 적어주세요";

type Stub = {
  send?: ReturnType<typeof vi.fn>;
  openExternal?: ReturnType<typeof vi.fn>;
};

function renderScreen(stub: Stub = {}) {
  const send = stub.send ?? vi.fn().mockResolvedValue({ ok: true });
  const openExternal = stub.openExternal ?? vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("electronAPI", {
    platform: "darwin",
    projects: { create: vi.fn(), list: vi.fn(), listCards: vi.fn(), get: vi.fn(), update: vi.fn(), delete: vi.fn() },
    documents: { getByProject: vi.fn(), update: vi.fn() },
    memos: { create: vi.fn(), list: vi.fn(), listByProject: vi.fn(), pickReentry: vi.fn(), addLink: vi.fn(), removeLink: vi.fn(), setPin: vi.fn(), delete: vi.fn(), restore: vi.fn() },
    settings: { get: vi.fn(), set: vi.fn() },
    contact: { send },
    shell: { openExternal },
  });
  render(<ContactScreen />);
  return { send, openExternal };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ContactScreen", () => {
  it("should_disable_send_when_body_empty", () => {
    renderScreen();
    expect(screen.getByRole("button", { name: "보내기" })).toBeDisabled();
  });

  it("should_send_with_body_and_show_thanks_and_reset_form", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true });
    renderScreen({ send });

    const body = screen.getByPlaceholderText(BODY_PLACEHOLDER);
    fireEvent.change(body, { target: { value: "좋은 앱이에요" } });
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));

    await waitFor(() => expect(send).toHaveBeenCalledWith({ email: "", body: "좋은 앱이에요" }));
    expect(await screen.findByText(/보내주셔서 감사합니다/)).toBeInTheDocument();
    expect(body).toHaveValue("");
  });

  it("should_send_with_reply_email_when_provided", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true });
    renderScreen({ send });

    fireEvent.change(screen.getByPlaceholderText("답장받을 이메일 (선택)"), { target: { value: "writer@example.com" } });
    fireEvent.change(screen.getByPlaceholderText(BODY_PLACEHOLDER), { target: { value: "회신 원해요" } });
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));

    await waitFor(() => expect(send).toHaveBeenCalledWith({ email: "writer@example.com", body: "회신 원해요" }));
  });

  it("should_block_send_and_warn_on_invalid_email", () => {
    const send = vi.fn().mockResolvedValue({ ok: true });
    renderScreen({ send });

    fireEvent.change(screen.getByPlaceholderText("답장받을 이메일 (선택)"), { target: { value: "not-an-email" } });
    fireEvent.change(screen.getByPlaceholderText(BODY_PLACEHOLDER), { target: { value: "본문 있음" } });
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));

    expect(send).not.toHaveBeenCalled();
    expect(screen.getByText(/이메일 형식/)).toBeInTheDocument();
  });
});
