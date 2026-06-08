/**
 * 클라이언트 뷰 모델 (015 T005) — desktop renderer 가 쓰던 도메인 타입의 web 판본.
 *
 * 데이터는 014 backend 소유. 본 타입은 webElectronApi shim 이 반환하는 화면용 형태다.
 * ID 는 014 가 `number`(BIGSERIAL) — desktop UUID(string) 와 다름.
 */
import type { ProjectResponse, MemoResponse } from "@/types/api";

/** 작품 — 014 ProjectResponse(nextScene 포함). */
export type Project = ProjectResponse;

/** 작품 벽/기록 카드용 — 작품 + 본문에서 파생한 마지막 문장(클라 파생, 014 R6). */
export type ProjectCard = Project & { lastSentenceSource: string };

/** 집필 문서 — DocumentResponse 의 화면용 형태(body=ProseMirror JSON). plainText 는 클라 파생. */
export type ProjectDocument = {
    id: number;
    projectId: number;
    title: string;
    /** ProseMirror JSON 문자열 (DocumentResponse.body). */
    bodyJson: string;
    wordCount: number;
    version: number;
    updatedAt: string;
};

/** 곁쪽지(작품 맥락) — 메모 + 그 작품에서의 고정 여부(014 pinned). */
export type ProjectMemo = MemoResponse & { pinned: boolean };

/** 집필 기록 — 014 ProjectLog. */
export type ProjectLog = {
    id: number;
    projectId: number;
    body: string;
    createdAt: string;
};

/** 작업 세션 — 014 WorkSession. endedAt = null 이면 진행 중. */
export type WorkSession = {
    id: number;
    projectId: number;
    startedAt: string;
    endedAt: string | null;
};

/** 기록 화면 카드 — 작품 + 글자수 + 최신 기록 + 총 작업시간(클라 집계, 014 R6). */
export type LogCard = {
    project: Project;
    wordCount: number;
    lastSentenceSource: string;
    latestLog: ProjectLog | null;
    totalDurationMs: number;
};
