import React from "react";
import { brand } from "../App.tsx";
import { SNAPSHOT_DATE_LABEL, getSnapshotSourceUrl } from "../services/snapshot-asset-lookup.ts";

/**
 * Frozen migration-snapshot totals (2026-06-01), as produced by
 * migration/import/build-holdings-full.mjs (`counts` + `totals`). The snapshot
 * is immutable, so these are constants — no runtime fetch of the 3.5MB holdings
 * file is forced just to render the summary.
 *
 *   ARIO migrated  = sum of all five categories = exactly 1,000,000,000 ARIO
 *   wallets        = counts.arweaveAddresses (10,215)
 *   ArNS names     = counts.nameBackingAnts   (3,352)
 *   gateways       = 677 in the GAR at snapshot (582 active + 95 leaving)
 */
const STATS: { value: string; label: string }[] = [
    { value: "1B", label: "ARIO Migrated" },
    { value: "10,215", label: "Wallets Migrated" },
    { value: "3,352", label: "ArNS Names" },
    { value: "677", label: "Gateways" },
];

export function MigrationStats() {
    const styles = getStyles();

    return (
        <div style={styles.wrapper}>
            <div style={styles.header}>
                <span style={styles.headerTitle}>Migration by the Numbers</span>
                <span style={styles.headerNote}>
                    Captured at the migration snapshot ({SNAPSHOT_DATE_LABEL}).
                </span>
            </div>
            <div className="stats-grid" style={styles.grid}>
                {STATS.map((stat) => (
                    <div key={stat.label} style={styles.cell}>
                        <span style={styles.value}>{stat.value}</span>
                        <span style={styles.label}>{stat.label}</span>
                    </div>
                ))}
            </div>
            <div style={styles.footer}>
                <a
                    href={getSnapshotSourceUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-text"
                    style={styles.downloadLink}
                >
                    Download Full Snapshot Data
                </a>
            </div>
        </div>
    );
}

function getStyles(): Record<string, React.CSSProperties> {
    return {
        wrapper: {
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            padding: "20px",
            background: brand.white,
            border: `1px solid ${brand.border}`,
            borderRadius: "16px",
            boxShadow: "0 1px 3px rgba(35, 35, 45, 0.04)",
        },
        header: {
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            marginBottom: "4px",
        },
        headerTitle: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "14px",
            fontWeight: 700,
            color: brand.black,
        },
        headerNote: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "13px",
            color: brand.textSecondary,
            lineHeight: 1.5,
        },
        grid: {
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "1px",
            background: brand.border,
            borderRadius: "12px",
            overflow: "hidden",
            border: `1px solid ${brand.border}`,
        },
        cell: {
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            padding: "18px",
            background: brand.cardSurface,
        },
        value: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "24px",
            fontWeight: 800,
            color: brand.black,
            lineHeight: 1.1,
        },
        label: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "11px",
            fontWeight: 700,
            color: brand.textTertiary,
            textTransform: "uppercase" as const,
            letterSpacing: "0.8px",
        },
        footer: {
            display: "flex",
            justifyContent: "flex-end",
            paddingTop: "4px",
        },
        downloadLink: {
            fontSize: "13px",
            textDecoration: "none",
        },
    };
}
