import React, { useState, useCallback } from "react";
import { brand } from "../App.tsx";
import {
    lookupSnapshotEntry,
    getSnapshotSourceUrl,
    SNAPSHOT_DATE_LABEL,
} from "../services/snapshot-asset-lookup.ts";

interface SnapshotDownloadProps {
    address: string;
}

export function SnapshotDownload({ address }: SnapshotDownloadProps) {
    const [downloading, setDownloading] = useState(false);
    const styles = getStyles();

    const downloadEntry = useCallback(async () => {
        setDownloading(true);
        try {
            const result = await lookupSnapshotEntry(address);
            if (!result) return;
            const payload = {
                address,
                snapshotTimestamp: result.snapshotTimestamp,
                ...result.entry,
            };
            const blob = new Blob(
                [JSON.stringify(payload, null, 2)],
                { type: "application/json" },
            );
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `snapshot-${address.slice(0, 8)}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } finally {
            setDownloading(false);
        }
    }, [address]);

    const downloadFull = useCallback(() => {
        window.open(getSnapshotSourceUrl(), "_blank", "noopener");
    }, []);

    return (
        <div style={styles.wrapper}>
            <div style={styles.row}>
                <div style={styles.info}>
                    <span style={styles.label}>Snapshot Data</span>
                    <span style={styles.hint}>
                        Download the raw {SNAPSHOT_DATE_LABEL} migration snapshot data.
                    </span>
                </div>
                <div style={styles.buttons}>
                    <button
                        className="btn-secondary"
                        style={styles.btn}
                        onClick={downloadEntry}
                        disabled={downloading}
                    >
                        {downloading ? "Preparing..." : "My Data"}
                    </button>
                    <button
                        className="btn-text"
                        style={styles.btn}
                        onClick={downloadFull}
                    >
                        Full Snapshot
                    </button>
                </div>
            </div>
        </div>
    );
}

function getStyles(): Record<string, React.CSSProperties> {
    return {
        wrapper: {
            borderTop: `1px solid ${brand.border}`,
            paddingTop: "16px",
        },
        row: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            flexWrap: "wrap",
        },
        info: {
            display: "flex",
            flexDirection: "column",
            gap: "2px",
        },
        label: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "12px",
            fontWeight: 700,
            color: brand.textSecondary,
        },
        hint: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "12px",
            color: brand.textTertiary,
        },
        buttons: {
            display: "flex",
            gap: "8px",
            flexShrink: 0,
        },
        btn: {
            fontSize: "13px",
            padding: "6px 14px",
        },
    };
}
