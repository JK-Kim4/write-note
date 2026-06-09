/**
 * 본문(plainText)에서 마지막 비어있지 않은 문장을 파생한다(저장하지 않음). desktop lib/lastSentence.ts 이식.
 * 한국어 종결부호(`.?!…`) 뒤 공백 또는 줄바꿈으로 문장을 나눈다. 빈 본문이면 null.
 */
export function lastSentence(plainText: string): string | null {
    const trimmed = plainText.trim();
    if (!trimmed) return null;
    const parts = trimmed
        .split(/(?<=[.?!…])\s+|\n+/)
        .map((s) => s.trim())
        .filter(Boolean);
    return parts.length > 0 ? parts[parts.length - 1] : trimmed;
}
