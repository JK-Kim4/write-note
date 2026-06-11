"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { saveDocument } from "@/lib/api/document";
import { ConflictError } from "@/lib/api/client";
import { clearDraft, readDraft, writeDraft } from "@/lib/draftStore";
import type { DocumentSaveResponse } from "@/types/api";

/**
 * 편집 세션 진실원 (016 — useAutoSave 대체).
 *
 * **localStorage-first**: 작성한 내용은 타자 즉시 localStorage draft 에 보존되고,
 * 진입 시 그 draft 를 에디터에 **자동 복원**한다(서버 동기화·배너·대기 없이). 서버 동기화(PUT)는
 * 백그라운드 전용이며 **절대 최신 로컬 draft 를 stale 본문으로 덮어쓰지 않는다**.
 *
 * 거짓 409 충돌 제거:
 * - 진입 시 서버 문서를 1회 로드, version 토큰은 **세션이 단독 소유**(저장 응답으로만 전진, 편집 중 서버 재조회 무시).
 * - 동기화 시점 = "멈춤 debounceMs 또는 마지막 동기화 후 maxIntervalMs(먼저 도래)".
 * - in-flight 가드: 저장 중 추가 편집은 큐잉했다가 완료 후 dirty 면 1회 더 저장.
 *
 * SoT: specs/016-autosave-localstorage-redesign/{data-model.md, research.md}
 */

export type SyncStatus = "idle" | "syncing" | "synced" | "error" | "conflict";

export interface UseDocumentSessionParams {
    documentId: number;
    projectId: number;
    /** 진입 시 1회 로드한 서버 본문. */
    serverBody: string;
    /** 진입 시 1회 로드한 서버 version 토큰(이후 세션이 단독 소유). */
    serverVersion: string;
    /** 현재 에디터 본문(페이지 소유, 타자마다 갱신). */
    body: string;
    /** 저장 성공 시 호출 — 부모가 서버 캐시(version/wordCount/body)를 갱신. */
    onSaved?: (result: DocumentSaveResponse) => void;
}

export interface UseDocumentSessionResult {
    /** 세션이 단독 소유하는 version 토큰(저장 응답으로만 전진). */
    version: string;
    syncStatus: SyncStatus;
    wordCount: number;
    /**
     * 진입 시 자동 복원할 본문 — 미동기화 draft(baseVersion 일치, 서버 본문과 다름)가 있으면 그 본문, 없으면 null.
     * 호출자는 이 값을 에디터 초기 본문으로 사용한다(배너·대기 없이 즉시 복원).
     */
    restoredBody: string | null;
    /** 진짜 충돌(409) 데이터(US3). 자동 덮어쓰기 금지 — 사용자 선택 대기. 없으면 null. */
    conflict: { currentVersion: string; currentBody: string } | null;
    /** 덮어쓰기 — 서버 최신 토큰(currentVersion)으로 현재 본문 강제 재저장. */
    overwrite: (currentVersion: string) => void;
    /** 충돌 해제 — conflict 상태만 해제(호출자가 본문을 서버 최신으로 교체). */
    dismissConflict: () => void;
    /**
     * "서버 최신본 불러오기" — 서버 토큰·본문을 세션 baseline 으로 채택하고 stale draft 를 정리한다.
     * dismissConflict 와 달리 versionRef 까지 전진시킨다 — 미채택 시 다음 저장이 옛 토큰으로 나가
     * 409 가 즉시 재발(불러오기→충돌 무한 루프). 호출자는 에디터 본문을 currentBody 로 교체할 것.
     */
    reloadFromServer: (currentVersion: string, currentBody: string) => void;
    /**
     * 본문을 localStorage draft 에 **즉시 동기 기록**(re-render·setState 없음).
     * IME 조합 중(onChange 차단 구간)에도, 언마운트 직전에도 작성분을 보존하기 위한 통로.
     */
    flushDraft: (body: string) => void;
}

export interface DocumentSessionTiming {
    /** 타자 멈춤 후 동기화까지 지연(ms). */
    debounceMs: number;
    /** 마지막 동기화 후 강제 동기화 상한(ms). */
    maxIntervalMs: number;
}

const DEFAULT_TIMING: DocumentSessionTiming = { debounceMs: 1500, maxIntervalMs: 10000 };

