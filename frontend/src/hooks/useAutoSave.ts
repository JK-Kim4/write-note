"use client";

import { useState, useEffect, useRef } from "react";
import { saveDocument } from "@/lib/api/document";
import { ConflictError } from "@/lib/api/client";

/**
 * 자동저장 hook (006 T016 / T008).
 *
 * - body 변경 후 debounceMs(기본 800ms) → PUT /api/documents/{id}
 * - 저장 성공 시 syncedVersion, wordCount 업데이트
 * - 409 충돌 시 status='conflict' + conflict 데이터 노출 (자동 덮어쓰기 금지)
 * - conflict 상태에서는 debounce 트리거 차단
 *
 * debounceMs 는 테스트 주입용 파라미터 — 프로덕션에서는 기본값(800) 사용.
 */

export type AutoSaveStatus = "idle" | "saving" | "saved" | "error" | "conflict";

export interface ConflictData {
    currentVersion: number;
    currentBody: string;
}

interface UseAutoSaveParams {
    documentId: number;
    body: string;
    version: number;
}

interface UseAutoSaveResult {
    status: AutoSaveStatus;
    syncedVersion: number;
    wordCount: number;
    conflict: ConflictData | null;
    /** 덮어쓰기: currentVersion 으로 재저장 후 conflict 해제 */
    overwrite: (currentVersion: number) => void;
    /** 다시 불러오기: conflict 해제 (부모가 body 를 currentBody 로 교체) */
    dismissConflict: () => void;
}

const DEFAULT_DEBOUNCE_MS = 800;

export function useAutoSave(
    { documentId, body, version }: UseAutoSaveParams,
    debounceMs = DEFAULT_DEBOUNCE_MS,
): UseAutoSaveResult {
    const [status, setStatus] = useState<AutoSaveStatus>("idle");
    const [syncedVersion, setSyncedVersion] = useState(version);
    const [wordCount, setWordCount] = useState(0);
    const [conflict, setConflict] = useState<ConflictData | null>(null);

    // conflict 중 debounce 차단 / 최신 syncedVersion 참조용 ref
    const conflictRef = useRef(false);
    const syncedVersionRef = useRef(syncedVersion);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // syncedVersion state 변경 시 ref 도 동기화
    useEffect(() => {
        syncedVersionRef.current = syncedVersion;
    }, [syncedVersion]);

    // version prop 변경 시 syncedVersion 동기화 (외부에서 문서를 다시 로드한 경우).
    // **전진만 허용** — 서버 문서 버전은 단조 증가하므로, 현재 syncedVersion 보다 낮은 version 은 항상 stale 이다.
    // (편집 중 끼어든 background refetch 가 최근 저장 직전 버전을 돌려줄 때 syncedVersion 을 되돌리면,
    //  다음 저장이 stale version 으로 나가 거짓 409 충돌을 내고 conflictRef 로 이후 저장이 전부 막힌다.)
    // conflict 해제(reload/overwrite)는 항상 더 높은 서버 버전으로 가므로 전진 가드와 무관하다.
    const prevVersionRef = useRef(version);
    useEffect(() => {
        if (version !== prevVersionRef.current) {
            prevVersionRef.current = version;
            if (version > syncedVersionRef.current) {
                setSyncedVersion(version);
                syncedVersionRef.current = version;
            }
        }
    }, [version]);

    useEffect(() => {
        // conflict 중에는 debounce 트리거 차단
        if (conflictRef.current) {
            return;
        }
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
        timerRef.current = setTimeout(() => {
            if (conflictRef.current) {
                return;
            }
            setStatus("saving");
            saveDocument(documentId, { body, version: syncedVersionRef.current })
                .then((res) => {
                    setSyncedVersion(res.version);
                    syncedVersionRef.current = res.version;
                    setWordCount(res.wordCount);
                    setStatus("saved");
                })
                .catch((err: unknown) => {
                    if (err instanceof ConflictError) {
                        conflictRef.current = true;
                        setConflict({ currentVersion: err.currentVersion, currentBody: err.currentBody });
                        setStatus("conflict");
                    } else {
                        setStatus("error");
                    }
                });
        }, debounceMs);

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [body, documentId, debounceMs]);

    const overwrite = (currentVersion: number) => {
        conflictRef.current = false;
        setConflict(null);
        setStatus("saving");
        saveDocument(documentId, { body, version: currentVersion })
            .then((res) => {
                setSyncedVersion(res.version);
                syncedVersionRef.current = res.version;
                setWordCount(res.wordCount);
                setStatus("saved");
            })
            .catch((err: unknown) => {
                if (err instanceof ConflictError) {
                    conflictRef.current = true;
                    setConflict({ currentVersion: err.currentVersion, currentBody: err.currentBody });
                    setStatus("conflict");
                } else {
                    setStatus("error");
                }
            });
    };

    const dismissConflict = () => {
        conflictRef.current = false;
        setConflict(null);
        setStatus("idle");
    };

    return { status, syncedVersion, wordCount, conflict, overwrite, dismissConflict };
}
