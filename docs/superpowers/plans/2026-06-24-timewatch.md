# 타임워치(Timewatch) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 집필실의 자동 시간측정(머무름=측정)을 사용자 제어 스톱워치("타임워치")로 전환한다 — 시작/일시정지/집필 종료로 사용자가 잰 시간만 작업 시간에 반영.

**Architecture:** 기존 `work-sessions` API를 그대로 재사용한다(스키마 변경 0). 일시정지=세션 종료(`end`), 재개=새 세션(`start`), 집필 종료=`end`(+선택 메모 시 `end-with-log`). 신규 FE 훅 `useTimewatch`가 클라 상태(idle/running/paused)+세션 호출을 소유하고, `Timewatch` 카드가 우패널 최상단에 표시된다. 백엔드는 `end`의 30초 폐기 규칙만 제거(측정분 전량 보존).

**Tech Stack:** Next.js 16(App Router)+React 19+TS, Tailwind, React Query, Vitest/RTL (FE) · Kotlin/Spring Boot, JUnit5/MockK/Testcontainers (BE).

설계 SoT: `docs/superpowers/specs/2026-06-24-timewatch-design.md` · 목업: `docs/research/2026-06-23-timewatch-mockup.html`(스타일 A).

## Global Constraints

- UI 문구는 한국어. 상태 라벨 = "집필 시간"(idle)/"집필 중"(running)/"일시정지"(paused). 버튼 = "▶ 시작"/"⏸ 일시정지"/"▶ 다시 시작"/"■ 집필 종료". 모달 = "집필을 마칠까요?" / "메모 없이 종료" / "기록하고 종료".
- 강조색 = terracotta 토큰(`bg-terracotta-600`, `text-terracotta-700`, `border-terracotta-200`, `bg-terracotta-50`). 집필 중 점 = `bg-green-500`.
- **FE 명령은 cwd=`frontend/` 고정.** FE verify = `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- BE verify = `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test`. ktlintFormat 은 main+test 양쪽.
- TDD Red→Green. Mock 은 시스템 경계만(여기선 `@/lib/electron-api` HTTP 경계). 스키마 변경 0 — 기존 `work-sessions` 재사용.
- 배포 순서: Task 1(BE, 느슨해지는 변경 — 구 FE 무영향) 먼저 또는 무관. FE(Task 2~5) 후행. 전 구간 dogfooding 게이트 필수.

---

## File Structure

- **Create** `frontend/src/lib/formatStopwatch.ts` — ms→"HH:MM:SS" 순수 포맷터. (+ `.test.ts`)
- **Create** `frontend/src/hooks/useTimewatch.ts` — 타임워치 상태머신 + 세션 호출 훅. (+ `.test.ts`)
- **Create** `frontend/src/components/b/Timewatch.tsx` — 타이머 카드(표시+버튼) 프레젠테이셔널. (+ `.test.tsx`)
- **Modify** `frontend/src/components/b/BStudioShell.tsx` — `useWorkSession`→`useTimewatch` 교체, 좌패널 "작업 종료" 버튼 제거, 종료 모달 재구성(✕·선택 메모·2버튼·경과시간), 우패널/Drawer 최상단에 `Timewatch` 결선.
- **Delete** `frontend/src/hooks/useWorkSession.ts` + `frontend/src/hooks/useWorkSession.test.ts` — `useTimewatch`가 대체(유일 사용처 = BStudioShell).
- **Modify** `frontend/src/app/(main)/works/[id]/page.test.tsx` — "작업 종료 후 라우팅" 테스트를 타임워치 흐름(시작→집필 종료→메모 없이 종료)으로 갱신.
- **Modify** `backend/.../service/WorkSessionService.kt` — `end`가 지속시간 무관 보존(30초 폐기 제거). `start`의 잔여세션 정리(`closeOpen` 폐기)는 유지.
- **Modify** `backend/.../service/WorkSessionServiceTest.kt` — `end` 단시간 보존 단위 테스트 추가.
- **Modify** `backend/.../controller/WorkSessionControllerIT.kt` — `auto-end discards session shorter than threshold` → 보존 단언으로 갱신.

---

## Task 1: 백엔드 — `end` 가 측정분 전량 보존 (30초 폐기 제거)

**Files:**
- Modify: `backend/src/main/kotlin/com/writenote/service/WorkSessionService.kt:43-51` (`end`) + KDoc `:19`
- Modify(test): `backend/src/test/kotlin/com/writenote/service/WorkSessionServiceTest.kt`
- Modify(test): `backend/src/test/kotlin/com/writenote/controller/WorkSessionControllerIT.kt:60-76`

**Interfaces:**
- Produces: `WorkSessionService.end(userId, projectId): WorkSessionResponse?` — 열린 세션이 있으면 지속시간과 무관하게 `endedAt` 기록 후 반환, 없으면 null. (이전: 30초 미만 폐기 후 null)
- 불변: `start`는 기존대로 잔여 열린 세션을 `closeOpen`(30초 미만 폐기)로 정리. `endWithLog`는 그대로 짧아도 보존.

- [ ] **Step 1: 실패 테스트 추가 (단위) — end 가 30초 미만도 보존**

`WorkSessionServiceTest.kt` 에 추가(기존 `end returns null when no open session` 테스트 아래):

```kotlin
    @Test
    @DisplayName("end — 30초 미만 세션도 폐기하지 않고 보존한다(타임워치)")
    fun `end preserves session shorter than threshold`() {
        val open = WorkSession(id = 7L, userId = 1L, projectId = 100L, startedAt = Instant.now().minusSeconds(5))
        every { projectRepository.findByIdAndUserId(100L, 1L) } returns Optional.of(project(id = 100L, userId = 1L))
        every { workSessionRepository.findFirstByProjectIdAndEndedAtIsNull(100L) } returns open
        every { workSessionRepository.save(any<WorkSession>()) } answers { firstArg() }

        val result = service.end(userId = 1L, projectId = 100L)

        assertThat(result).isNotNull()
        assertThat(open.endedAt).isNotNull() // 5s < 30s 이지만 보존
        verify(exactly = 0) { workSessionRepository.delete(any<WorkSession>()) }
    }
