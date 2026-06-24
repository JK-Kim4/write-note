import Link from "next/link";

/**
 * 마이페이지의 알 수 없는 섹션 접근 시 기본 안내 (037, FR-015).
 * mypage 레이아웃(사이드 메뉴) 안에서 렌더되어 사용자가 다른 섹션으로 이동할 수 있다.
 */
export default function MypageNotFound() {
    return (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-sm text-gray-500">존재하지 않는 섹션입니다.</p>
            <Link
                href="/mypage/profile"
                className="mt-2 inline-block rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
                프로필로 이동
            </Link>
        </div>
    );
}
