type Props = { zoom: number; onZoom: (z: number) => void };

const MIN = 0.7;
const MAX = 1.5;
const STEP = 0.1;

const round1 = (n: number) => Math.round(n * 10) / 10;

/** 작업공간(종이) 축소/확대. 가운데 % 클릭 시 100%로. */
export function ZoomControl({ zoom, onZoom }: Props) {
  return (
    <div className="zoom-control" role="group" aria-label="작업공간 확대·축소">
      <button type="button" aria-label="축소" disabled={zoom <= MIN} onClick={() => onZoom(round1(Math.max(MIN, zoom - STEP)))}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
      </button>
      <button type="button" className="zoom-control__val" onClick={() => onZoom(1)} title="100%로 맞추기">
        {Math.round(zoom * 100)}%
      </button>
      <button type="button" aria-label="확대" disabled={zoom >= MAX} onClick={() => onZoom(round1(Math.min(MAX, zoom + STEP)))}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      </button>
    </div>
  );
}
