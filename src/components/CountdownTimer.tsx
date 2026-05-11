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

    // Snapshot window is open
    if (!timeLeft) {
        return (
            <div style={styles.wrapperUrgent}>
                <div style={styles.urgentDot} />
                <div style={styles.textBlock}>
                    <span style={styles.urgentTitle}>
                        Snapshot window is now open
                    </span>
                    <span style={styles.urgentSub}>
                        The migration snapshot can happen at any time. Register
                        now to ensure your assets are included. Each Solana
                        address can only receive from one source wallet.
                    </span>
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
        wrapperUrgent: {
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
            padding: "16px 20px",
            background: brand.lavender,
            border: `1px solid ${brand.primary}33`,
            borderRadius: "16px",
        },
        urgentDot: {
            width: "10px",
            height: "10px",
            borderRadius: "50%",
            background: brand.primary,
            flexShrink: 0,
            marginTop: "4px",
            animation: "pulse-dot 2s ease-in-out infinite",
        },
        textBlock: {
            display: "flex",
            flexDirection: "column",
            gap: "2px",
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
        urgentTitle: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "15px",
            fontWeight: 700,
            color: brand.black,
        },
        urgentSub: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "13px",
            color: brand.textSecondary,
            lineHeight: 1.5,
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
