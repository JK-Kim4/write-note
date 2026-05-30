import { describe, expect, it } from "vitest";
import { diffCurations, diffTags } from "./curation";
import type { ProjectConnection } from "./curation";

/**
 * 큐레이션 차이 계산 단위 테스트 (006 US4 T053).
 *
 * diffCurations / diffTags 는 순수 함수 — 외부 의존성 없이 테스트.
 */

describe("diffCurations", () => {
    it("현재와 다음이 동일하면 isIdentical=true 를 반환한다", () => {
        const current: ProjectConnection[] = [
            { projectId: 1, characterIds: [10, 20] },
        ];
        const next: ProjectConnection[] = [
            { projectId: 1, characterIds: [20, 10] }, // 순서 달라도 동일
        ];

        const result = diffCurations(current, next);

        expect(result.isIdentical).toBe(true);
        expect(result.addedProjectIds).toHaveLength(0);
        expect(result.removedProjectIds).toHaveLength(0);
        expect(result.changedCharacterProjectIds).toHaveLength(0);
    });

    it("새 프로젝트 추가 시 addedProjectIds 에 포함된다", () => {
        const current: ProjectConnection[] = [];
        const next: ProjectConnection[] = [
            { projectId: 5, characterIds: [] },
        ];

        const result = diffCurations(current, next);

        expect(result.addedProjectIds).toContain(5);
        expect(result.isIdentical).toBe(false);
    });

    it("프로젝트 제거 시 removedProjectIds 에 포함된다", () => {
        const current: ProjectConnection[] = [
            { projectId: 3, characterIds: [1] },
        ];
        const next: ProjectConnection[] = [];

        const result = diffCurations(current, next);

        expect(result.removedProjectIds).toContain(3);
        expect(result.isIdentical).toBe(false);
    });

    it("같은 프로젝트에서 인물만 변경 시 changedCharacterProjectIds 에 포함된다", () => {
        const current: ProjectConnection[] = [
            { projectId: 2, characterIds: [10] },
        ];
        const next: ProjectConnection[] = [
            { projectId: 2, characterIds: [10, 11] },
        ];

        const result = diffCurations(current, next);

        expect(result.changedCharacterProjectIds).toContain(2);
        expect(result.addedProjectIds).toHaveLength(0);
        expect(result.removedProjectIds).toHaveLength(0);
        expect(result.isIdentical).toBe(false);
    });

    it("여러 프로젝트 혼합 — 추가/제거/변경을 각각 분류한다", () => {
        const current: ProjectConnection[] = [
            { projectId: 1, characterIds: [10] },    // 유지 + 인물 변경
            { projectId: 2, characterIds: [20] },    // 제거
        ];
        const next: ProjectConnection[] = [
            { projectId: 1, characterIds: [10, 11] }, // 인물 변경
            { projectId: 3, characterIds: [] },       // 신규 추가
        ];

        const result = diffCurations(current, next);

        expect(result.addedProjectIds).toContain(3);
        expect(result.removedProjectIds).toContain(2);
        expect(result.changedCharacterProjectIds).toContain(1);
        expect(result.isIdentical).toBe(false);
    });

    it("빈 연결 → 빈 연결은 isIdentical=true 를 반환한다", () => {
        const result = diffCurations([], []);

        expect(result.isIdentical).toBe(true);
    });

    it("인물 없는 프로젝트가 인물이 없는 상태로 유지되면 isIdentical=true", () => {
        const current: ProjectConnection[] = [{ projectId: 7, characterIds: [] }];
        const next: ProjectConnection[] = [{ projectId: 7, characterIds: [] }];

        const result = diffCurations(current, next);

        expect(result.isIdentical).toBe(true);
    });
});

describe("diffTags", () => {
    it("현재와 다음이 동일하면 isIdentical=true 를 반환한다", () => {
        const result = diffTags(["판타지", "마법"], ["마법", "판타지"]);

        expect(result.isIdentical).toBe(true);
    });

    it("새 태그 추가 시 addedTags 에 포함된다", () => {
        const result = diffTags(["판타지"], ["판타지", "모험"]);

        expect(result.addedTags).toContain("모험");
        expect(result.isIdentical).toBe(false);
    });

    it("태그 제거 시 removedTags 에 포함된다", () => {
        const result = diffTags(["판타지", "모험"], ["판타지"]);

        expect(result.removedTags).toContain("모험");
        expect(result.isIdentical).toBe(false);
    });

    it("빈 태그 배열끼리는 isIdentical=true", () => {
        const result = diffTags([], []);

        expect(result.isIdentical).toBe(true);
    });

    it("중복 태그는 집합으로 처리한다 (deduplicate)", () => {
        // next 에 중복 태그가 있어도 set 처리로 한 번만 카운트
        const result = diffTags(["판타지"], ["판타지", "판타지"]);

        expect(result.isIdentical).toBe(true);
    });
});
