import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
    title: "소설비 운영 툴",
    description: "Admin Ops Tool",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="ko">
            <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
