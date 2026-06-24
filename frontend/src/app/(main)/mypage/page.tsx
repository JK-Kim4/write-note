import { redirect } from "next/navigation";

/**
 * /mypage 진입 시 기본 섹션(프로필)으로 안내 (037, FR-002).
 */
export default function MyPageIndex() {
    redirect("/mypage/profile");
}
