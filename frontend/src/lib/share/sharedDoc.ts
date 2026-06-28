/**
 * 공유 공개 페이지(046 R5) — 스냅샷 PM JSON → 읽기 전용 렌더 모델.
 *
 * 집필 에디터/인쇄가 쓰는 자산을 그대로 재사용한다:
 *   pmJsonToModel(bodyJson) → DocModel → relayout(model, geo) → View(blocks).
 * SharedReader(렌더)와 CommentLayer(블록 텍스트 길이) 가 같은 geo·변환을 공유하도록 단일 진입점을 둔다.
 *
 * 블록 인덱스(View.blocks 순서)는 댓글 앵커 blockIndex 와 1:1(research R-4). 읽기 전용이라
 * 페이지 분할(view.pages)은 쓰지 않고 블록을 연속 흐름으로 렌더한다.
 */
import { pageGeometry, type PageGeometry } from "@/components/custom-editor/geometry";
import { pmJsonToModel } from "@/components/custom-editor/pmConvert";
import { relayout, type View } from "@/components/custom-editor/printLayout";

/** 공유 읽기 기본 기하 — A4·본문 18px(인쇄/집필 기본과 동일, 줄 측정용). 폭은 화면에서 max-width 로 제한. */
export const SHARED_READER_GEO: PageGeometry = pageGeometry("A4", 18);

/** bodyJson(평문 PM JSON) → relayout View(blocks). 손상 JSON 은 pmJsonToModel 이 빈 모델로 흡수. */
export function buildSharedView(bodyJson: string): View {
    return relayout(pmJsonToModel(bodyJson), SHARED_READER_GEO);
}

/** View.blocks → 블록별 본문 텍스트(이미지/hr 등 비-문단 블록은 빈 문자열). 앵커 길이·인용에 사용. */
export function blockTextsOf(view: View): string[] {
    return view.blocks.map((b) => (b.kind === "paragraph" ? b.text : ""));
}
