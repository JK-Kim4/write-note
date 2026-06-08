/**
 * 클라이언트 뷰 모델 (015 T005) — desktop renderer 가 쓰던 도메인 타입의 web 판본.
 *
 * 데이터는 014 backend 소유. 본 타입은 webElectronApi shim 이 반환하는 화면용 형태다.
 * ID 는 014 가 `number`(BIGSERIAL) — desktop UUID(string) 와 다름.
 */
import type { ProjectResponse } from "@/types/api";

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

/** 메모에 연결된 작품(제목 포함) — 책상 칩·붙이기 팝오버 표시용(desktop LinkedProject). */
export type LinkedProject = { id: number; title: string };

/** 곁쪽지(전역) — 본문 + 연결 작품(다대다). 책상(메모 인박스)이 소비. desktop Memo 의 web 판본. */
export type Memo = {
    id: number;
    body: string;
    source: string;
    capturedAt: string;
    /** 연결된 작품(제목 포함). 미연결이면 빈 배열. MemoResponse.projects 매핑. */
    linkedProjects: LinkedProject[];
};

/** 곁쪽지(작품 맥락) — 그 작품에서의 고정 여부 포함(014 ProjectMemoResponse, memoId→id). */
export type ProjectMemo = {
    id: number;
    projectId: number;
    body: string;
    source: string;
    capturedAt: string;
    pinned: boolean;
};

/** 책상·서랍 표시용 메모 뷰 — 상대 날짜 라벨 + 연결 작품. pinned 는 작품 맥락(서랍) 전용. */
export type InboxMemo = {
    id: number;
    body: string;
    /** capturedAt → "오늘/어제/N일 전/N주 전" 상대 라벨. */
    dateLabel: string;
    /** 연결된 작품(제목). 서랍 뷰에선 빈 배열. */
    linkedProjects: LinkedProject[];
    /** 현재 작품 맥락의 곁쪽지 고정 여부(서랍 전용). 책상 뷰에선 undefined. */
    pinned?: boolean;
};

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
