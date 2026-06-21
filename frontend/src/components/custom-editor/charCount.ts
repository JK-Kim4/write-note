/**
 * 본문 글자수(031 분량 지표) — 자체 에디터 model.buffer 기반(순수).
 * 블록 구분(\n)·소프트 줄바꿈(U+2028)은 글자가 아니므로 제외. 공백은 포함.
 * 코드포인트 단위로 세어 한글 음절·조합 중 자모를 각각 1글자로 카운트.
 */

import { SOFT_BREAK } from "./model";

const BLOCK_SEP = "\n";

export function countChars(buffer: string): number {
    let n = 0;
    for (const ch of buffer) {
        if (ch !== BLOCK_SEP && ch !== SOFT_BREAK) n++;
    }
    return n;
}
