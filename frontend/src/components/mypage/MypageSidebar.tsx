"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * 마이페이지 좌측 사이드 메뉴 (037).
 *
 * 섹션 링크 + 현재 섹션 활성 강조(usePathname). 회원 탈퇴는 위험 액션이라 맨 아래 분리(빨간 톤).
 * "문의·도움말"은 섹션 페이지 없이 /contact 로 이동. 계정 연결 항목은 R2(US3)에서 추가된다.
 */
type Section = { href: string; label: string; external?: boolean };

const SECTIONS: Section[] = [
    { href: "/mypage/profile", label: "프로필" },
    { href: "/mypage/settings", label: "환경설정" },
    { href: "/mypage/connections", label: "계정 연결" },
    { href: "/contact", label: "문의·도움말", external: true },
];

const ITEM = "block rounded-md px-3 py-2 text-sm transition-colors";
const ACTIVE = `${ITEM} bg-terracotta-50 font-medium text-terracotta-700`;
const IDLE = `${ITEM} text-gray-600 hover:bg-gray-50`;

export function MypageSidebar() {
    const pathname = usePathname();

    return (
        <nav aria-label="마이페이지 메뉴" className="flex flex-col gap-0.5">
            {SECTIONS.map((section) => {
                const active = !section.external && pathname.startsWith(section.href);
                return (
                    <Link key={section.href} href={section.href} className={active ? ACTIVE : IDLE}>
                        {section.label}
                    </Link>
                );
            })}

            <div className="my-2 border-t border-gray-100" />

            <Link
                href="/mypage/withdraw"
                className={
                    pathname.startsWith("/mypage/withdraw")
                        ? `${ITEM} bg-red-50 font-medium text-red-600`
                        : `${ITEM} text-red-500 hover:bg-red-50`
                }
            >
                회원 탈퇴
            </Link>
        </nav>
    );
}
