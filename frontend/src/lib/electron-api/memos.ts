/**
 * webElectronApi.memos (015 US2) — desktop `electronAPI.memos` 의 web 구현체.
 *
 * 설계 §3: 화면은 동일 인터페이스로 호출하고 구현(fetch)을 모른다. 006 memo 어댑터 + 014 작품-곁쪽지
 * endpoint 를 contracts/web-electron-api.md 에 매핑한다.
 *
 * 검증된 백엔드 동작에 따른 합성:
 * - 캡처(POST /api/memos)는 작품을 "연결"하지 않고 activeProjectAtCapture(맥락)만 기록한다. 따라서
 *   linkProjectId 가 주어지면 캡처 후 curation 으로 그 작품에 연결해야 서랍(listByProject)에 나타난다.
 * - addLink/removeLink 는 선언적 큐레이션(PUT /api/memos/{id}/curation)으로 매핑 — 현재 상태를 읽고 차이 반영.
 * - delete/restore 는 soft-delete(deletedAt) + 복원 endpoint 로 매핑(019 US1) — 연결 보존, 되돌리기 시 복귀.
 */
import {
    captureMemo,
    curateMemo,
    deleteMemo,
    getMemo,
    listMemos,
    listProjectMemos,
    restoreMemo,
    setProjectMemoPin,
} from "@/lib/api/memo";
import type { CurationInput } from "@/lib/api/memo";
import type { MemoResponse, ProjectMemoResponse } from "@/types/api";
import type { LinkedProject, Memo, ProjectMemo } from "@/lib/types/domain";

/** 캡처 입력 — desktop CaptureMemoInput(body + linkProjectId). linkProjectId 면 그 작품에 연결한다. */
export type CaptureMemoInput = { body: string; linkProjectId: number | null };

function toLinkedProjects(memo: MemoResponse): LinkedProject[] {
    return memo.projects.map((p) => ({ id: p.projectId, title: p.title }));
}

function toMemo(memo: MemoResponse): Memo {
    return {
        id: memo.id,
        body: memo.body,
        source: memo.source,
        capturedAt: memo.capturedAt,
        linkedProjects: toLinkedProjects(memo),
    };
}

function toProjectMemo(memo: ProjectMemoResponse): ProjectMemo {
    return {
        id: memo.memoId,
        projectId: memo.projectId,
        body: memo.body,
        source: memo.source,
        capturedAt: memo.capturedAt,
        pinned: memo.pinned,
    };
}

/** 현재 메모의 큐레이션 전체 상태(작품 연결·등장인물·태그·사유)를 선언적 입력으로 변환. */
function toCurationInput(memo: MemoResponse): CurationInput {
    return {
        projectConnections: memo.projects.map((p) => ({
            projectId: p.projectId,
            characterIds: p.characters.map((c) => c.characterId),
        })),
        tags: memo.tags,
        reasonNote: memo.reasonNote,
    };
}

export const memos = {
    /**
     * 곁쪽지 캡처. linkProjectId 가 있으면 캡처 후 그 작품에 연결(curation)해 서랍에 노출되게 한다.
     * 미연결(null)이면 책상(미분류)에만 남는다.
     */
    create: async (input: CaptureMemoInput): Promise<Memo> => {
        const captured = await captureMemo({ body: input.body, activeProjectId: input.linkProjectId });
        if (input.linkProjectId === null) return toMemo(captured);
        const linked = await curateMemo(captured.id, {
            projectConnections: [{ projectId: input.linkProjectId, characterIds: [] }],
            tags: captured.tags,
            reasonNote: captured.reasonNote,
        });
        return toMemo(linked);
    },

    /** 전역 메모 목록(책상). size:100 — 베타 한계(메모 소수 전제, 규모 증가 시 페이지네이션). */
    list: async (): Promise<Memo[]> => (await listMemos({ size: 100 })).content.map(toMemo),

    /** 작품에 연결된 곁쪽지(서랍) — 고정 우선·최신순(014). */
    listByProject: async (projectId: number): Promise<ProjectMemo[]> =>
        (await listProjectMemos(projectId)).map(toProjectMemo),

    /** 곁쪽지 고정 토글(작품당 1개 불변식은 014 가 보장). */
    setPin: async (memoId: number, projectId: number, pinned: boolean): Promise<void> => {
        await setProjectMemoPin(projectId, memoId, pinned);
    },

    /** 작품 연결 추가 — 현재 큐레이션을 읽어 projectId 를 더해 선언적으로 PUT. 이미 연결돼 있으면 멱등. */
    addLink: async (memoId: number, projectId: number): Promise<void> => {
        const memo = await getMemo(memoId);
        const input = toCurationInput(memo);
        if (input.projectConnections.some((c) => c.projectId === projectId)) return;
        await curateMemo(memoId, {
            ...input,
            projectConnections: [...input.projectConnections, { projectId, characterIds: [] }],
        });
    },

    /** 작품 연결 해제 — 현재 큐레이션에서 projectId 만 빼고 선언적으로 PUT. */
    removeLink: async (memoId: number, projectId: number): Promise<void> => {
        const memo = await getMemo(memoId);
        const input = toCurationInput(memo);
        await curateMemo(memoId, {
            ...input,
            projectConnections: input.projectConnections.filter((c) => c.projectId !== projectId),
        });
    },

    /** 곁쪽지 버리기(soft-delete) — 연결 보존, restore 로 복귀 가능. */
    delete: async (memoId: number): Promise<void> => {
        await deleteMemo(memoId);
    },

    /** 버린 곁쪽지 되돌리기 — 작품 연결·고정 복귀. */
    restore: async (memoId: number): Promise<void> => {
        await restoreMemo(memoId);
    },

    /**
     * 재진입 한 장 후보 — 그 작품의 고정 곁쪽지 1장(없으면 null). 014 가 작품당 1개를 보장하므로 첫 pinned.
     * US3(ReentryCard)에서 사용.
     */
    pickReentry: async (projectId: number): Promise<ProjectMemo | null> => {
        const rows = (await listProjectMemos(projectId)).map(toProjectMemo);
        return rows.find((m) => m.pinned) ?? null;
    },
};
