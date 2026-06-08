import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DownloadButtons } from "./DownloadButtons";

/**
 * DownloadButtons 행위 테스트 (US2) — 양 OS 버튼 노출 + 고정 링크 + 방문 OS 강조.
 */

function setOsSignature(value: string) {
    Object.defineProperty(window.navigator, "userAgent", { value, configurable: true });
    Object.defineProperty(window.navigator, "platform", { value, configurable: true });
}

const WIN_HREF =
    "https://github.com/JK-Kim4/write-note/releases/latest/download/Narae-Note-Setup.exe";
const MAC_HREF = "https://github.com/JK-Kim4/write-note/releases/latest/download/Narae-Note.dmg";

describe("DownloadButtons", () => {
    it("양 OS 버튼을 모두 노출하고 고정 latest/download 링크를 가리킨다", () => {
        setOsSignature("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)");
        render(<DownloadButtons />);

        expect(screen.getByRole("link", { name: /Windows용 다운로드/ })).toHaveAttribute(
            "href",
            WIN_HREF,
        );
        expect(screen.getByRole("link", { name: /macOS용 다운로드/ })).toHaveAttribute(
            "href",
            MAC_HREF,
        );
    });

    it("Windows 방문자에게 Windows 버튼을 추천(강조)한다", async () => {
        setOsSignature("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
        render(<DownloadButtons />);

        await waitFor(() => {
            expect(screen.getByRole("link", { name: /Windows용 다운로드/ })).toHaveAttribute(
                "data-recommended",
                "true",
            );
        });
        expect(screen.getByRole("link", { name: /macOS용 다운로드/ })).not.toHaveAttribute(
            "data-recommended",
        );
    });

    it("macOS 방문자에게 macOS 버튼을 추천(강조)한다", async () => {
        setOsSignature("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)");
        render(<DownloadButtons />);

        await waitFor(() => {
            expect(screen.getByRole("link", { name: /macOS용 다운로드/ })).toHaveAttribute(
                "data-recommended",
                "true",
            );
        });
    });
});
