import type { MouseEvent } from "react";

/**
 * 사이드 컨트롤(스톱워치·보조 패널 버튼 등) 클릭이 자체 에디터(EditContext stage)의 포커스를
 * 뺏지 않게 한다 — mousedown 의 기본 동작(포커스 이동)만 막고 click(onClick) 은 그대로 발화한다.
 *
 * 자체 엔진은 stage 가 포커스를 잃으면 키 입력(textupdate)을 못 받아, 버튼 클릭 후 본문 타이핑이
 * 끊긴다(다시 본문을 클릭해야 입력 재개). 에디터 내부 툴바 `ToolbarButton` 과 동일 패턴.
 *
 * 주의: `<input>`/`<textarea>`/`<select>` 등 자체 포커스가 필요한 컨트롤에는 달지 않는다.
 */
export function keepEditorFocus(e: MouseEvent): void {
    e.preventDefault();
}
