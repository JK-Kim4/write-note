import type { ReactNode } from "react";
import { MypageSidebar } from "@/components/mypage/MypageSidebar";

/**
 * 마이페이지 계정 셸 (037) — 좌측 사이드 메뉴 + 우측 섹션 콘텐츠.
 * 인증 가드는 상위 (main) 레이아웃의 useAuthGuard 가 자동 상속하므로 별도 가드 불필요(FR-013).
 */
export default function MypageLayout({ children }: { children: ReactNode }) {
    return (
        <div className="mx-auto max-w-5xl">
            <h1 className="mb-6 text-xl font-bold">마이페이지</h1>
            <div className="flex flex-col gap-6 sm:flex-row">
                <aside className="sm:w-48 sm:shrink-0">
                    <MypageSidebar />
                </aside>
                <div className="min-w-0 flex-1">{children}</div>
            </div>
        </div>
    );
}
