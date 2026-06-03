import type { Project } from "../../electron/db/types";

/** 작품 카드 표시용 view — 도메인 Project 에서 표시에 필요한 필드만 파생한다. */
export type ProjectCardView = {
  id: string;
  title: string;
  /** summary 미리보기. 빈 문자열이면 카드에서 생략한다. */
  summaryPreview: string;
  /** updatedAt 을 현재 기준 한국어 상대 라벨로. */
  lastEditedLabel: string;
};

const DAY_MS = 86_400_000;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

// 달력일 차이 기준 — 시·분 단위는 MVP 에서 다루지 않는다(일 단위로 충분).
function formatLastEdited(iso: string, now: Date): string {
  const days = Math.round((startOfDay(now) - startOfDay(new Date(iso))) / DAY_MS);
  if (days <= 0) return "오늘";
  if (days === 1) return "어제";
  if (days < 7) return `${days}일 전`;
  return `${Math.floor(days / 7)}주 전`;
}

/** 도메인 Project 를 작품 카드 view 로 변환한다(글자수는 Document 영역 — Phase 4). */
export function toProjectCardView(project: Project, now: Date): ProjectCardView {
  return {
    id: project.id,
    title: project.title,
    summaryPreview: project.summary,
    lastEditedLabel: formatLastEdited(project.updatedAt, now),
  };
}
