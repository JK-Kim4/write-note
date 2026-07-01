/**
 * webElectronApi.cards (048) — 카드 관리(여러 보드 가로지르는 목록 + 독립 카드). lib/api/cards 어댑터에 위임.
 */
import { createStandaloneCard, deleteCard, editCard, listCards, setCardBoard } from "@/lib/api/cards";
import type { CardItem, CreateStandaloneCardInput, EditCardInput } from "@/lib/api/cards";

export const cards = {
    list: (): Promise<CardItem[]> => listCards(),
    create: (input: CreateStandaloneCardInput): Promise<CardItem> => createStandaloneCard(input),
    edit: (cardId: number, input: EditCardInput): Promise<CardItem> => editCard(cardId, input),
    delete: (cardId: number): Promise<void> => deleteCard(cardId),
    setBoard: (cardId: number, boardId: number | null): Promise<CardItem> => setCardBoard(cardId, boardId),
};
