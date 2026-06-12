import { genderLabel } from "@/lib/api/characters";
import type { CharacterResponse } from "@/types/api";

/**
 * CharacterList — 등장인물 표시 (US4, FR-022). 서버 displayOrder 순서 그대로 렌더.
 *
 * 표시 전용 — 순서 이동/편집/삭제는 부모(page)가 콜백으로 처리.
 */

interface CharacterListProps {
    characters: CharacterResponse[];
    onMoveUp: (index: number) => void;
    onMoveDown: (index: number) => void;
    onEdit: (character: CharacterResponse) => void;
    onDelete: (id: number) => void;
}

export function CharacterList({ characters, onMoveUp, onMoveDown, onEdit, onDelete }: CharacterListProps) {
    return (
        <ul className="flex flex-col gap-3">
            {characters.map((character, index) => (
                <li
                    key={character.id}
                    className="flex items-start gap-3 p-4 rounded-card-project"
                    style={{ backgroundColor: "var(--w-canvas)", border: "1px solid var(--w-hairline)" }}
                >
                    <div className="flex flex-col gap-1">
                        <button
                            type="button"
                            aria-label="위로"
                            disabled={index === 0}
                            onClick={() => onMoveUp(index)}
                            style={{ color: "var(--w-ink)", opacity: index === 0 ? 0.25 : 0.7, fontSize: "14px" }}
                        >
                            ▲
                        </button>
                        <button
                            type="button"
                            aria-label="아래로"
                            disabled={index === characters.length - 1}
                            onClick={() => onMoveDown(index)}
                            style={{
                                color: "var(--w-ink)",
                                opacity: index === characters.length - 1 ? 0.25 : 0.7,
                                fontSize: "14px",
                            }}
                        >
                            ▼
                        </button>
                    </div>
                    <div className="flex-1 flex flex-col gap-1">
                        <span className="font-semibold" style={{ color: "var(--w-ink)", fontSize: "15px" }}>
                            {character.name}
                        </span>
                        {character.shortDescription ? (
                            <span style={{ color: "var(--w-ink)", opacity: 0.7, fontSize: "14px" }}>
                                {character.shortDescription}
                            </span>
                        ) : null}
                        {character.age || genderLabel(character.gender) ? (
                            <span style={{ color: "var(--w-ink)", opacity: 0.6, fontSize: "13px" }}>
                                {[genderLabel(character.gender), character.age].filter(Boolean).join(" · ")}
                            </span>
                        ) : null}
                        {character.traits ? (
                            <span style={{ color: "var(--w-ink)", opacity: 0.7, fontSize: "13px" }}>
                                {character.traits}
                            </span>
                        ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => onEdit(character)}
                            className="px-3 py-1.5 rounded-button-utility text-sm font-semibold"
                            style={{ color: "var(--w-accent)" }}
                        >
                            편집
                        </button>
                        <button
                            type="button"
                            onClick={() => onDelete(character.id)}
                            className="px-3 py-1.5 rounded-button-utility text-sm font-semibold"
                            style={{ color: "var(--w-error)" }}
                        >
                            삭제
                        </button>
                    </div>
                </li>
            ))}
        </ul>
    );
}
