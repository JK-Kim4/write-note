import type { Project } from "../../electron/db/types";
import { formatRelativeDay } from "./relativeDate";

/** 작품 카드 표시용 view — 도메인 Project 에서 표시에 필요한 필드만 파생한다. */
export type ProjectCardView = {
  id: string;
  title: string;
  /** summary 미리보기. 빈 문자열이면 카드에서 생략한다. */
  summaryPreview: string;
  /** updatedAt 을 현재 기준 한국어 상대 라벨로. */
  lastEditedLabel: string;
};

/** 도메인 Project 를 작품 카드 view 로 변환한다(글자수는 Document 영역 — Phase 4). */
export function toProjectCardView(project: Project, now: Date): ProjectCardView {
  return {
    id: project.id,
    title: project.title,
    summaryPreview: project.summary,
    lastEditedLabel: formatRelativeDay(project.updatedAt, now),
  };
}
