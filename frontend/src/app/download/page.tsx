import type { Metadata } from "next";
import { DownloadButtons } from "./DownloadButtons";

export const metadata: Metadata = {
    title: "나래 노트 다운로드",
    description: "컨텍스트가 안 죽는 작가용 작업공간 — Windows · macOS 데스크탑 앱",
};

type GuideStep = string;

const WINDOWS_STEPS: readonly GuideStep[] = [
    "내려받은 Narae-Note-Setup.exe 를 실행합니다.",
    "“Windows의 PC를 보호했습니다” 창이 뜨면 → 추가 정보 → 실행 을 누릅니다.",
    "설치가 끝납니다 (관리자 권한이 필요 없습니다).",
];

const MAC_STEPS: readonly GuideStep[] = [
    "내려받은 Narae-Note.dmg 를 열고, 나래 노트를 응용 프로그램 폴더로 드래그합니다.",
    "앱을 처음 열면 “확인할 수 없어 열 수 없습니다” 안내가 나옵니다 → 완료 를 누릅니다.",
    "시스템 설정 → 개인정보 보호 및 보안 으로 가서, 아래쪽 “확인 없이 열기” 를 누르고 암호를 입력합니다.",
    "이후에는 평소처럼 바로 열립니다 (이 과정은 처음 한 번만 필요합니다).",
];

function GuideCard({ title, steps }: { title: string; steps: readonly GuideStep[] }) {
    return (
        <div
            className="flex-1 flex flex-col gap-3 p-5 rounded-card-mode"
            style={{ border: "1px solid var(--w-hairline)" }}
        >
            <h3 className="font-semibold">{title}</h3>
            <ol className="flex flex-col gap-2 text-sm" style={{ color: "var(--w-ink)" }}>
                {steps.map((step, i) => (
                    <li key={i} className="flex gap-2">
                        <span className="opacity-50 tabular-nums">{i + 1}.</span>
                        <span className="opacity-90">{step}</span>
                    </li>
                ))}
            </ol>
        </div>
    );
}

export default function DownloadPage() {
    return (
        <main
            className="flex-1 flex flex-col items-center gap-10 px-6 py-16"
            style={{ backgroundColor: "var(--w-canvas)", color: "var(--w-ink)" }}
        >
            <header className="flex flex-col items-center gap-3 text-center">
                <h1 className="text-3xl font-bold">나래 노트 다운로드</h1>
                <p className="opacity-70 max-w-md">
                    컨텍스트가 안 죽는 작가용 작업공간. Windows 와 macOS 에서 사용할 수 있습니다.
                </p>
            </header>

            <DownloadButtons />

            <section className="flex flex-col gap-4 w-full max-w-3xl">
                <h2 className="text-lg font-semibold text-center">설치 방법</h2>
                <p className="text-sm opacity-60 text-center max-w-2xl mx-auto">
                    아직 코드 서명 전이라, 처음 실행할 때 운영체제가 “확인되지 않은 앱” 경고를 보여줍니다.
                    아래 단계를 따르면 안전하게 설치할 수 있습니다.
                </p>
                <div className="flex flex-col md:flex-row gap-4">
                    <GuideCard title="Windows" steps={WINDOWS_STEPS} />
                    <GuideCard title="macOS" steps={MAC_STEPS} />
                </div>
            </section>
        </main>
    );
}
