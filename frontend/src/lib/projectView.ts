/** 작품 벽 카드 표시용 view — desktop lib/projectView.ts 이식(web ProjectCard 기반, id:number). */
import type { ProjectCard } from "@/lib/types/domain";
import { lastSentence } from "./lastSentence";

export type ProjectCardView = {
    id: number;
    title: string;
    /** 본문에서 파생한 마지막 문장. 비어 있으면 null(빈 상태 신호). */
    lastSentence: string | null;
    /** 작가가 적어둔 "다음에 쓸 장면" 한 줄. */
    nextScene: string;
};

export function toProjectCardView(card: ProjectCard): ProjectCardView {
    return {
        id: card.id,
        title: card.title,
        lastSentence: lastSentence(card.lastSentenceSource),
        nextScene: card.nextScene,
    };
}
