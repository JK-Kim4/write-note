import type { DatabaseSync } from "node:sqlite";
import { ProjectRepository, type CreateProjectInput } from "./projectRepository";
import { DocumentRepository, type UpdateDocumentInput } from "./documentRepository";
import { MemoRepository } from "./memoRepository";
import { SettingRepository } from "./settingRepository";
import type { Document, Memo, Project, ProjectCard } from "./types";

export type CaptureMemoInput = {
  body: string;
  source?: string;
  /** 있으면 캡처와 동시에 그 작품에 연결(active 작품 자동연결). 없으면 미연결. */
  linkProjectId?: string | null;
};

/** repository 들을 묶고 여러 테이블에 걸친 use-case 를 제공하는 진입점. */
export class Store {
  readonly projects: ProjectRepository;
  readonly documents: DocumentRepository;
  readonly memos: MemoRepository;
  readonly settings: SettingRepository;

  constructor(private readonly db: DatabaseSync) {
    this.projects = new ProjectRepository(db);
    this.documents = new DocumentRepository(db);
    this.memos = new MemoRepository(db);
    this.settings = new SettingRepository(db);
  }

  /** project 와 기본 document 를 한 트랜잭션으로 생성한다(완료기준: project 생성 시 document 자동 생성). */
  createProjectWithDocument(input: CreateProjectInput): { project: Project; document: Document } {
    this.db.exec("BEGIN");
    try {
      const project = this.projects.create(input);
      const document = this.documents.create({ projectId: project.id });
      this.db.exec("COMMIT");
      return { project, document };
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  /** 메모를 생성하고, linkProjectId 가 있으면 그 작품 연결을 한 트랜잭션으로 만든다(부분 실패 방지). */
  captureMemo(input: CaptureMemoInput): Memo {
    this.db.exec("BEGIN");
    try {
      const memo = this.memos.create({ body: input.body, source: input.source });
      if (input.linkProjectId) {
        this.memos.addLink(memo.id, input.linkProjectId);
      }
      this.db.exec("COMMIT");
      return { ...memo, linkedProjectIds: input.linkProjectId ? [input.linkProjectId] : [] };
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  /**
   * 재진입 한 장 — 그 작품에서 곁에 둘 메모 1개를 우선순위대로 고른다(없으면 null).
   * 우선순위는 memoRepository.pickReentry 참조(pinned → 연결 최신 → captured_at 최신).
   */
  pickReentryMemo(projectId: string): Memo | null {
    return this.memos.pickReentry(projectId);
  }

  /** 작품 벽 카드 — 각 작품에 그 본문 plainText(마지막 문장 파생 소스)를 실어 반환한다. */
  listProjectCards(): ProjectCard[] {
    return this.projects.list().map((p) => ({
      ...p,
      lastSentenceSource: this.documents.getByProjectId(p.id)?.plainText ?? "",
    }));
  }

  /** document 본문을 저장하고, 소속 project 의 updated_at 을 한 트랜잭션으로 touch 한다. */
  updateDocument(id: string, patch: UpdateDocumentInput): Document | null {
    this.db.exec("BEGIN");
    try {
      const document = this.documents.update(id, patch);
      if (document) this.projects.touch(document.projectId);
      this.db.exec("COMMIT");
      return document;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
}
