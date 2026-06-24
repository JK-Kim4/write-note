/**
 * 플롯 노드 역할 타입(038 후속, V25) — 생성 시 선택, 타입별 색상/라벨로 구분.
 * 코드 식별자(plot/character/place/theme/note)는 백엔드 ALLOWED_NODE_TYPES 와 일치.
 * Tailwind 클래스는 JIT 안전을 위해 전부 리터럴 문자열로 둔다(동적 보간 금지).
 */

export type NodeKindId = "plot" | "character" | "place" | "theme" | "note";

export interface NodeKind {
    id: NodeKindId;
    label: string;
    /** 카드 좌측 강조 테두리 */
    accent: string;
    /** 타입 배지 배경+글자 */
    chip: string;
    /** 작은 색 점(메뉴/마커) */
    dot: string;
}

export const NODE_KINDS: NodeKind[] = [
    { id: "plot", label: "플롯/사건", accent: "border-l-terracotta-400", chip: "bg-terracotta-50 text-terracotta-700", dot: "bg-terracotta-500" },
    { id: "character", label: "인물", accent: "border-l-teal-400", chip: "bg-teal-50 text-teal-700", dot: "bg-teal-500" },
    { id: "place", label: "장소", accent: "border-l-emerald-400", chip: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
    { id: "theme", label: "테마/소재", accent: "border-l-violet-400", chip: "bg-violet-50 text-violet-700", dot: "bg-violet-500" },
    { id: "note", label: "메모", accent: "border-l-slate-400", chip: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
];

export const DEFAULT_KIND: NodeKindId = "plot";

const KIND_MAP: Record<string, NodeKind> = Object.fromEntries(NODE_KINDS.map((k) => [k.id, k]));

/** 알 수 없는 값은 기본 plot 으로 안전 폴백. */
export function kindOf(id: string | undefined): NodeKind {
    return KIND_MAP[id ?? ""] ?? KIND_MAP.plot;
}
