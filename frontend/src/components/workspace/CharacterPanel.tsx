"use client";

import { useState } from "react";
import Link from "next/link";
import { genderLabel } from "@/lib/api/characters";
import { useCreateCharacter, useProjectCharacters } from "@/lib/query/useCharacters";

type CharacterPanelProps = {
    projectId: number;
};

/**
 * 인물 노트 패널(우 상단) (017 US2) — 기존 등장인물 보기 + 빠른 추가.
 * 상세 수정·삭제·재정렬은 /projects/[id]/characters 로 링크(중복 구현 회피).
 */
export function CharacterPanel({ projectId }: CharacterPanelProps) {
    const { data: characters, isLoading } = useProjectCharacters(projectId);
    const createCharacter = useCreateCharacter();
    const [expanded, setExpanded] = useState<number | null>(null);
    const [name, setName] = useState("");
    const [error, setError] = useState<string | null>(null);

    const list = characters ?? [];
    const trimmed = name.trim();

    const handleAdd = async () => {
        if (!trimmed || createCharacter.isPending) return;
        setError(null);
        try {
            await createCharacter.mutateAsync({ projectId, input: { name: trimmed } });
            setName(""); // 성공 시에만 초기화 — 실패 시 입력 보존
        } catch {
            setError("추가에 실패했어요. 다시 시도해 주세요.");
        }
    };

    return (
        <section className="character-panel" aria-label="인물 노트">
            <div className="panel__head panel__head--row">
                <Link className="character-panel__manage" href={`/projects/${projectId}/characters`}>
                    등장인물 관리
                </Link>
            </div>

            {isLoading ? (
                <p className="panel__sub">불러오는 중…</p>
            ) : list.length === 0 ? (
                <p className="panel__empty">곁에 둘 인물을 추가.</p>
            ) : (
                <ul className="character-panel__list">
                    {list.map((c) => {
                        const open = expanded === c.id;
                        return (
                            <li key={c.id} className="character-card">
                                <button
                                    type="button"
                                    className="character-card__head"
                                    aria-expanded={open}
                                    aria-label={`${c.name} 상세`}
                                    onClick={() => setExpanded(open ? null : c.id)}
                                >
                                    <span className="character-card__name">{c.name}</span>
                                    {c.shortDescription ? (
                                        <span className="character-card__desc">{c.shortDescription}</span>
                                    ) : null}
                                </button>
                                {open && (c.age || genderLabel(c.gender)) ? (
                                    <p className="character-card__meta">
                                        {[genderLabel(c.gender), c.age].filter(Boolean).join(" · ")}
                                    </p>
                                ) : null}
                                {open && c.traits ? <p className="character-card__notes">{c.traits}</p> : null}
                                {open && c.notes ? <p className="character-card__notes">{c.notes}</p> : null}
                            </li>
                        );
                    })}
                </ul>
            )}

            <form
                className="character-panel__add"
                onSubmit={(e) => {
                    e.preventDefault();
                    void handleAdd();
                }}
            >
                <input
                    type="text"
                    className="character-panel__input"
                    aria-label="인물 이름"
                    placeholder="이름으로 곁에 두기"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
                <button type="submit" className="btn btn--secondary btn--compact" disabled={!trimmed || createCharacter.isPending}>
                    추가
                </button>
            </form>
            {error ? (
                <p className="character-panel__error" role="alert">
                    {error}
                </p>
            ) : null}
        </section>
    );
}
