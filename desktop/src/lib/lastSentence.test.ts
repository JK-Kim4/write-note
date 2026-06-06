import { describe, expect, it } from "vitest";
import { lastSentence } from "./lastSentence";

describe("lastSentence", () => {
  it("should_return_null_for_empty_or_whitespace", () => {
    expect(lastSentence("")).toBeNull();
    expect(lastSentence("   \n  ")).toBeNull();
  });

  it("should_return_single_sentence_as_is", () => {
    expect(lastSentence("문 앞에 섰다.")).toBe("문 앞에 섰다.");
  });

  it("should_return_last_of_multiple_sentences", () => {
    expect(lastSentence("문을 열었다. 안은 어두웠다.")).toBe("안은 어두웠다.");
  });

  it("should_split_on_newlines", () => {
    expect(lastSentence("첫 줄\n둘째 줄\n마지막 줄")).toBe("마지막 줄");
  });

  it("should_handle_korean_terminators", () => {
    expect(lastSentence("정말? 그래! 음…")).toBe("음…");
  });

  it("should_trim_trailing_blank_paragraph", () => {
    expect(lastSentence("끝 문장.\n\n  ")).toBe("끝 문장.");
  });
});
