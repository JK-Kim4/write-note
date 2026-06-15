import { describe, it, expect } from 'vitest'
import {
  emptyHistory,
  pushSnapshot,
  undo,
  redo,
} from './history'
import type { History, Snapshot } from './history'
import { MARK } from './model'
import type { MarkRun } from './model'

// 테스트용 스냅샷 팩토리 (markRuns 포함)
function snap(buffer: string, anchor = 0, markRuns?: MarkRun[][]): Snapshot {
  const blocks = buffer.split('\n')
  const runs: MarkRun[][] =
    markRuns ??
    blocks.map((seg) => (seg.length === 0 ? [] : [{ len: seg.length, mask: 0 }]))
  return {
    buffer,
    blockAttrs: [{ type: 'paragraph' }],
    markRuns: runs,
    selection: { anchor, focus: anchor },
  }
}

describe('emptyHistory', () => {
  it('undo/redo 스택이 모두 빈 배열', () => {
    const h = emptyHistory()
    expect(h.undo).toEqual([])
    expect(h.redo).toEqual([])
  })
})

describe('pushSnapshot(coalesce:false)', () => {
  it('스냅샷을 undo 스택에 추가하고 redo 를 비운다', () => {
    const h0 = emptyHistory()
    const h1 = pushSnapshot(h0, snap('a'), { coalesce: false })
    expect(h1.undo).toHaveLength(1)
    expect(h1.undo[0].buffer).toBe('a')
    expect(h1.redo).toEqual([])
  })

  it('연속 push 시 undo 스택에 순서대로 쌓인다', () => {
    let h = emptyHistory()
    h = pushSnapshot(h, snap('a'), { coalesce: false })
    h = pushSnapshot(h, snap('ab'), { coalesce: false })
    expect(h.undo).toHaveLength(2)
    expect(h.undo[0].buffer).toBe('a')
    expect(h.undo[1].buffer).toBe('ab')
  })

  it('push 시 기존 redo 를 비운다', () => {
    // undo 한 뒤 새 편집이 들어오면 redo 무효
    let h = emptyHistory()
    h = pushSnapshot(h, snap('a'), { coalesce: false })
    const current = snap('a')
    const { history: h2 } = undo(h, current) // redo 에 current 가 들어감
    expect(h2.redo).toHaveLength(1)

    const h3 = pushSnapshot(h2, snap('b'), { coalesce: false })
    expect(h3.redo).toEqual([])
  })
})

describe('pushSnapshot(coalesce:true)', () => {
  it('빈 스택에서는 coalesce=true 도 새 스냅샷을 push 한다', () => {
    const h0 = emptyHistory()
    const h1 = pushSnapshot(h0, snap('a'), { coalesce: true })
    expect(h1.undo).toHaveLength(1)
    expect(h1.undo[0].buffer).toBe('a')
  })

  it('연속 2회 coalesce 시 undo 스택 길이가 1 (마지막 교체)', () => {
    let h = emptyHistory()
    h = pushSnapshot(h, snap('a'), { coalesce: true })
    h = pushSnapshot(h, snap('ab'), { coalesce: true })
    expect(h.undo).toHaveLength(1)
    expect(h.undo[0].buffer).toBe('ab')
  })

  it('coalesce=true 로 교체된 스냅샷으로 undo 시 교체본이 복원된다', () => {
    let h = emptyHistory()
    h = pushSnapshot(h, snap('a'), { coalesce: true })  // 최초 push
    h = pushSnapshot(h, snap('ab'), { coalesce: true }) // 교체
    h = pushSnapshot(h, snap('abc'), { coalesce: true }) // 교체

    const current = snap('abc')
    const { snapshot } = undo(h, current)
    // coalesce 로 교체된 최종본인 'abc' 가 undo 스택에 있었어야
    // undo 스택에는 교체 후 'abc' 한 개 — 그것이 pop 되어 복원 대상
    expect(snapshot?.buffer).toBe('abc')
  })

  it('coalesce=true push 시 redo 를 비운다', () => {
    let h = emptyHistory()
    h = pushSnapshot(h, snap('a'), { coalesce: false })
    const { history: h2 } = undo(h, snap('a'))
    expect(h2.redo).toHaveLength(1)

    const h3 = pushSnapshot(h2, snap('b'), { coalesce: true })
    expect(h3.redo).toEqual([])
  })
})

describe('undo', () => {
  it('undo 스택이 비었으면 snapshot:null, history 불변', () => {
    const h = emptyHistory()
    const { history: h2, snapshot } = undo(h, snap('x'))
    expect(snapshot).toBeNull()
    expect(h2).toBe(h) // 참조 동일(불변)
  })

  it('undo 후 pop 된 스냅샷을 복원 대상으로 반환', () => {
    let h = emptyHistory()
    h = pushSnapshot(h, snap('a'), { coalesce: false })

    const { history: h2, snapshot } = undo(h, snap('ab'))
    expect(snapshot?.buffer).toBe('a')
    expect(h2.undo).toHaveLength(0)
  })

  it('undo 시 current 가 redo 스택에 push 된다', () => {
    let h = emptyHistory()
    h = pushSnapshot(h, snap('a'), { coalesce: false })

    const current = snap('ab')
    const { history: h2 } = undo(h, current)
    expect(h2.redo).toHaveLength(1)
    expect(h2.redo[0].buffer).toBe('ab')
  })

  it('연속 undo 시 undo 스택에서 순서대로 꺼낸다', () => {
    let h = emptyHistory()
    h = pushSnapshot(h, snap('a'), { coalesce: false })
    h = pushSnapshot(h, snap('ab'), { coalesce: false })

    const { history: h2, snapshot: s1 } = undo(h, snap('abc'))
    expect(s1?.buffer).toBe('ab') // 마지막 push 가 먼저 pop

    const { snapshot: s2 } = undo(h2, snap('ab'))
    expect(s2?.buffer).toBe('a')
  })
})

