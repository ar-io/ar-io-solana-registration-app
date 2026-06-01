import React, { useState, useEffect } from "react";
import { brand } from "../App.tsx";

/** June 1, 2026 00:00 UTC — snapshot window opens after this date */
const SNAPSHOT_WINDOW_START = new Date("2026-06-01T00:00:00Z").getTime();

interface TimeLeft {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
}

function calcTimeLeft(): TimeLeft | null {
    const diff = SNAPSHOT_WINDOW_START - Date.now();
    if (diff <= 0) return null;
    return {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
    };
}

function pad(n: number): string {
    return n.toString().padStart(2, "0");
}

export function CountdownTimer() {
    const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(calcTimeLeft);

    useEffect(() => {
        const interval = setInterval(() => {
            setTimeLeft(calcTimeLeft());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const styles = getStyles();

    // Snapshot window is open — registration closed
    if (!timeLeft) {
        return (
            <div style={styles.wrapperClosed}>
                <div style={styles.textBlock}>
                    <span style={styles.closedTitle}>
                        Snapshot window is now open
                    </span>
                    <span style={styles.closedSub}>
                        The migration snapshot can happen at any time.
                        Registration is closed — no new registrations are being
                        accepted.
                    </span>
                    <div style={styles.closedLinks}>
                        <a
                            href="#/status"
                            style={styles.learnMore}
                        >
                            Check your status
                        </a>
                        <span style={styles.closedLinkSep}>&middot;</span>
                        <a
                            href="https://ar.io/solana-migration"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={styles.learnMore}
                        >
                            Learn more
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.wrapper}>
            <span style={styles.label}>Snapshot day in</span>
            <div style={styles.countdown}>
                <span style={styles.countdownValue}>
                    {timeLeft.days}
                </span>
                <span style={styles.countdownUnit}>d</span>
                <span style={styles.countdownSep}>:</span>
                <span style={styles.countdownValue}>
                    {pad(timeLeft.hours)}
                </span>
                <span style={styles.countdownUnit}>h</span>
                <span style={styles.countdownSep}>:</span>
                <span style={styles.countdownValue}>
                    {pad(timeLeft.minutes)}
                </span>
                <span style={styles.countdownUnit}>m</span>
                <span style={styles.countdownSep}>:</span>
                <span style={styles.countdownValue}>
                    {pad(timeLeft.seconds)}
                </span>
                <span style={styles.countdownUnit}>s</span>
            </div>
            <span style={styles.snapshotDate}>June 1, 2026 · 00:00 UTC</span>
            <span style={styles.sub}>
                Link your wallet to a unique Solana address before the snapshot. Each Solana address can only receive from one source wallet. Only registered wallets will be migrated.{" "}
                <a
                    href="https://ar.io/solana-migration"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={styles.learnMore}
                >
                    Learn more
                </a>
            </span>
        </div>
    );
}

function getStyles(): Record<string, React.CSSProperties> {
    return {
        wrapper: {
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            padding: "20px 24px",
            background: brand.cardSurface,
            border: `1px solid ${brand.border}`,
            borderRadius: "16px",
        },
        wrapperClosed: {
            display: "flex",
            padding: "16px 20px",
            background: brand.cardSurface,
            border: `1px solid ${brand.border}`,
            borderRadius: "16px",
        },
        textBlock: {
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            flex: 1,
            minWidth: 0,
        },
        label: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "14px",
            fontWeight: 700,
            color: brand.black,
            textTransform: "uppercase" as const,
            letterSpacing: "0.8px",
        },
        snapshotDate: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "13px",
            fontWeight: 600,
            color: brand.textTertiary,
        },
        sub: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "14px",
            color: brand.textSecondary,
            lineHeight: 1.5,
        },
        closedTitle: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "15px",
            fontWeight: 700,
            color: brand.textSecondary,
        },
        closedSub: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "13px",
            color: brand.textTertiary,
            lineHeight: 1.5,
        },
        closedLinks: {
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginTop: "4px",
        },
        closedLinkSep: {
            color: brand.textTertiary,
            fontSize: "12px",
        },
        learnMore: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "14px",
            fontWeight: 600,
            color: brand.primary,
            textDecoration: "none",
        },
        countdown: {
            display: "flex",
            alignItems: "baseline",
            gap: "2px",
            whiteSpace: "nowrap",
            margin: "4px 0",
        },
        countdownValue: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "32px",
            fontWeight: 800,
            color: brand.primary,
            fontVariantNumeric: "tabular-nums",
        },
        countdownUnit: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "12px",
            fontWeight: 600,
            color: brand.textTertiary,
            marginRight: "4px",
        },
        countdownSep: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "18px",
            fontWeight: 700,
            color: brand.border,
            margin: "0 2px",
        },
    };
}