```

> 참고: `project(...)` 헬퍼·`every {}` 패턴·import 는 같은 파일의 기존 테스트(예: `start closes existing open session then opens new`)에서 그대로 차용한다. `Optional`/`verify` import 가 없으면 추가.

- [ ] **Step 2: 실패 확인**

Run: `cd backend && ./gradlew test --tests "com.writenote.service.WorkSessionServiceTest"`
Expected: FAIL — 현재 `end`가 5초 세션을 `delete`(폐기)하므로 `verify(exactly=0){delete}` 위반 또는 `result` null.

- [ ] **Step 3: `end` 를 보존 구현으로 변경**

`WorkSessionService.kt` 의 `end`(현재 43-51):

```kotlin
    @Transactional(rollbackFor = [Exception::class])
    fun end(
        userId: Long,
        projectId: Long,
    ): WorkSessionResponse? {
        requireOwnedProject(userId, projectId)
        val open = workSessionRepository.findFirstByProjectIdAndEndedAtIsNull(projectId) ?: return null
        open.endedAt = Instant.now()
        return workSessionRepository.save(open).toResponse()
    }
```

그리고 KDoc(`:19`)을 갱신:

```kotlin
 * - end: 사용자 종료/일시정지/이탈. 열린 세션이 있으면 지속시간과 무관하게 ended_at 기록(타임워치 측정분 전량 보존).
```

> `closeOpen`(110-123)·`minSessionSeconds`(27)는 그대로 둔다 — `start`의 잔여세션 정리에서 계속 사용된다(미사용 경고 없음).

- [ ] **Step 4: 단위 테스트 통과 확인**

Run: `cd backend && ./gradlew test --tests "com.writenote.service.WorkSessionServiceTest"`
Expected: PASS (전부).

- [ ] **Step 5: 통합 테스트(IT) 갱신 — 폐기→보존**

`WorkSessionControllerIT.kt:60-76` 의 테스트를 아래로 교체:

```kotlin
    @Test
    fun `auto-end preserves session shorter than threshold`() {
        val owner = createUser()
        val projectId = createProject(owner.id!!).id!!
        val sessionId =
            workSessionRepository
                .saveAndFlush(WorkSession(userId = owner.id!!, projectId = projectId, startedAt = Instant.now().minusSeconds(5)))
                .id!!

        // 타임워치 — 30초 미만 자동 종료도 보존
        mockMvc
            .perform(post("/api/projects/{projectId}/work-sessions/end", projectId).header("Authorization", bearerFor(owner)))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.endedAt").exists())

        assertThat(workSessionRepository.findById(sessionId)).isPresent()
    }
```

> `start opens session and re-start keeps exactly one open`(40-58)은 **변경하지 않는다** — start 의 잔여 폐기는 유지된다.

- [ ] **Step 6: BE 게이트 통과 확인**

Run: `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test --tests "com.writenote.service.WorkSessionServiceTest" --tests "com.writenote.controller.WorkSessionControllerIT"`
Expected: PASS. (lint 위반 시 `./gradlew ktlintFormat` 후 재실행 — main+test 양쪽.)

- [ ] **Step 7: 커밋**

```bash
git add backend/src/main/kotlin/com/writenote/service/WorkSessionService.kt backend/src/test/kotlin/com/writenote/service/WorkSessionServiceTest.kt backend/src/test/kotlin/com/writenote/controller/WorkSessionControllerIT.kt
git commit -m "feat(timewatch): work-session end 가 측정분 전량 보존(30초 폐기 제거)"
```

---

## Task 2: FE — `formatStopwatch` 포맷터

**Files:**
- Create: `frontend/src/lib/formatStopwatch.ts`
- Test: `frontend/src/lib/formatStopwatch.test.ts`

**Interfaces:**
- Produces: `formatStopwatch(ms: number): string` — 음수/소수 가드 후 `"HH:MM:SS"`(2자리 0패딩).

- [ ] **Step 1: 실패 테스트**

`frontend/src/lib/formatStopwatch.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatStopwatch } from "./formatStopwatch";

