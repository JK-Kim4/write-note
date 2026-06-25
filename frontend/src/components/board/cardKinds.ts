/**
 * 카드 역할 타입(038 후속, V25) — 생성 시 선택, 타입별 색상/라벨로 구분.
 * 코드 식별자(plot/character/place/theme/note)는 백엔드 ALLOWED_CARD_TYPES 와 일치.
 * 색 = 타입별 저채도 배경 틴트(-50) + 같은 계열 전체 테두리(-200) (Miro 스타일, 보드는 colorMode=light 고정).
 * Tailwind 클래스는 JIT 안전을 위해 전부 리터럴 문자열로 둔다(동적 보간 금지).
 */

export type CardKindId = "plot" | "character" | "place" | "theme" | "note";

export interface CardKind {
    id: CardKindId;
    label: string;
    /** 카드 배경 틴트(저채도, 계열 -50) */
    bg: string;
    /** 카드 전체 테두리(계열 -200) */
    border: string;
    /** 타입 배지 배경(-100)+글자(-700) — 카드 배경(-50)보다 한 단계 진해 구분된다 */
    chip: string;
    /** 선택 시 테두리+링 — 카드 타입 같은 계열(-500 테두리 + -200 링) */
    selected: string;
    /** 연결점(React Flow Handle) 색 — 카드 타입 같은 계열(-400, `!` 로 RF 기본 배경 덮어씀) */
    handle: string;
    /** 작은 색 점(메뉴/마커) */
    dot: string;
}

export const CARD_KINDS: CardKind[] = [
    { id: "plot", label: "플롯/사건", bg: "bg-terracotta-50", border: "border-terracotta-200", chip: "bg-terracotta-100 text-terracotta-700", selected: "border-terracotta-500 ring-2 ring-terracotta-200", handle: "!bg-terracotta-400", dot: "bg-terracotta-500" },
    { id: "character", label: "인물", bg: "bg-teal-50", border: "border-teal-200", chip: "bg-teal-100 text-teal-700", selected: "border-teal-500 ring-2 ring-teal-200", handle: "!bg-teal-400", dot: "bg-teal-500" },
    { id: "place", label: "장소", bg: "bg-emerald-50", border: "border-emerald-200", chip: "bg-emerald-100 text-emerald-700", selected: "border-emerald-500 ring-2 ring-emerald-200", handle: "!bg-emerald-400", dot: "bg-emerald-500" },
    { id: "theme", label: "테마/소재", bg: "bg-violet-50", border: "border-violet-200", chip: "bg-violet-100 text-violet-700", selected: "border-violet-500 ring-2 ring-violet-200", handle: "!bg-violet-400", dot: "bg-violet-500" },
    { id: "note", label: "메모", bg: "bg-slate-50", border: "border-slate-200", chip: "bg-slate-100 text-slate-700", selected: "border-slate-500 ring-2 ring-slate-200", handle: "!bg-slate-400", dot: "bg-slate-400" },
];

export const DEFAULT_KIND: CardKindId = "plot";

const KIND_MAP: Record<string, CardKind> = Object.fromEntries(CARD_KINDS.map((k) => [k.id, k]));

/** 알 수 없는 값은 기본 plot 으로 안전 폴백. */
export function kindOf(id: string | undefined): CardKind {
    return KIND_MAP[id ?? ""] ?? KIND_MAP.plot;
}
