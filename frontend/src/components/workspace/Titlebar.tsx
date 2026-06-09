import type { ReactNode } from "react";

type TitlebarProps = {
    title: string;
    right?: ReactNode;
};

/** chrome — desktop Titlebar 이식. 좌측 신호등(장식), 중앙 화면명, 우측 슬롯. */
export function Titlebar({ title, right }: TitlebarProps) {
    return (
        <header className="titlebar">
            <div className="lights" aria-hidden="true">
                <i />
                <i />
                <i />
            </div>
            <div className="titlebar__center">{title}</div>
            <div className="titlebar__right">{right}</div>
        </header>
    );
}