describe("formatStopwatch", () => {
    it("0 이면 00:00:00", () => {
        expect(formatStopwatch(0)).toBe("00:00:00");
    });
    it("분·초를 0패딩한다", () => {
        expect(formatStopwatch(12 * 60_000 + 47_000)).toBe("00:12:47");
    });
    it("시간 단위를 넘긴다", () => {
        expect(formatStopwatch(3 * 3_600_000 + 5 * 60_000 + 9_000)).toBe("03:05:09");
    });
    it("음수는 00:00:00 으로 가드", () => {
        expect(formatStopwatch(-500)).toBe("00:00:00");
    });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && npx vitest run src/lib/formatStopwatch.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현**

`frontend/src/lib/formatStopwatch.ts`:

```ts
/** 경과 밀리초를 "HH:MM:SS" 로 포맷(스톱워치 표시용). 음수는 0 으로 가드. */
export function formatStopwatch(ms: number): string {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd frontend && npx vitest run src/lib/formatStopwatch.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/lib/formatStopwatch.ts frontend/src/lib/formatStopwatch.test.ts
git commit -m "feat(timewatch): formatStopwatch(ms)->HH:MM:SS 포맷터"
```

---

## Task 3: FE — `useTimewatch` 훅 (상태머신 + 세션 호출)

**Files:**
- Create: `frontend/src/hooks/useTimewatch.ts`
- Test: `frontend/src/hooks/useTimewatch.test.ts`

**Interfaces:**
- Consumes: `webElectronApi.sessions.{start,end,endBeacon,endWithLog}` (from `@/lib/electron-api`), `sessionKeys`(`@/lib/query/useSessions`), `logKeys`(`@/lib/query/useLogs`).
- Produces:
  ```ts
  type TimewatchStatus = "idle" | "running" | "paused";
  function useTimewatch(projectId: number): {
      status: TimewatchStatus;
      elapsedMs: number;
      start: () => void;
      pause: () => void;
      resume: () => void;
      stop: (memo?: string) => Promise<void>;
  }
  ```
  매핑: `start`→`sessions.start`, `pause`→`sessions.end`(누적 보존), `resume`→`sessions.start`, `stop(memo)`→ memo 있으면 `endWithLog`(+`logKeys` 무효화) / 없으면 running 일 때만 `end`. 종료류는 `sessionKeys` 무효화. running 중 이탈: unmount→`end`, pagehide→`endBeacon`.

- [ ] **Step 1: 실패 테스트**

`frontend/src/hooks/useTimewatch.test.ts`:

```ts
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTimewatch } from "./useTimewatch";

const sessions = {
    start: vi.fn().mockResolvedValue(undefined),
    end: vi.fn().mockResolvedValue(undefined),
    endBeacon: vi.fn(),
    endWithLog: vi.fn().mockResolvedValue(undefined),
};
vi.mock("@/lib/electron-api", () => ({ webElectronApi: { sessions } }));

function wrapper({ children }: { children: ReactNode }) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
    sessions.start.mockClear();
    sessions.end.mockClear();
    sessions.endWithLog.mockClear();
    sessions.endBeacon.mockClear();
});

describe("useTimewatch", () => {
    it("시작하면 running + sessions.start 호출", () => {
        const { result } = renderHook(() => useTimewatch(1), { wrapper });
        act(() => result.current.start());
        expect(result.current.status).toBe("running");
        expect(sessions.start).toHaveBeenCalledWith(1);
    });

    it("일시정지하면 paused + sessions.end 호출", () => {
        const { result } = renderHook(() => useTimewatch(1), { wrapper });
        act(() => result.current.start());
        act(() => result.current.pause());
        expect(result.current.status).toBe("paused");
        expect(sessions.end).toHaveBeenCalledWith(1);
    });

    it("다시 시작하면 running + sessions.start 재호출(새 구간)", () => {
        const { result } = renderHook(() => useTimewatch(1), { wrapper });
        act(() => result.current.start());
        act(() => result.current.pause());
        act(() => result.current.resume());
        expect(result.current.status).toBe("running");
        expect(sessions.start).toHaveBeenCalledTimes(2);
    });

    it("메모와 함께 종료하면 endWithLog 호출 + idle", async () => {
        const { result } = renderHook(() => useTimewatch(1), { wrapper });
        act(() => result.current.start());
        await act(async () => { await result.current.stop("3장 다시 씀"); });
        expect(sessions.endWithLog).toHaveBeenCalledWith(1, "3장 다시 씀");
        expect(result.current.status).toBe("idle");
    });

    it("메모 없이 종료(running)면 end 호출 + idle", async () => {
        const { result } = renderHook(() => useTimewatch(1), { wrapper });
        act(() => result.current.start());
        await act(async () => { await result.current.stop(); });
        expect(sessions.end).toHaveBeenCalledWith(1);
        expect(sessions.endWithLog).not.toHaveBeenCalled();
        expect(result.current.status).toBe("idle");
    });

    it("running 중 언마운트하면 end 로 자동 기록", () => {
        const { result, unmount } = renderHook(() => useTimewatch(1), { wrapper });
        act(() => result.current.start());
        sessions.end.mockClear();
        unmount();
        expect(sessions.end).toHaveBeenCalledWith(1);
    });

    it("idle 에서 언마운트하면 end 호출 없음", () => {
        const { unmount } = renderHook(() => useTimewatch(1), { wrapper });
        unmount();
        expect(sessions.end).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && npx vitest run src/hooks/useTimewatch.test.ts`
Expected: FAIL — 훅 없음.

- [ ] **Step 3: 구현**

`frontend/src/hooks/useTimewatch.ts`:

```ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { webElectronApi } from "@/lib/electron-api";
import { sessionKeys } from "@/lib/query/useSessions";
import { logKeys } from "@/lib/query/useLogs";

export type TimewatchStatus = "idle" | "running" | "paused";

/**
 * 타임워치(집필 시간 사용자 제어 측정) — 자동 시간측정을 대체한다.
 *
 * 매핑: 시작=sessions.start, 일시정지=end(구간 종료·누적 보존), 다시 시작=start(새 구간),
 * 집필 종료=메모 있으면 endWithLog / 없으면 running 일 때 end. running 중 이탈(unmount/pagehide)은
 * 그때까지 시간을 자동 기록(end/endBeacon). 종료류 후 작업시간 집계(sessionKeys) 무효화.
 *
 * 누적 표시(elapsedMs)는 클라 로컬 상태 — 서버 영속 없음. 재진입 시 0 부터(그전 기록은 서버에 저장됨).
 */
export function useTimewatch(projectId: number): {
    status: TimewatchStatus;
    elapsedMs: number;
    start: () => void;
    pause: () => void;
    resume: () => void;
    stop: (memo?: string) => Promise<void>;
} {
    const queryClient = useQueryClient();
    const [status, setStatus] = useState<TimewatchStatus>("idle");
    const [elapsedMs, setElapsedMs] = useState(0);
    // 완료 구간 누적 ms + 현재 running 구간 시작 시각(ms epoch). 표시는 1초 틱으로 갱신.
    const accumulatedRef = useRef(0);
    const segmentStartRef = useRef<number | null>(null);
    const statusRef = useRef<TimewatchStatus>("idle");
    statusRef.current = status;

    const invalidateSessions = useCallback(() => {
        void queryClient.invalidateQueries({ queryKey: sessionKeys.all });
    }, [queryClient]);

    useEffect(() => {
        if (status !== "running") return;
        const tick = () => {
            const seg = segmentStartRef.current;
            setElapsedMs(accumulatedRef.current + (seg != null ? Date.now() - seg : 0));
        };
        tick();
        const id = window.setInterval(tick, 1000);
        return () => window.clearInterval(id);
    }, [status]);

    const start = useCallback(() => {
        if (statusRef.current !== "idle") return;
        accumulatedRef.current = 0;
        segmentStartRef.current = Date.now();
        setElapsedMs(0);
        setStatus("running");
        void webElectronApi.sessions.start(projectId);
    }, [projectId]);

    const pause = useCallback(() => {
        if (statusRef.current !== "running") return;
        const seg = segmentStartRef.current;
        if (seg != null) accumulatedRef.current += Date.now() - seg;
        segmentStartRef.current = null;
        setElapsedMs(accumulatedRef.current);
        setStatus("paused");
        void webElectronApi.sessions.end(projectId).then(invalidateSessions);
    }, [projectId, invalidateSessions]);

    const resume = useCallback(() => {
        if (statusRef.current !== "paused") return;
        segmentStartRef.current = Date.now();
        setStatus("running");
        void webElectronApi.sessions.start(projectId);
    }, [projectId]);

    const stop = useCallback(
        async (memo?: string) => {
            const trimmed = memo?.trim() ?? "";
            const wasRunning = statusRef.current === "running";
            try {
                if (trimmed) {
                    await webElectronApi.sessions.endWithLog(projectId, trimmed);
                    await queryClient.invalidateQueries({ queryKey: logKeys.all });
                } else if (wasRunning) {
                    await webElectronApi.sessions.end(projectId);
                }
                invalidateSessions();
            } finally {
                accumulatedRef.current = 0;
                segmentStartRef.current = null;
                setElapsedMs(0);
                setStatus("idle");
            }
        },
        [projectId, queryClient, invalidateSessions],
    );

    // running 중 이탈 — 그때까지 시간 기록(unmount=end, pagehide=endBeacon). idle/paused 면 열린 세션 없음 → no-op.
    useEffect(() => {
        const onPageHide = () => {
            if (statusRef.current === "running") webElectronApi.sessions.endBeacon(projectId);
        };
        window.addEventListener("pagehide", onPageHide);
        return () => {
            window.removeEventListener("pagehide", onPageHide);
            if (statusRef.current === "running") {
                void webElectronApi.sessions.end(projectId).then(invalidateSessions);
            }
        };
    }, [projectId, invalidateSessions]);

    return { status, elapsedMs, start, pause, resume, stop };
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd frontend && npx vitest run src/hooks/useTimewatch.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/hooks/useTimewatch.ts frontend/src/hooks/useTimewatch.test.ts
git commit -m "feat(timewatch): useTimewatch 훅(시작/일시정지/재개/종료 + 이탈 자동기록)"
```

---

## Task 4: FE — `Timewatch` 카드 컴포넌트 (스타일 A)

**Files:**
- Create: `frontend/src/components/b/Timewatch.tsx`
- Test: `frontend/src/components/b/Timewatch.test.tsx`

**Interfaces:**
- Consumes: `formatStopwatch`(Task 2), `TimewatchStatus`(Task 3).
- Produces: `Timewatch` 컴포넌트.
  ```ts
  type TimewatchProps = {
      status: TimewatchStatus;
      elapsedMs: number;
      onStart: () => void;
      onPause: () => void;
      onResume: () => void;
      onRequestStop: () => void;
  };
  ```
  idle→[▶ 시작], running→[⏸ 일시정지][■ 집필 종료], paused→[▶ 다시 시작][■ 집필 종료]. 시간은 `formatStopwatch(elapsedMs)`.

- [ ] **Step 1: 실패 테스트**

`frontend/src/components/b/Timewatch.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Timewatch } from "./Timewatch";

const noop = () => {};

describe("Timewatch", () => {
    it("대기 상태: 시작 버튼만, 00:00:00", () => {
        render(<Timewatch status="idle" elapsedMs={0} onStart={noop} onPause={noop} onResume={noop} onRequestStop={noop} />);
        expect(screen.getByText("00:00:00")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /시작/ })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /일시정지/ })).not.toBeInTheDocument();
    });

    it("집필 중: 일시정지·집필 종료 버튼 + 경과시간 표시", () => {
        render(<Timewatch status="running" elapsedMs={767_000} onStart={noop} onPause={noop} onResume={noop} onRequestStop={noop} />);
        expect(screen.getByText("00:12:47")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /일시정지/ })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /집필 종료/ })).toBeInTheDocument();
    });

    it("일시정지: 다시 시작·집필 종료 버튼", () => {
        render(<Timewatch status="paused" elapsedMs={767_000} onStart={noop} onPause={noop} onResume={noop} onRequestStop={noop} />);
        expect(screen.getByRole("button", { name: /다시 시작/ })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /집필 종료/ })).toBeInTheDocument();
    });

    it("시작 버튼 클릭 시 onStart 호출", async () => {
        const onStart = vi.fn();
        render(<Timewatch status="idle" elapsedMs={0} onStart={onStart} onPause={noop} onResume={noop} onRequestStop={noop} />);
        await userEvent.click(screen.getByRole("button", { name: /시작/ }));
        expect(onStart).toHaveBeenCalledOnce();
    });

    it("집필 종료 클릭 시 onRequestStop 호출", async () => {
        const onRequestStop = vi.fn();
        render(<Timewatch status="running" elapsedMs={1000} onStart={noop} onPause={noop} onResume={noop} onRequestStop={onRequestStop} />);
        await userEvent.click(screen.getByRole("button", { name: /집필 종료/ }));
        expect(onRequestStop).toHaveBeenCalledOnce();
    });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && npx vitest run src/components/b/Timewatch.test.tsx`
Expected: FAIL — 컴포넌트 없음.

- [ ] **Step 3: 구현**

`frontend/src/components/b/Timewatch.tsx`:

```tsx
"use client";

import { formatStopwatch } from "@/lib/formatStopwatch";
import type { TimewatchStatus } from "@/hooks/useTimewatch";

type TimewatchProps = {
    status: TimewatchStatus;
    elapsedMs: number;
    onStart: () => void;
    onPause: () => void;
    onResume: () => void;
    onRequestStop: () => void;
};

const LABEL: Record<TimewatchStatus, string> = {
    idle: "집필 시간",
    running: "집필 중",
    paused: "일시정지",
};

const PRIMARY = "flex-1 rounded-lg bg-terracotta-600 px-3 py-2 text-sm font-semibold text-white hover:bg-terracotta-700";
const GHOST = "flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50";
const STOP = "flex-1 rounded-lg border border-terracotta-200 bg-white px-3 py-2 text-sm font-semibold text-terracotta-700 hover:bg-terracotta-50";

/** 타임워치 카드(031 분량 카드처럼 우패널 상단 독립 카드). 상태별 버튼 전환 — 로직은 useTimewatch 가 소유. */
export function Timewatch({ status, elapsedMs, onStart, onPause, onResume, onRequestStop }: TimewatchProps) {
    const dot =
        status === "running"
            ? "bg-green-500 shadow-[0_0_0_3px_rgba(22,163,74,0.15)]"
            : status === "paused"
              ? "bg-terracotta-500"
              : "bg-gray-300";
    return (
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-gray-400">
                <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden />
                {LABEL[status]}
            </div>
            <div className={`text-3xl font-extrabold tabular-nums ${status === "idle" ? "text-gray-400" : "text-gray-900"}`}>
                {formatStopwatch(elapsedMs)}
            </div>
            <div className="mt-2.5 flex gap-1.5">
                {status === "idle" && (
                    <button type="button" onClick={onStart} className={PRIMARY}>▶ 시작</button>
                )}
                {status === "running" && (
                    <>
                        <button type="button" onClick={onPause} className={GHOST}>⏸ 일시정지</button>
                        <button type="button" onClick={onRequestStop} className={STOP}>■ 집필 종료</button>
                    </>
                )}
                {status === "paused" && (
                    <>
                        <button type="button" onClick={onResume} className={PRIMARY}>▶ 다시 시작</button>
                        <button type="button" onClick={onRequestStop} className={STOP}>■ 집필 종료</button>
                    </>
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd frontend && npx vitest run src/components/b/Timewatch.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/components/b/Timewatch.tsx frontend/src/components/b/Timewatch.test.tsx
git commit -m "feat(timewatch): Timewatch 카드 컴포넌트(스타일 A·상태별 버튼)"
```

---

## Task 5: FE — BStudioShell 결선 (타임워치 장착 + 작업 종료 버튼 제거 + 종료 모달 재구성)

**Files:**
- Modify: `frontend/src/components/b/BStudioShell.tsx`
- Modify(test): `frontend/src/app/(main)/works/[id]/page.test.tsx:188-210`
- Delete: `frontend/src/hooks/useWorkSession.ts`, `frontend/src/hooks/useWorkSession.test.ts`

**Interfaces:**
- Consumes: `useTimewatch`(Task 3), `Timewatch`(Task 4).
- 동작: 우패널/Drawer 최상단에 `Timewatch` 표시. "■ 집필 종료" → 종료 모달(✕·선택 메모·경과시간·`[메모 없이 종료][기록하고 종료]`). 모달 확정 시 `flush → timewatch.stop(memo?) → router.push(backHref)`. 좌패널 "작업 종료" 버튼 제거. 자동 start-on-mount 제거(useTimewatch 는 자동 시작 안 함).

- [ ] **Step 1: import 교체 — useWorkSession → useTimewatch + Timewatch**

`BStudioShell.tsx:14` 의

```tsx
import { useWorkSession } from "@/hooks/useWorkSession";
```

를

```tsx
import { useTimewatch } from "@/hooks/useTimewatch";
import { Timewatch } from "@/components/b/Timewatch";
```

로 교체.

- [ ] **Step 2: 훅 사용 교체**

`BStudioShell.tsx:139` 의

```tsx
    const { endWithLog } = useWorkSession(projectId);
```

를

```tsx
    const timewatch = useTimewatch(projectId);
```

로 교체.

- [ ] **Step 3: `handleEndWork` → `handleStopWork(withMemo)` 교체**

`BStudioShell.tsx:176-194` 의 `handleEndWork` 전체를 아래로 교체:

```tsx
    const handleStopWork = async (withMemo: boolean) => {
        if (isEndingWork) return;
        setIsEndingWork(true);
        setEndWorkError(null);
        try {
            // 미동기화 본문을 서버에 먼저 반영(시리즈 글자수 즉시 동기). best-effort.
            await flushNowRef.current().catch(() => {});
            await timewatch.stop(withMemo ? endWorkBody : undefined);
            setEndWorkOpen(false);
            setEndWorkBody("");
            router.push(backHref);
        } catch {
            setEndWorkError("종료에 실패했습니다. 다시 시도해 주세요.");
        } finally {
            setIsEndingWork(false);
        }
    };
```

> `timewatch.stop` 이 메모 동반 시 `logKeys` 무효화를 이미 수행하므로 여기선 `queryClient.invalidateQueries(logKeys)` 를 제거했다. **Step 9에서 `queryClient`·`logKeys` 잔여 사용 여부를 grep 해 미사용이면 import/선언 제거**(orphan 정리).

- [ ] **Step 4: 좌패널 "작업 종료" 버튼 제거**

`BStudioShell.tsx:356-369` 의 아래 블록(sync 상태 div 다음, outlinePanel 닫기 직전)을 **통째로 삭제**:

```tsx
            <div className="border-t border-gray-200 p-3">
                <button
                    type="button"
                    onClick={() => {
                        setEndWorkBody("");
                        setEndWorkError(null);
                        setEndWorkOpen(true);
                        setLeftDrawerOpen(false);
                    }}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                    작업 종료
                </button>
            </div>
```

- [ ] **Step 5: 넓은 폭 inline 우패널 — Timewatch 카드 상단 결선**

`BStudioShell.tsx:521-532` 의

```tsx
            {/* 넓은 폭 inline 우측 패널 */}
            <div className="hidden min-[880px]:contents">
                <BWorkSidePanel
                    projectId={projectId}
                    isOpen={panelOpen}
                    onOpenChange={setPanelOpen}
                    tab={panelTab}
                    onTabChange={setPanelTab}
                    wordCount={totalWordCount}
                    targetLength={targetLength}
                />
            </div>
```

를 아래로 교체(타이머 카드 + 보조 패널을 세로 스택):

```tsx
            {/* 넓은 폭 inline 우측 영역 — 타임워치 카드 + 보조 패널(분리) */}
            <div className="hidden w-60 shrink-0 flex-col gap-3 min-[880px]:flex">
                <Timewatch
                    status={timewatch.status}
                    elapsedMs={timewatch.elapsedMs}
                    onStart={timewatch.start}
                    onPause={timewatch.pause}
                    onResume={timewatch.resume}
                    onRequestStop={() => {
                        setEndWorkBody("");
                        setEndWorkError(null);
                        setEndWorkOpen(true);
                    }}
                />
                <BWorkSidePanel
                    projectId={projectId}
                    isOpen={panelOpen}
                    onOpenChange={setPanelOpen}
                    tab={panelTab}
                    onTabChange={setPanelTab}
                    wordCount={totalWordCount}
                    targetLength={targetLength}
                />
            </div>
```

> 알려진 v1 미세점(dogfooding 정리 대상): 보조 패널을 접으면(◀▶) w-60 컬럼 안에 8px strip 이 남는다. 기능엔 영향 없음.

- [ ] **Step 6: 좁은 폭 우측 drawer — Timewatch 상단 결선**

`BStudioShell.tsx:463-472` 의 drawer 내용

```tsx
                <div className="flex flex-1 flex-col overflow-hidden">
                    <BWorkSidePanel
                        projectId={projectId}
                        collapsible={false}
                        tab={panelTab}
                        onTabChange={setPanelTab}
                        wordCount={totalWordCount}
                        targetLength={targetLength}
                    />
                </div>
```

를

```tsx
                <div className="flex flex-1 flex-col overflow-hidden">
                    <div className="border-b border-gray-200 bg-gray-50 p-3">
                        <Timewatch
                            status={timewatch.status}
                            elapsedMs={timewatch.elapsedMs}
                            onStart={timewatch.start}
                            onPause={timewatch.pause}
                            onResume={timewatch.resume}
                            onRequestStop={() => {
                                setEndWorkBody("");
                                setEndWorkError(null);
                                setEndWorkOpen(true);
                            }}
                        />
                    </div>
                    <BWorkSidePanel
                        projectId={projectId}
                        collapsible={false}
                        tab={panelTab}
                        onTabChange={setPanelTab}
                        wordCount={totalWordCount}
                        targetLength={targetLength}
                    />
                </div>
```

- [ ] **Step 7: 종료 모달 재구성 (✕ · 선택 메모 · 경과시간 · 2버튼)**

`BStudioShell.tsx:581-633` 의 `{endWorkOpen && (...)}` 모달 전체를 아래로 교체:

```tsx
            {endWorkOpen && (
                <div
                    className="fixed inset-0 z-30 flex items-center justify-center bg-gray-900/40 p-4"
                    onClick={() => !isEndingWork && setEndWorkOpen(false)}
                >
                    <div
                        ref={endWorkModalRef}
                        role="dialog"
                        aria-modal="true"
                        aria-label="집필 종료"
                        onClick={(e) => e.stopPropagation()}
                        className="relative w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-lg"
                    >
                        <button
                            type="button"
                            aria-label="닫기"
                            onClick={() => !isEndingWork && setEndWorkOpen(false)}
                            className="absolute right-3 top-3 rounded-md px-2 py-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        >
                            ✕
                        </button>
                        <h2 className="text-lg font-bold text-gray-900">집필을 마칠까요?</h2>
                        <p className="mt-1 text-sm text-gray-500">
                            측정한 시간 {formatStopwatch(timewatch.elapsedMs)} 가 기록됩니다. 오늘 작업 메모를 남겨도 좋아요(선택).
                        </p>
                        <textarea
                            autoFocus
                            value={endWorkBody}
                            onChange={(e) => setEndWorkBody(e.target.value)}
                            placeholder="예: 3장 도입부 다시 씀 (선택)"
                            rows={4}
                            maxLength={2000}
                            className="mt-3 w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-terracotta-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500 focus-visible:ring-offset-1"
                        />
                        <div className="mt-1 flex items-center justify-between">
                            {endWorkError ? <span className="text-xs text-red-600">{endWorkError}</span> : <span />}
                            <span className="text-xs text-gray-400">{endWorkBody.length}/2000</span>
                        </div>
                        <div className="mt-4 flex gap-2.5">
                            <button
                                type="button"
                                onClick={() => handleStopWork(false)}
                                disabled={isEndingWork}
                                className="flex-1 rounded-md border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                            >
                                메모 없이 종료
                            </button>
                            <button
                                type="button"
                                onClick={() => handleStopWork(true)}
                                disabled={isEndingWork}
                                className="flex-1 rounded-md bg-terracotta-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-terracotta-700 disabled:opacity-50"
                            >
                                기록하고 종료
                            </button>
                        </div>
                    </div>
                </div>
            )}
```

> `formatStopwatch` 를 BStudioShell 상단에 import 추가: `import { formatStopwatch } from "@/lib/formatStopwatch";`

- [ ] **Step 8: useWorkSession 파일 삭제**

```bash
rm frontend/src/hooks/useWorkSession.ts frontend/src/hooks/useWorkSession.test.ts
```

- [ ] **Step 9: orphan 정리 — queryClient/logKeys 미사용 점검**

Run: `cd frontend && grep -n "queryClient\|logKeys" src/components/b/BStudioShell.tsx`
- `queryClient` 가 더 이상 안 쓰이면 `const queryClient = useQueryClient();`(75행)와 `useQueryClient` import(6행) 제거.
- `logKeys` 가 더 이상 안 쓰이면 `import { logKeys } from "@/lib/query/useLogs";`(13행) 제거.

- [ ] **Step 10: works 페이지 라우팅 테스트 갱신**

`frontend/src/app/(main)/works/[id]/page.test.tsx:188-210` 의 describe/it 을 아래로 교체:

```tsx
describe("BWorkDetailPage — 집필 종료 후 라우팅 (404 회귀 방지)", () => {
    it("타임워치 집필 종료 후 /library 로 이동한다 (잘못된 /b/library 404 회귀 방지)", async () => {
        pushMock.mockClear();
        stubCommon();
        server.use(
            http.post(`${ORIGIN}/api/projects/1/work-sessions/start`, () =>
                HttpResponse.json({ success: true, data: { id: 1, projectId: 1, startedAt: new Date().toISOString(), endedAt: null }, error: null }),
            ),
            http.post(`${ORIGIN}/api/projects/1/work-sessions/end`, () =>
                HttpResponse.json({ success: true, data: null, error: null }),
            ),
        );
        renderPage();

        // 타임워치 시작 → 집필 종료 → 메모 없이 종료
        const startBtns = await screen.findAllByRole("button", { name: /시작/ });
        await userEvent.click(startBtns[0]);
        const stopBtns = await screen.findAllByRole("button", { name: /집필 종료/ });
        await userEvent.click(stopBtns[0]);
        await userEvent.click(await screen.findByRole("button", { name: "메모 없이 종료" }));

        await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/library"));
    });
});
```

> `BWorkSidePanel` 은 이 테스트에서 mock 되어 있고(`b-work-side-panel`), `Timewatch` 는 실제 렌더된다. inline+drawer 양쪽 렌더로 버튼이 2개씩 있을 수 있어 `findAllByRole(...)[0]` 사용. `stubCommon`/`renderPage` 는 같은 파일 기존 헬퍼.

- [ ] **Step 11: FE 전체 게이트**

Run: `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: lint 0 errors / typecheck 통과 / 전체 test PASS(신규 포함, useWorkSession 삭제 반영) / build 통과(RSC 경계 — Timewatch·BStudioShell 모두 `"use client"`).

- [ ] **Step 12: 커밋**

```bash
git add -A
git commit -m "feat(timewatch): 집필실에 타임워치 장착 + 자동측정/작업 종료 버튼 제거"
```

---

## Dogfooding 게이트 (병합 전 필수)

로컬 dev(FE `pnpm dev` + BE `bootRun local`) 로그인 후 집필실에서:

- [ ] 우패널 최상단 타이머 카드가 메모/인물 카드와 **분리**되어 보인다.
- [ ] **시작** → 카운트업 시작, 초록 점 "집필 중". **일시정지** → 시간 고정, 다시 시작 시 누적 이어감.
- [ ] **집필 종료** → 모달(경과시간 표시). ✕/바깥/ESC → 닫히고 집필 화면 복귀(타이머 계속). **메모 없이 종료**/**기록하고 종료** → /library 이동.
- [ ] 시작 안 하고 글만 쓰다 나가면 작업 시간 0. **시작 후 멈추지 않고 뒤로가기/새로고침** → 그때까지 시간 기록됨(홈 "오늘 작업시간"·`/기록` 반영 확인).
- [ ] **30초 미만**(시작 후 10초쯤 일시정지/종료)도 기록에 반영(폐기 안 됨).
- [ ] 좌패널 하단 "작업 종료" 버튼이 **사라졌다**.

---

## Self-Review (작성자 점검 완료)

- **Spec 커버리지:** §2 UI→Task 4+5, §3 동작매핑→Task 3, §3-1 30초 제거→Task 1, §3-2 메모 nullable→Task 3 stop()+Task 5 모달, §4 컴포넌트/제거→Task 5, §5 엣지(미시작/이탈/일시정지이탈)→Task 3 + dogfooding. ✓
- **Placeholder:** 없음(모든 step 실제 코드/명령).
- **타입 일관성:** `TimewatchStatus`·`useTimewatch` 반환 시그니처가 Task 3 정의 ↔ Task 4 props ↔ Task 5 사용처 일치. `formatStopwatch(ms)` Task 2 정의 ↔ Task 4/5 사용 일치. `stop(memo?)` Task 3 ↔ Task 5 `handleStopWork` 일치.
