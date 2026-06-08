/**
 * 큐레이션 차이 계산 순수 함수 (006 US4 T053).
 *
 * 현재 연결(current) vs 새 선택(next) 의 add/remove diff 를 계산한다.
 * 외부 상태에 의존하지 않는 순수 함수 — 단위 테스트 대상.
 */

export interface ProjectConnection {
    projectId: number;
    characterIds: number[];
}

export interface CurationDiff {
    /** 새로 추가된 projectId 목록 */
    addedProjectIds: number[];
    /** 제거된 projectId 목록 */
    removedProjectIds: number[];
    /** 유지되었으나 characterIds 가 변경된 projectId 목록 */
    changedCharacterProjectIds: number[];
    /** 변경이 전혀 없으면 true */
    isIdentical: boolean;
}

/**
 * 프로젝트 연결 배열을 projectId → 정렬된 characterIds 맵으로 변환.
 * 비교를 위한 내부 헬퍼.
 */
const toMap = (connections: ReadonlyArray<ProjectConnection>): Map<number, ReadonlyArray<number>> => {
    return new Map(
        connections.map((c) => [c.projectId, [...c.characterIds].sort((a, b) => a - b)]),
    );
};

const arraysEqual = (a: ReadonlyArray<number>, b: ReadonlyArray<number>): boolean => {
    if (a.length !== b.length) return false;
    return a.every((v, i) => v === b[i]);
};

/**
 * 현재 큐레이션 연결과 새 선택의 diff 를 계산한다.
 *
 * @param current - 저장된 현재 연결 목록
 * @param next    - 사용자가 선택한 새 연결 목록
 */
export function diffCurations(
    current: ReadonlyArray<ProjectConnection>,
    next: ReadonlyArray<ProjectConnection>,
): CurationDiff {
    const currentMap = toMap(current);
    const nextMap = toMap(next);

    const addedProjectIds: number[] = [];
    const removedProjectIds: number[] = [];
    const changedCharacterProjectIds: number[] = [];

    for (const [projectId, nextChars] of nextMap) {
        if (!currentMap.has(projectId)) {
            addedProjectIds.push(projectId);
        } else {
            const currentChars = currentMap.get(projectId) ?? [];
            if (!arraysEqual([...currentChars].sort((a, b) => a - b), [...nextChars].sort((a, b) => a - b))) {
                changedCharacterProjectIds.push(projectId);
            }
        }
    }

    for (const projectId of currentMap.keys()) {
        if (!nextMap.has(projectId)) {
            removedProjectIds.push(projectId);
        }
    }

    const isIdentical =
        addedProjectIds.length === 0 &&
        removedProjectIds.length === 0 &&
        changedCharacterProjectIds.length === 0;

    return { addedProjectIds, removedProjectIds, changedCharacterProjectIds, isIdentical };
}

/**
 * 태그 배열의 diff 를 계산한다.
 *
 * @param current - 저장된 현재 태그 목록
 * @param next    - 사용자가 선택한 새 태그 목록
 */
export interface TagsDiff {
    addedTags: string[];
    removedTags: string[];
    isIdentical: boolean;
}

export function diffTags(
    current: ReadonlyArray<string>,
    next: ReadonlyArray<string>,
): TagsDiff {
    const currentSet = new Set(current);
    const nextSet = new Set(next);

    const addedTags = [...nextSet].filter((t) => !currentSet.has(t));
    const removedTags = [...currentSet].filter((t) => !nextSet.has(t));
    const isIdentical = addedTags.length === 0 && removedTags.length === 0;

    return { addedTags, removedTags, isIdentical };
}
