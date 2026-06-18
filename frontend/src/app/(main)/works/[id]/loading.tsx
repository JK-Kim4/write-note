import { StudioSkeleton } from "@/components/b/StudioSkeleton";

/**
 * 집필 라우트 전환 시 즉시 표시되는 pending UI (Suspense 경계).
 *
 * 집필 버튼은 명령형 router.push 라 라우트가 미리 안 데워진 경우 목적지 준비까지 옛 화면에 멈췄다
 * (=클릭 후 ~1초 정지). 본 loading.tsx 가 있으면 클릭 즉시 스켈레톤으로 전환되고 실제 셸/에디터는
 * 이어서 스트리밍된다. 셸의 데이터 로딩도 같은 [StudioSkeleton] 을 써서 전환이 끊김 없이 이어진다.
 * 상단 셸(b/layout)은 유지된다.
 */
export default function WorkLoading() {
    return <StudioSkeleton />;
}
