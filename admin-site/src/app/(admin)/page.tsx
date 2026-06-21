"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** 어드민 인덱스 — 대시보드(사용 현황)로 보낸다. */
export default function AdminHome() {
    const router = useRouter();
    useEffect(() => {
        router.replace("/dashboard");
    }, [router]);
    return null;
}
