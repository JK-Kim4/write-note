import type { ManuscriptSize } from "@/stores/preferences";
import { extractPlainText } from "./wordCountUtils";

/**
 * 원고지 매수 계산 / 격자 크기 유틸 (006 T024).
 *
 * 원고지 3종:
 *   200자 = 10열 × 20행
 *   400자 = 20열 × 20행
 *  1000자 = 25열 × 40행
 *
 * 매수 = ceil(공백제외_자수 / 칸수)
 * 크기 변환 = 같은 자수에 다른 칸수 적용 (본문 불변, 유실 0)
 */

export interface ManuscriptDimensions {
    cols: number;
    rows: number;
}

const DIMENSIONS: Record<ManuscriptSize, ManuscriptDimensions> = {
    200: { cols: 10, rows: 20 },
    400: { cols: 20, rows: 20 },
    1000: { cols: 25, rows: 40 },
} as const;

/** ProseMirror JSON 본문에서 공백(스페이스·탭·개행) 제외 자수를 반환한다. */
export const countCharsForManuscript = (body: string): number => {
    const plain = extractPlainText(body);
    // 유니코드 공백 전체 제거 (\s = [ \t\n\r\f\v] + Unicode whitespace)
    return plain.replace(/\s/g, "").length;
};

/**
 * 공백제외 자수와 칸수를 받아 매수를 반환한다.
 * 0자이면 0매. 그 외 ceil(chars / size).
 */
export const calcManuscriptPages = (chars: number, size: ManuscriptSize): number => {
    if (chars <= 0) return 0;
    return Math.ceil(chars / size);
};

/** 원고지 크기(칸수)에 대응하는 열×행 크기를 반환한다. */
export const getManuscriptDimensions = (size: ManuscriptSize): ManuscriptDimensions => {
    return DIMENSIONS[size];
};
