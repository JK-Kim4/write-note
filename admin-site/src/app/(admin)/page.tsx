"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** 어드민 인덱스 — v1 은 공지 관리로 보낸다(US3 대시보드는 후속). */
export default function AdminHome() {
    const router = useRouter();
    useEffect(() => {
        router.replace("/announcements");
    }, [router]);
    return null;
}
