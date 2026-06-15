/**
 * PoC 자체 에디터 — 페이지네이션 레이아웃 엔진(순수). 본 PoC의 핵심.
 *
 * 제어 역전: CSS column-wrap 이 나누고 JS 가 추정하던 구조를 버리고, **JS 가 직접 분할을 결정**한다.
 * 측정값(줄별 높이·이미지 높이)을 주입받아 "현재 페이지 남은 높이" 커서로 배치 → 브라우저 없이 결정론적(TDD).
 */

/** 측정된 한 줄 — 높이(px)와 블록 텍스트 내 문자 범위. */
export type MeasuredLine = { height: number; start: number; end: number };

/** 측정 완료된 블록. 문단은 줄 배열, 이미지는 자연 높이(px). */
export type MeasuredBlock =
    | { kind: "paragraph"; id: string; lines: MeasuredLine[] }
    | { kind: "image"; id: string; height: number };

/** 한 페이지에 배치된 조각. 문단은 줄 범위(startLine..endLine), 이미지는 통째. */
export type PlacedFragment =
    | { kind: "paragraph"; blockId: string; startLine: number; endLine: number; offsetY: number; height: number }
    | { kind: "image"; blockId: string; offsetY: number; height: number };

/** 배치 결과 한 페이지. */
export type LaidOutPage = { index: number; fragments: PlacedFragment[]; usedHeight: number };

/**
 * 측정된 블록들을 페이지 본문 높이에 따라 페이지로 분할한다(순수함수).
 *
 * - 문단: 줄을 채우다 안 들어가면 **그 줄부터 다음 페이지로 이어** 놓는다(통째 점프 없음 = 기준 ①).
 * - 이미지: 남은 높이에 안 들어가면 **통째로 다음 페이지로 밀고** 현재 페이지에 빈 공간을 남긴다(기준 ③).
 * - contentHeightPx 만 바꿔 재호출하면 규격/폰트 변경 리플로우가 된다(기준 ②).
 *
 * @param blocks 측정 완료 블록(문서 순서)
 * @param contentHeightPx 페이지 본문 높이(px) — pageGeometry().contentHeightPx
 */
export function layout(blocks: MeasuredBlock[], contentHeightPx: number): LaidOutPage[] {
    const pages: LaidOutPage[] = [];
    let cur: LaidOutPage = { index: 0, fragments: [], usedHeight: 0 };
    let y = 0;

    const newPage = () => {
        pages.push(cur);
        cur = { index: cur.index + 1, fragments: [], usedHeight: 0 };
        y = 0;
    };

    for (const block of blocks) {
        if (block.kind === "image") {
            // 빈 페이지(y=0)가 아니고 안 들어가면 다음 페이지로 통째 밀기.
            if (y + block.height > contentHeightPx && y > 0) newPage();
            cur.fragments.push({ kind: "image", blockId: block.id, offsetY: y, height: block.height });
            y += block.height;
            cur.usedHeight = y;
            continue;
        }

        // 문단 — 페이지 경계에서 줄 단위로 쪼개 fragment 로 분리.
        let i = 0;
        while (i < block.lines.length) {
            const fragStart = i;
            const fragTopY = y;
            let fragHeight = 0;
            // 현재 페이지가 채우는 만큼 줄을 담는다. y>0 가드 = 빈 페이지엔 첫 줄을 항상 놓아(과대 줄 방지) 무한루프 차단.
            while (i < block.lines.length) {
                const lineH = block.lines[i].height;
                if (y + lineH > contentHeightPx && y > 0) break;
                y += lineH;
                fragHeight += lineH;
                i++;
            }
            if (i > fragStart) {
                cur.fragments.push({
                    kind: "paragraph",
                    blockId: block.id,
                    startLine: fragStart,
                    endLine: i - 1,
                    offsetY: fragTopY,
                    height: fragHeight,
                });
                cur.usedHeight = y;
            }
            if (i < block.lines.length) newPage(); // 남은 줄 → 다음 페이지에서 이어 놓기
        }
    }

    pages.push(cur);
    return pages;
}