describe('redo', () => {
  it('redo 스택이 비었으면 snapshot:null, history 불변', () => {
    const h = emptyHistory()
    const { history: h2, snapshot } = redo(h, snap('x'))
    expect(snapshot).toBeNull()
    expect(h2).toBe(h)
  })

  it('undo 후 redo 시 원상 복귀', () => {
    let h = emptyHistory()
    h = pushSnapshot(h, snap('a'), { coalesce: false })

    const current = snap('ab')
    const { history: h2 } = undo(h, current)             // redo 에 'ab' 들어감
    const { history: h3, snapshot } = redo(h2, snap('a')) // 'ab' 복원

    expect(snapshot?.buffer).toBe('ab')
    expect(h3.undo[h3.undo.length - 1]?.buffer).toBe('a') // current 가 undo 로
  })

  it('undo→redo 왕복 후 undo/redo 길이 원상 복귀', () => {
    let h = emptyHistory()
    h = pushSnapshot(h, snap('a'), { coalesce: false })
    h = pushSnapshot(h, snap('ab'), { coalesce: false })

    const undoLen = h.undo.length // 2

    const { history: h2 } = undo(h, snap('ab'))  // undo 1
    const { history: h3 } = redo(h2, snap('a'))  // redo 1 → 원상

    expect(h3.undo).toHaveLength(undoLen)
    expect(h3.redo).toHaveLength(0)
  })
})

describe('순수성 (불변성)', () => {
  it('pushSnapshot 은 입력 history 를 변형하지 않는다', () => {
    const h0 = emptyHistory()
    const before = JSON.stringify(h0)
    pushSnapshot(h0, snap('a'), { coalesce: false })
    expect(JSON.stringify(h0)).toBe(before)
  })

  it('undo 는 입력 history 를 변형하지 않는다', () => {
    let h = emptyHistory()
    h = pushSnapshot(h, snap('a'), { coalesce: false })
    const before = JSON.stringify(h)
    undo(h, snap('ab'))
    expect(JSON.stringify(h)).toBe(before)
  })

  it('redo 는 입력 history 를 변형하지 않는다', () => {
    let h = emptyHistory()
    h = pushSnapshot(h, snap('a'), { coalesce: false })
    const { history: h2 } = undo(h, snap('a'))
    const before = JSON.stringify(h2)
    redo(h2, snap('a'))
    expect(JSON.stringify(h2)).toBe(before)
  })
})

// ─────────────────────────────────────────
// T017: markRuns 포함 스냅샷 undo/redo
// ─────────────────────────────────────────
describe('T017: markRuns undo/redo 복원', () => {
  it('마크 적용 후 undo → 마크 사라짐', () => {
    // 초기: 마크 없는 "hello"
    const initial = snap('hello', 0, [[{ len: 5, mask: 0 }]])
    // 마크 적용 후: bold
    const withMark = snap('hello', 5, [[{ len: 5, mask: MARK.bold }]])

    let h = emptyHistory()
    h = pushSnapshot(h, initial, { coalesce: false })

    // withMark 상태에서 undo → initial 복원
    const { snapshot } = undo(h, withMark)
    expect(snapshot?.markRuns).toEqual([[{ len: 5, mask: 0 }]])
    expect(snapshot?.buffer).toBe('hello')
  })

  it('undo 후 redo → 마크 복원', () => {
    const initial = snap('hi', 0, [[{ len: 2, mask: 0 }]])
    const withMark = snap('hi', 2, [[{ len: 2, mask: MARK.italic }]])

    let h = emptyHistory()
    h = pushSnapshot(h, initial, { coalesce: false })

    // withMark 에서 undo
    const { history: h2, snapshot: undone } = undo(h, withMark)
    expect(undone?.markRuns).toEqual([[{ len: 2, mask: 0 }]])

    // initial 에서 redo → withMark 복원
    const { snapshot: redone } = redo(h2, initial)
    expect(redone?.markRuns).toEqual([[{ len: 2, mask: MARK.italic }]])
  })

  it('스냅샷에 markRuns 가 포함됨 (pendingMarks 미포함)', () => {
    const s = snap('abc', 0, [[{ len: 3, mask: MARK.bold | MARK.underline }]])
    expect(s.markRuns).toBeDefined()
    // pendingMarks 필드 없음
    expect((s as Record<string, unknown>)['pendingMarks']).toBeUndefined()
  })
})
