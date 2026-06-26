/**
 * 보드 캔버스 순수 헬퍼(044). React Flow 상호작용과 분리된 결정 로직만 둔다(단위 테스트 대상).
 */

/**
 * 더블클릭 대상이 React Flow 의 빈 캔버스(pane)인지 — 빈 곳 더블클릭 카드 생성의 회귀 가드.
 * 카드(`.react-flow__node`)·핸들·컨트롤·패널 위 더블클릭은 false 라 카드 생성에서 제외된다.
 * (React Flow 12 에는 `onPaneDoubleClick` prop 이 없어 wrapper 네이티브 더블클릭 + 본 판별을 쓴다.)
 */
export function isPaneHit(target: EventTarget | null): boolean {
    return target instanceof HTMLElement && target.classList.contains("react-flow__pane");
}