export function useDocumentSession(
    { documentId, projectId, serverBody, serverVersion, body, onSaved }: UseDocumentSessionParams,
    timing: DocumentSessionTiming = DEFAULT_TIMING,
): UseDocumentSessionResult {
    const { debounceMs, maxIntervalMs } = timing;

    const [version, setVersion] = useState(serverVersion);
    const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
    const [wordCount, setWordCount] = useState(0);
    const [conflict, setConflict] = useState<{ currentVersion: string; currentBody: string } | null>(null);

    // localStorage-first 자동 복원 — 진입 시 draft 를 동기 읽어 복원 본문을 결정(에디터 마운트 시점에 즉시 사용 가능).
    // dirty draft 이고 baseVersion 이 현재 서버 토큰과 같고 서버 본문과 다르면 그 본문이 "복원 대상".
    const restoredBody = useMemo(() => {
        if (!Number.isFinite(documentId) || documentId <= 0) return null;
        const draft = readDraft(documentId);
        if (draft && draft.dirty && draft.baseVersion === serverVersion && draft.body !== serverBody) {
            return draft.body;
        }
        return null;
    }, [documentId, serverVersion, serverBody]);

    // 세션 진실원 — version 토큰은 ref 가 권위(저장 응답으로만 전진).
    const initRef = useRef(false);
    const versionRef = useRef(serverVersion);
    // 마지막으로 서버에 동기화된 본문(= baseline). 현재 body 와 다르면 dirty.
    const baselineBodyRef = useRef(serverBody);
    const latestBodyRef = useRef(serverBody);

    // 저장 직렬화 / 하이브리드 타이머 / 충돌 차단.
    const isSavingRef = useRef(false);
    const conflictRef = useRef(false);
    const lastSyncAtRef = useRef(0);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const onSavedRef = useRef(onSaved);
    useEffect(() => {
        onSavedRef.current = onSaved;
    });

    // 진입 1회 초기화 — 문서가 로드되면 세션 토큰/baseline 을 서버 값으로 고정.
    // draft 복원은 restoredBody(동기 계산)가 담당하므로 여기서 draft 를 건드리지 않는다(로컬 보존).
    useEffect(() => {
        if (initRef.current) return;
        if (!Number.isFinite(documentId) || documentId <= 0) return;
        initRef.current = true;
        versionRef.current = serverVersion;
        baselineBodyRef.current = serverBody;
        latestBodyRef.current = serverBody;
        lastSyncAtRef.current = Date.now();
        // 진입 1회 — 세션 표시용 version state 를 로드된 서버 토큰으로 동기(initRef 가드로 1회만, 캐스케이드 없음).
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setVersion(serverVersion);
    }, [documentId, serverVersion, serverBody]);

    // 실제 저장 실행 — version 은 항상 세션 소유 토큰(versionRef)으로 보낸다.
    // latest-ref 패턴: 매 렌더의 최신 클로저를 ref 에 보관해 타이머/큐잉 콜백이 stale 값을 안 잡게 한다(onSavedRef 와 동일 패턴).
    const runSync = useRef<() => void>(() => {});
    // eslint-disable-next-line react-hooks/refs
    runSync.current = () => {
        if (conflictRef.current) return;
        // dirty 아님(현재 본문 = 마지막 동기화 본문)이면 저장 불필요.
        if (latestBodyRef.current === baselineBodyRef.current) return;
        // 저장 중이면 큐잉 — 완료 후 finally 에서 dirty 재확인해 재실행.
        if (isSavingRef.current) return;

        isSavingRef.current = true;
        lastSyncAtRef.current = Date.now();
        const bodyToSave = latestBodyRef.current;
        const versionToSave = versionRef.current;
        setSyncStatus("syncing");

        saveDocument(documentId, { body: bodyToSave, version: versionToSave })
            .then((res) => {
                versionRef.current = res.version;
                baselineBodyRef.current = bodyToSave;
                setVersion(res.version);
                setWordCount(res.wordCount);
                setSyncStatus("synced");
                // no-clobber: 동기화 중 추가 입력이 없었으면 서버가 최신 → 로컬 draft 정리.
                // 추가 입력이 있었으면(latest != bodyToSave) 최신 로컬을 dirty 로 유지(절대 stale 본문으로 덮지 않음).
                if (latestBodyRef.current === bodyToSave) {
                    clearDraft(documentId);
                } else {
                    writeDraft({
                        documentId,
                        projectId,
                        body: latestBodyRef.current,
                        baseVersion: res.version,
                        dirty: true,
                        updatedAt: Date.now(),
                    });
                }
                onSavedRef.current?.(res);
            })
            .catch((err: unknown) => {
                if (err instanceof ConflictError) {
                    // 자동 덮어쓰기 금지 — 충돌 차단 + 데이터 노출(US3). 미동기화 draft 는 보존(삭제 안 함).
                    conflictRef.current = true;
                    setConflict({ currentVersion: err.currentVersion, currentBody: err.currentBody });
                    setSyncStatus("conflict");
                } else {
                    setSyncStatus("error");
                }
            })
            .finally(() => {
                isSavingRef.current = false;
                // in-flight 중 들어온 편집(큐잉분) — dirty 면 즉시 1회 더 저장.
                if (!conflictRef.current && latestBodyRef.current !== baselineBodyRef.current) {
                    runSync.current();
                }
            });
    };

    // 타자 → draft 즉시 기록(localStorage-first) + 하이브리드 동기화 스케줄.
    useEffect(() => {
        if (!initRef.current) return;
        latestBodyRef.current = body;
        if (body === baselineBodyRef.current) return; // dirty 아님
        if (conflictRef.current) return;

        writeDraft({
            documentId,
            projectId,
            body,
            baseVersion: versionRef.current,
            dirty: true,
            updatedAt: Date.now(),
        });

        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        // 멈춤(debounceMs)과 상한(마지막 동기화 후 maxIntervalMs) 중 먼저 도래하는 시점.
        const capRemaining = lastSyncAtRef.current + maxIntervalMs - Date.now();
        const delay = Math.max(0, Math.min(debounceMs, capRemaining));
        debounceTimerRef.current = setTimeout(() => runSync.current(), delay);
    }, [body, documentId, projectId, debounceMs, maxIntervalMs]);

    useEffect(
        () => () => {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        },
        [],
    );

    // 탭 닫기·새로고침 시 미동기화분 best-effort flush — keepalive 로 언로드 후에도 전송.
    // (실패해도 draft 는 dirty 로 남아 다음 진입 시 자동 복원되므로 작성분은 유실되지 않는다.)
    useEffect(() => {
        if (typeof window === "undefined") return;
        const handlePagehide = () => {
            if (conflictRef.current) return;
            if (latestBodyRef.current === baselineBodyRef.current) return; // dirty 아님
            try {
                fetch(`/api/documents/${documentId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ body: latestBodyRef.current, version: versionRef.current }),
                    credentials: "include",
                    keepalive: true,
                });
            } catch {
                // best-effort.
            }
        };
        window.addEventListener("pagehide", handlePagehide);
        return () => window.removeEventListener("pagehide", handlePagehide);
    }, [documentId]);

    // 덮어쓰기 — 서버 최신 토큰을 세션 토큰으로 채택하고 현재 본문을 강제 재저장(US3).
    const overwrite = (currentVersion: string) => {
        versionRef.current = currentVersion;
        conflictRef.current = false;
        setConflict(null);
        runSync.current();
    };
    // 충돌 해제 — 상태만 해제(호출자가 본문을 서버 최신으로 교체 후 호출).
    const dismissConflict = () => {
        conflictRef.current = false;
        setConflict(null);
        setSyncStatus("idle");
    };

    // 서버 최신본 채택 — 토큰·baseline 을 서버 값으로 전진시키고 내 작성분 draft 를 버린다(US3 불러오기).
    const reloadFromServer = (currentVersion: string, currentBody: string) => {
        versionRef.current = currentVersion;
        baselineBodyRef.current = currentBody;
        latestBodyRef.current = currentBody;
        conflictRef.current = false;
        // 옛 토큰 기반 dirty draft 정리 — 방치 시 재진입 복원·재동기화가 버린 본문을 되살릴 위험.
        clearDraft(documentId);
        setConflict(null);
        setVersion(currentVersion);
        setSyncStatus("idle");
    };

    // localStorage draft 즉시 기록(동기, re-render 없음) — IME 조합 중·언마운트 직전 작성분 보존.
    // setState 를 하지 않으므로 조합(composition)을 깨지 않는다. latestBodyRef 도 갱신해 다음 동기화에 반영.
    const flushDraft = (nextBody: string) => {
        if (!initRef.current || conflictRef.current) return;
        latestBodyRef.current = nextBody;
        if (nextBody === baselineBodyRef.current) return; // dirty 아님
        writeDraft({
            documentId,
            projectId,
            body: nextBody,
            baseVersion: versionRef.current,
            dirty: true,
            updatedAt: Date.now(),
        });
    };

    return { version, syncStatus, wordCount, restoredBody, conflict, overwrite, dismissConflict, reloadFromServer, flushDraft };
}
