/**
 * 카드 역할 종류(트랙 D) — 4종(인물·장소·사건·테마). 기본 무지정(null).
 * 카드를 만들 땐 종류를 안 묻고, 선택 후 칩으로 부여·재탭 해제(progressive disclosure).
 * 색 = 종류별 저채도 배경 틴트(-50) + 같은 계열 전체 테두리(-200) (트랙 B 팔레트 승계, 보드 colorMode=light 고정).
 * 'event'(사건)는 폐기된 'plot'의 terracotta 승계, 무지정은 폐기된 'note'의 slate 회색.
 * Tailwind 클래스는 JIT 안전을 위해 전부 리터럴 문자열로 둔다(동적 보간 금지).
 */

export type CardKindId = "character" | "place" | "event" | "theme";

export interface CardKind {
    /** 종류 id. null = 무지정(UNTYPED_KIND) */
    id: CardKindId | null;
    label: string;
    /** 카드 배경 틴트(저채도, 계열 -50) */
    bg: string;
    /** 카드 전체 테두리(계열 -200) */
    border: string;
    /** 타입 배지 배경(-100)+글자(-700) */
    chip: string;
    /** 선택 시 테두리+링(계열 -500 테두리 + -200 링) */
    selected: string;
    /** 연결점(React Flow Handle) 색(-400, `!` 로 RF 기본 배경 덮어씀) */
    handle: string;
    /** 작은 색 점(칩 마커) */
    dot: string;
}

/** 종류 부여 칩 4종(무지정은 칩에 미포함 — 재탭으로 해제). */
export const CARD_KINDS: CardKind[] = [
    { id: "character", label: "인물", bg: "bg-teal-50", border: "border-teal-200", chip: "bg-teal-100 text-teal-700", selected: "border-teal-500 ring-2 ring-teal-200", handle: "!bg-teal-400", dot: "bg-teal-500" },
    { id: "place", label: "장소", bg: "bg-emerald-50", border: "border-emerald-200", chip: "bg-emerald-100 text-emerald-700", selected: "border-emerald-500 ring-2 ring-emerald-200", handle: "!bg-emerald-400", dot: "bg-emerald-500" },
    { id: "event", label: "사건", bg: "bg-terracotta-50", border: "border-terracotta-200", chip: "bg-terracotta-100 text-terracotta-700", selected: "border-terracotta-500 ring-2 ring-terracotta-200", handle: "!bg-terracotta-400", dot: "bg-terracotta-500" },
    { id: "theme", label: "테마", bg: "bg-violet-50", border: "border-violet-200", chip: "bg-violet-100 text-violet-700", selected: "border-violet-500 ring-2 ring-violet-200", handle: "!bg-violet-400", dot: "bg-violet-500" },
];

/** 무지정 카드(종류 없음) — 중립 회색(slate). 칩 트레이엔 노출 안 함. */
export const UNTYPED_KIND: CardKind = {
    id: null,
    label: "종류 없음",
    bg: "bg-slate-50",
    border: "border-slate-200",
    chip: "bg-slate-100 text-slate-500",
    selected: "border-slate-500 ring-2 ring-slate-200",
    handle: "!bg-slate-400",
    dot: "bg-slate-400",
};

const KIND_MAP: Record<string, CardKind> = Object.fromEntries(CARD_KINDS.map((k) => [k.id as string, k]));

/** 서버 type → 종류. null·미지정·폐기값(plot/note 등)은 무지정(UNTYPED_KIND)으로 안전 폴백. */
export function kindOf(id: string | null | undefined): CardKind {
    return (id != null && KIND_MAP[id]) || UNTYPED_KIND;
}
