/**
 * 약관 본문 공유 프리미티브 — /privacy 페이지와 회원가입 약관 모달이 동일 스타일로 렌더.
 * 핸들러 없는 순수 표시 컴포넌트 (server component 가능).
 */

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section style={{ marginTop: "36px" }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "12px" }}>{title}</h2>
            {children}
        </section>
    );
}

export function SubTitle({ children }: { children: React.ReactNode }) {
    return <p style={{ fontWeight: 600, marginTop: "16px", marginBottom: "8px" }}>{children}</p>;
}

export function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
    return (
        <div style={{ overflowX: "auto", marginBottom: "16px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                <thead>
                    <tr>
                        {headers.map((h) => (
                            <th
                                key={h}
                                style={{
                                    textAlign: "left",
                                    padding: "8px 12px",
                                    borderBottom: "2px solid var(--w-hairline, #e5e5e5)",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i}>
                            {row.map((cell, j) => (
                                <td
                                    key={j}
                                    style={{
                                        padding: "8px 12px",
                                        borderBottom: "1px solid var(--w-hairline, #e5e5e5)",
                                        verticalAlign: "top",
                                    }}
                                >
                                    {cell}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
