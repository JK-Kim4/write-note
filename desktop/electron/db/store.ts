import type { DatabaseSync } from "node:sqlite";
import { ProjectRepository, type CreateProjectInput } from "./projectRepository";
import { DocumentRepository, type UpdateDocumentInput } from "./documentRepository";
import { MemoRepository } from "./memoRepository";
import { SettingRepository } from "./settingRepository";
import type { Document, Project } from "./types";

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
