import type { ProjectCard } from "../../electron/db/types";
import { lastSentence } from "./lastSentence";

/** 작품 벽 카드 표시용 view — 작품의 마지막 문장(본문 파생)·다음 장면(저장값)만. */
export type ProjectCardView = {
  id: string;
  title: string;
  /** 본문에서 파생한 마지막 문장. 본문이 비어 있으면 null(빈 상태 신호). */
  lastSentence: string | null;
  /** 작가가 적어둔 "다음에 쓸 장면" 한 줄. 미입력은 빈 문자열. */
  nextScene: string;
};

/** 작품 벽 카드 집계(ProjectCard)를 카드 view 로 변환한다. */
export function toProjectCardView(card: ProjectCard): ProjectCardView {
  return {
    id: card.id,
    title: card.title,
    lastSentence: lastSentence(card.lastSentenceSource),
    nextScene: card.nextScene,
  };
}
