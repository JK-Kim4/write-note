import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnnouncementBody } from "./AnnouncementBody";

describe("AnnouncementBody", () => {
    it("제목·볼드·글머리표를 해당 요소로 렌더한다", () => {
        render(<AnnouncementBody body={"## 이벤트 안내\n\n**메가커피** 증정\n\n- 항목 1\n- 항목 2"} />);
        expect(screen.getByRole("heading", { level: 2, name: "이벤트 안내" })).toBeInTheDocument();
        expect(screen.getByText("메가커피").tagName).toBe("STRONG");
        expect(screen.getAllByRole("listitem")).toHaveLength(2);
    });

    it("단일 줄바꿈을 br 로 보존한다(기존 평문 호환)", () => {
        const { container } = render(<AnnouncementBody body={"첫째 줄\n둘째 줄"} />);
        expect(container.querySelector("br")).not.toBeNull();
    });

    it("원시 HTML 을 실행하지 않는다(XSS-safe)", () => {
        const { container } = render(<AnnouncementBody body={"<script>alert(1)</script> 안전"} />);
        expect(container.querySelector("script")).toBeNull();
    });
});
