import { Suspense } from "react";
import { ResetNewForm } from "@/components/auth/ResetNewForm";

export default function ResetNewPage() {
    return (
        <Suspense fallback={<p style={{ color: "var(--w-ink)", opacity: 0.6 }}>확인 중…</p>}>
            <ResetNewForm />
        </Suspense>
    );
}
