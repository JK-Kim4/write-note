import { describe, expect, it } from "vitest";
import { activeLinkCount, groupByTarget, linksForTarget, unreadProjects } from "./shareGrouping";
import type { ShareLinkResponse, SharedWorkMeta } from "@/lib/api/share";

function snap(projectId: number, title: string, unread = 0): SharedWorkMeta {
    return { projectId, title, unreadCommentCount: unread };
}

function link(
    id: number,
    targetType: ShareLinkResponse["targetType"],
    targetId: number,
    isActive: boolean,
    snapshots: SharedWorkMeta[],
    createdAt = "2026-06-25T00:00:00Z",
): ShareLinkResponse {
    return {
        id,
        token: `tok${id}`,
        targetType,
        targetId,
        isActive,
        shareUrl: `https://soseolbi.com/shared/tok${id}`,
        createdAt,
        snapshots,
    };
}

describe("linksForTarget", () => {
    it("대상 종류·id 가 모두 일치하는 링크만 거른다", () => {
        const links = [
            link(1, "work", 7, true, [snap(7, "물의 기억")]),
            link(2, "work", 8, true, [snap(8, "첫 번째 밤")]),
            link(3, "series", 7, true, [snap(9, "여름의 끝 1화")]), // 같은 id 지만 series → 제외
        ];
        const got = linksForTarget(links, "work", 7);
        expect(got.map((l) => l.id)).toEqual([1]);
    });

    it("같은 대상에 여러 링크면 모두(원래 순서 보존)", () => {
        const links = [
            link(10, "work", 7, true, [snap(7, "물의 기억")]),
            link(11, "work", 7, false, [snap(7, "물의 기억")]),
        ];
        expect(linksForTarget(links, "work", 7).map((l) => l.id)).toEqual([10, 11]);
    });
});

describe("activeLinkCount", () => {
    it("활성(isActive) 링크 수만 센다", () => {
        const links = [
            link(1, "work", 7, true, []),
            link(2, "work", 7, false, []),
            link(3, "work", 7, true, []),
        ];
        expect(activeLinkCount(links)).toBe(2);
    });

    it("빈 목록은 0", () => {
        expect(activeLinkCount([])).toBe(0);
    });
});

describe("unreadProjects", () => {
    it("안 읽은 피드백이 있는 작품만, projectId 로 dedup(작품 단위 동일 값)", () => {
        const links = [
            // 같은 작품(7)이 두 링크에 — 작품 단위 집계라 unread 값 동일, 한 번만 집계
            link(1, "work", 7, true, [snap(7, "물의 기억", 3)]),
            link(2, "work", 7, false, [snap(7, "물의 기억", 3)]),
            link(3, "work", 8, true, [snap(8, "첫 번째 밤", 0)]), // unread 0 → 제외
        ];
        const got = unreadProjects(links);
        expect(got).toEqual([{ projectId: 7, title: "물의 기억", unread: 3 }]);
    });

    it("시리즈 링크의 여러 공개 작품도 각 projectId 단위로 합산되어 안 읽은 수가 큰 순으로", () => {
        const links = [
            link(1, "series", 5, true, [snap(11, "1화", 1), snap(12, "2화", 4)]),
            link(2, "work", 9, true, [snap(9, "단편", 2)]),
        ];
        const got = unreadProjects(links);
        expect(got).toEqual([
            { projectId: 12, title: "2화", unread: 4 },
            { projectId: 9, title: "단편", unread: 2 },
            { projectId: 11, title: "1화", unread: 1 },
        ]);
    });

    it("안 읽은 피드백이 없으면 빈 배열", () => {
        expect(unreadProjects([link(1, "work", 7, true, [snap(7, "x", 0)])])).toEqual([]);
    });
});

describe("groupByTarget", () => {
    it("대상(종류+id)별로 묶고 활성 링크 수를 센다(원래 순서 보존)", () => {
        const links = [
            link(1, "work", 7, true, [snap(7, "물의 기억", 3)]),
            link(2, "work", 7, false, [snap(7, "물의 기억", 3)]),
            link(3, "series", 5, true, [snap(11, "1화", 1)]),
        ];
        const groups = groupByTarget(links);
        expect(groups).toHaveLength(2);
        expect(groups[0]).toMatchObject({ targetType: "work", targetId: 7, activeCount: 1 });
        expect(groups[0].links.map((l) => l.id)).toEqual([1, 2]);
        expect(groups[1]).toMatchObject({ targetType: "series", targetId: 5, activeCount: 1 });
    });

    it("빈 목록은 빈 그룹", () => {
        expect(groupByTarget([])).toEqual([]);
    });
});
