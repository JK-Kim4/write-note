/**
 * undo/redo 스냅샷 스택 (순수 함수, 불변)
 *
 * 규약:
 *   - 모든 함수는 입력 History 를 변형하지 않는다(새 객체 반환).
 *   - undo 스택의 0번 인덱스 = 가장 오래된 스냅샷, 마지막 인덱스 = 가장 최근.
 *   - pushSnapshot(coalesce:true) 는 마지막 undo 스냅샷을 교체한다(연속 타이핑 한 묶음).
 *   - pushSnapshot 은 어느 경우든 redo 스택을 비운다(새 편집 = redo 무효).
 */

import type { DocModel, Selection, MarkRun } from './model'

export type Snapshot = {
  buffer: string
  blockAttrs: DocModel['blockAttrs']
  markRuns: MarkRun[][]    // ★ 2라운드: markRuns 포함 (pendingMarks 제외)
  selection: Selection
}

export type History = {
  undo: Snapshot[]
  redo: Snapshot[]
}

const UNDO_LIMIT = 200

export function emptyHistory(): History {
  return { undo: [], redo: [] }
}

/**
 * 새 스냅샷 push.
 * - coalesce=false: undo 스택 끝에 push, redo 비움.
 * - coalesce=true : undo 스택이 비었으면 push, 아니면 마지막 항목을 snapshot 으로 교체. redo 비움.
 */
export function pushSnapshot(
  history: History,
  snapshot: Snapshot,
  opts: { coalesce: boolean },
): History {
  let nextUndo: Snapshot[]

  if (opts.coalesce && history.undo.length > 0) {
    // 마지막 스냅샷을 snapshot 으로 교체
    nextUndo = [...history.undo.slice(0, -1), snapshot]
  } else {
    nextUndo = [...history.undo, snapshot]
  }

  // 상한 적용 — 초과분은 오래된 것(앞)부터 제거
  if (nextUndo.length > UNDO_LIMIT) {
    nextUndo = nextUndo.slice(nextUndo.length - UNDO_LIMIT)
  }

  return { undo: nextUndo, redo: [] }
}

/**
 * undo: 가장 최근 undo 스냅샷을 꺼내 반환하고, current 를 redo 에 push.
 * undo 스택이 비었으면 snapshot:null, history 불변.
 */
export function undo(
  history: History,
  current: Snapshot,
): { history: History; snapshot: Snapshot | null } {
  if (history.undo.length === 0) {
    return { history, snapshot: null }
  }

  const popped = history.undo[history.undo.length - 1]
  const nextUndo = history.undo.slice(0, -1)
  const nextRedo = [...history.redo, current]

  return {
    history: { undo: nextUndo, redo: nextRedo },
    snapshot: popped,
  }
}

/**
 * redo: 가장 최근 redo 스냅샷을 꺼내 반환하고, current 를 undo 에 push.
 * redo 스택이 비었으면 snapshot:null, history 불변.
 */
export function redo(
  history: History,
  current: Snapshot,
): { history: History; snapshot: Snapshot | null } {
  if (history.redo.length === 0) {
    return { history, snapshot: null }
  }

  const popped = history.redo[history.redo.length - 1]
  const nextRedo = history.redo.slice(0, -1)
  const nextUndo = [...history.undo, current]

  return {
    history: { undo: nextUndo, redo: nextRedo },
    snapshot: popped,
  }
}
