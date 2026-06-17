/**
 * 집필 라우트 전환 시 즉시 표시되는 pending UI (Suspense 경계).
 *
 * 집필 버튼은 명령형 router.push 라 라우트가 미리 안 데워진 경우 목적지 준비까지
 * 옛 화면에 멈췄다(=클릭 후 ~1초 정지) — 본 loading.tsx 가 있으면 클릭 즉시 본 화면으로
 * 전환되고 실제 셸/에디터는 이어서 스트리밍된다(체감 정지 제거). 상단 셸(b/layout)은 유지된다.
 */
export default function WorkLoading() {
    return (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white">
            <p className="text-sm text-gray-400">집필실 여는 중…</p>
        </div>
    );
}
