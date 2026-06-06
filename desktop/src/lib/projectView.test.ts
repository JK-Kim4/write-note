import { describe, expect, it } from "vitest";
import type { ProjectCard } from "../../electron/db/types";
import { toProjectCardView } from "./projectView";

const baseCard: ProjectCard = {
  id: "p1",
  title: "바다가 보이는 방",
  summary: "담담한 1인칭 회상",
  tone: "",
  genre: "",
  targetLength: null,
  nextScene: "문 앞에서 망설이는 장면",
  createdAt: "2026-06-01T12:00:00.000Z",
  updatedAt: "2026-06-03T12:00:00.000Z",
  lastSentenceSource: "파도가 멀리서 다가왔다. 그녀는 창을 열었다.",
};

describe("toProjectCardView", () => {
  it("should_map_id_and_title_verbatim", () => {
    const v = toProjectCardView(baseCard);
    expect(v.id).toBe("p1");
    expect(v.title).toBe("바다가 보이는 방");
  });

  it("should_derive_last_sentence_from_body_source", () => {
    expect(toProjectCardView(baseCard).lastSentence).toBe("그녀는 창을 열었다.");
  });

  it("should_set_last_sentence_null_when_body_empty", () => {
    expect(toProjectCardView({ ...baseCard, lastSentenceSource: "" }).lastSentence).toBeNull();
  });

  it("should_carry_next_scene_as_is", () => {
    expect(toProjectCardView(baseCard).nextScene).toBe("문 앞에서 망설이는 장면");
    expect(toProjectCardView({ ...baseCard, nextScene: "" }).nextScene).toBe("");
  });
});
