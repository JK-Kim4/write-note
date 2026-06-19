// @vitest-environment node
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

describe("루트 랜딩 가드 middleware", () => {
    it("비로그인(access_token 쿠키 없음)으로 루트(/) 접근 시 /welcome 으로 redirect", () => {
        const req = new NextRequest("https://harubuild.xyz/");

        const res = middleware(req);

        expect(res.status).toBe(307);
        expect(res.headers.get("location")).toContain("/welcome");
    });

    it("로그인(access_token 쿠키 보유)으로 루트(/) 접근 시 redirect 없이 통과", () => {
        const req = new NextRequest("https://harubuild.xyz/", {
            headers: { cookie: "access_token=abc123" },
        });

        const res = middleware(req);

        // NextResponse.next() — redirect 아님 → location 헤더 없음
        expect(res.headers.get("location")).toBeNull();
    });
});
