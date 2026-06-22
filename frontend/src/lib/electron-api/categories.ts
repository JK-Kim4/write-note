/**
 * webElectronApi.categories (032) — 모음 CRUD + 작품 이동.
 * lib/api/categories 어댑터를 그대로 위임(응답은 CategoryResponse 평면 — 별도 뷰 모델 불필요).
 */
import {
    createCategory,
    deleteCategory,
    listCategories,
    moveProjectCategory,
    updateCategory,
} from "@/lib/api/categories";
import type { CreateCategoryInput, UpdateCategoryInput } from "@/lib/api/categories";
import type { CategoryResponse } from "@/types/api";

export const categories = {
    list: (): Promise<CategoryResponse[]> => listCategories(),
    create: (input: CreateCategoryInput): Promise<CategoryResponse> => createCategory(input),
    update: (id: number, input: UpdateCategoryInput): Promise<CategoryResponse> => updateCategory(id, input),
    delete: async (id: number): Promise<boolean> => {
        await deleteCategory(id);
        return true;
    },
    /** 작품을 모음으로 이동 — categoryId null = 미분류. */
    moveProject: (projectId: number, categoryId: number | null): Promise<void> =>
        moveProjectCategory(projectId, categoryId).then(() => undefined),
};
