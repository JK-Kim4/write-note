import { ShareLinkManager } from "@/components/share/ShareLinkManager";

/**
 * 마이페이지 공유 관리 섹션 (046 R4) — 공유 링크 생성·끄기·목록·주소 복사 + 받은 피드백.
 * 인증 가드는 상위 (main) 레이아웃의 useAuthGuard 가 자동 상속(037 마이페이지 셸 정합).
 */
export default function SharesPage() {
    return <ShareLinkManager />;
}
