"use client";

import { useState } from "react";
import { FormInput } from "@/components/ui/FormInput";
import { FormTextarea } from "@/components/ui/FormTextarea";
import type { CreateCharacterInput, Gender } from "@/lib/api/characters";
import type { CharacterResponse } from "@/types/api";

/** 성별 드롭다운 옵션 — 빈 값(비움) + 3 코드. value 는 서버 코드, label 은 한글. */
const GENDER_OPTIONS: ReadonlyArray<{ value: "" | Gender; label: string }> = [
    { value: "", label: "선택 안 함" },
    { value: "MALE", label: "남" },
    { value: "FEMALE", label: "여" },
    { value: "OTHER", label: "기타" },
];

/**
 * CharacterForm — 등장인물 생성·편집 공용 폼 (US4).
 *
 * `initial` 이 있으면 편집(기존값 초기화), 없으면 생성. 부모가 key 로 remount 하여 초기값을 반영.
 * name 필수(클라이언트 최소 검증 — 서버가 SoT).
 */

interface CharacterFormProps {
    initial: CharacterResponse | null;
    onSubmit: (input: CreateCharacterInput) => void;
    onCancel: () => void;
    pending: boolean;
    error: string | null;
}

export function CharacterForm({ initial, onSubmit, onCancel, pending, error }: CharacterFormProps) {
    const [name, setName] = useState(initial?.name ?? "");
    const [shortDescription, setShortDescription] = useState(initial?.shortDescription ?? "");
    const [notes, setNotes] = useState(initial?.notes ?? "");
    const [age, setAge] = useState(initial?.age ?? "");
    const [gender, setGender] = useState<"" | Gender>(initial?.gender ?? "");
    const [traits, setTraits] = useState(initial?.traits ?? "");
    const [nameError, setNameError] = useState<string | null>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            setNameError("이름을 입력해주세요.");
            return;
        }
        setNameError(null);
        onSubmit({
            name: name.trim(),
            shortDescription: shortDescription.trim() || null,
            notes: notes.trim() || null,
            age: age.trim() || null,
            gender: gender || null,
            traits: traits.trim() || null,
        });
    };

    return (
        <form
            className="flex flex-col gap-4 p-5 rounded-card-project"
            style={{
                backgroundColor: "var(--w-canvas)",
                border: "1px solid var(--w-hairline)",
                opacity: pending ? 0.6 : 1,
                pointerEvents: pending ? "none" : "auto",
            }}
            onSubmit={handleSubmit}
        >
            <h2 className="font-display font-semibold" style={{ fontSize: "17px", color: "var(--w-ink)" }}>
                {initial ? "등장인물 편집" : "새 등장인물"}
            </h2>
            <FormInput
                name="name"
                label="이름 *"
                value={name}
                error={nameError !== null}
                onChange={(e) => setName(e.target.value)}
            />
            {nameError ? (
                <p role="alert" style={{ color: "var(--w-error)", fontSize: "14px", marginTop: "-8px" }}>
                    {nameError}
                </p>
            ) : null}
            <FormInput
                name="shortDescription"
                label="한 줄 설명"
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
            />
            <FormInput name="age" label="나이" value={age} onChange={(e) => setAge(e.target.value)} />
            <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium" style={{ color: "var(--w-ink)" }}>
                    성별
                </span>
                <select
                    name="gender"
                    value={gender}
                    onChange={(e) => setGender(e.target.value as "" | Gender)}
                    className="px-3 py-2 rounded-input"
                    style={{
                        backgroundColor: "var(--w-canvas)",
                        border: "1px solid var(--w-hairline)",
                        color: "var(--w-ink)",
                        fontSize: "15px",
                    }}
                >
                    {GENDER_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
            </label>
            <FormTextarea name="traits" label="특징" value={traits} onChange={setTraits} />
            <FormTextarea name="notes" label="노트" value={notes} onChange={setNotes} />
            {error ? (
                <p role="alert" style={{ color: "var(--w-error)", fontSize: "14px" }}>
                    {error}
                </p>
            ) : null}
            <div className="flex items-center justify-end gap-3">
                {initial ? (
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 rounded-button-pill font-semibold"
                        style={{
                            backgroundColor: "var(--w-canvas)",
                            color: "var(--w-ink)",
                            border: "1px solid var(--w-hairline)",
                        }}
                    >
                        취소
                    </button>
                ) : null}
                <button
                    type="submit"
                    className="px-5 py-2 rounded-button-pill font-semibold"
                    style={{ backgroundColor: "var(--w-accent)", color: "var(--w-canvas)" }}
                >
                    {initial ? "저장" : "추가"}
                </button>
            </div>
        </form>
    );
}
