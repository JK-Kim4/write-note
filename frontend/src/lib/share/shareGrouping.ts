/**
 * 공유 링크 그룹핑/집계(047) — 순수 함수.
 *
 * `listMyShareLinks()` 의 1:N 응답(한 대상에 링크 여럿)을 진입점·관리 화면용으로 거르고 묶는다.
 * 안 읽은 피드백 수(unreadCommentCount)는 BE 가 스냅샷(=링크) 단위로 채우므로(050 — 읽음 처리와 정합),
 * 같은 작품이 여러 링크에 있으면 projectId 로 묶어 스냅샷별 값을 합산한다(대표값 하나만 취하면 과소 집계).
 */
import type { ShareLinkResponse, ShareTargetType } from "@/lib/api/share";

/** 한 대상(작품/시리즈)으로 묶인 공유 링크 + 활성 수. */
export type TargetGroup = {
    targetType: ShareTargetType;
    targetId: number;
    /** 그 대상의 링크들(원래 순서=최근순 보존). */
    links: ShareLinkResponse[];
    /** 활성(공유 중) 링크 수. */
    activeCount: number;
};

/** 안 읽은 피드백이 있는 작품 한 건(받은 피드백 섹션용). */
export type UnreadProject = { projectId: number; title: string; unread: number };

/** 대상 종류+id 가 모두 일치하는 링크만 거른다(원래 순서 보존). */
export function linksForTarget(
    links: ReadonlyArray<ShareLinkResponse>,
    targetType: ShareTargetType,
    targetId: number,
): ShareLinkResponse[] {
    return links.filter((l) => l.targetType === targetType && l.targetId === targetId);
}

/** 활성(isActive) 링크 수. */
export function activeLinkCount(links: ReadonlyArray<ShareLinkResponse>): number {
    return links.reduce((n, l) => (l.isActive ? n + 1 : n), 0);
}

/**
 * 안 읽은 피드백이 있는 작품 목록(projectId dedup, unread>0). 안 읽은 수가 큰 순,
 * 동률은 projectId 오름차순(결정적).
 */
export function unreadProjects(links: ReadonlyArray<ShareLinkResponse>): UnreadProject[] {
    const byProject = new Map<number, UnreadProject>();
    for (const link of links) {
        for (const snap of link.snapshots) {
            if (snap.unreadCommentCount <= 0) continue;
            // 스냅샷 단위 값 — 같은 작품의 여러 링크(스냅샷) unread 를 합산.
            const existing = byProject.get(snap.projectId);
            if (existing) {
                existing.unread += snap.unreadCommentCount;
            } else {
                byProject.set(snap.projectId, {
                    projectId: snap.projectId,
                    title: snap.title,
                    unread: snap.unreadCommentCount,
                });
            }
        }
    }
    return [...byProject.values()].sort((a, b) => b.unread - a.unread || a.projectId - b.projectId);
}

/** 대상(종류+id)별로 링크를 묶는다. 그룹 순서 = 첫 등장 순서(=최근순) 보존. */
export function groupByTarget(links: ReadonlyArray<ShareLinkResponse>): TargetGroup[] {
    const groups: TargetGroup[] = [];
    const indexByKey = new Map<string, number>();
    for (const link of links) {
        const key = `${link.targetType}:${link.targetId}`;
        const existing = indexByKey.get(key);
        if (existing == null) {
            indexByKey.set(key, groups.length);
            groups.push({
                targetType: link.targetType,
                targetId: link.targetId,
                links: [link],
                activeCount: link.isActive ? 1 : 0,
            });
        } else {
            const g = groups[existing];
            g.links.push(link);
            if (link.isActive) g.activeCount += 1;
        }
    }
    return groups;
}
