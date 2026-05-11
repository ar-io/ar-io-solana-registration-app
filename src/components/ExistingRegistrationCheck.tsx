import React, { useEffect } from "react";
import { brand } from "../App.tsx";
import { ARWEAVE_EXPLORER_URL } from "../services/arweave-graphql.ts";
import { useAttestationStatus } from "../hooks/useAttestationStatus.tsx";

interface ExistingRegistrationCheckProps {
    sourceAddress: string;
    sourceChain: "arweave" | "ethereum";
    onComplete: (registration: any) => void;
}

export function ExistingRegistrationCheck({
    sourceAddress,
    sourceChain,
    onComplete,
}: ExistingRegistrationCheckProps) {
    const {
        loading,
        registered,
        solanaPubkey,
        txId,
        registeredAt,
        error,
        retry,
    } = useAttestationStatus(sourceAddress, sourceChain);

    const styles = getStyles();

    useEffect(() => {
        if (!loading && !error) {
            const registrationData = registered
                ? { solanaPubkey, txId, registeredAt }
                : null;
            onComplete(registrationData);
        }
    }, [loading, error, registered, solanaPubkey, txId, registeredAt, onComplete]);

    if (loading) {
        return (
            <div style={styles.loading}>
                <span style={styles.spinner} />
                Checking for existing registration...
            </div>
        );
    }

    if (error) {
        return (
            <div style={styles.error}>
                <div style={styles.errorIcon}>⚠</div>
                <div>
                    <div style={styles.errorTitle}>Check Failed</div>
                    <div style={styles.errorMessage}>{error}</div>
                    <div style={styles.errorActions}>
                        <button className="btn-primary" onClick={retry}>
                            Try Again
                        </button>
                        <button
                            className="btn-text"
                            onClick={() => onComplete(null)}
                            style={{ fontSize: "13px" }}
                        >
                            Continue anyway
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (registered) {
        return (
            <div style={styles.registered}>
                <div style={styles.registeredHeader}>
                    <div style={styles.registeredDot} />
                    <span style={styles.registeredTitle}>
                        Already Registered
                    </span>
                    {registeredAt && (
                        <span style={styles.registeredDate}>
                            {new Date(registeredAt).toLocaleDateString()}
                        </span>
                    )}
                </div>
                <div style={styles.registeredRow}>
                    <span style={styles.registeredLabel}>Solana Address</span>
                    <code style={styles.registeredValue}>{solanaPubkey}</code>
                </div>
                <div style={styles.registeredFooter}>
                    <span style={styles.registeredHint}>
                        Continue to link a different Solana wallet, resubmit
                        with the same wallet, or change wallet to register
                        another source address.
                    </span>
                    {txId && (
                        <a
                            href={`${ARWEAVE_EXPLORER_URL}/${txId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={styles.registeredLink}
                        >
                            View on explorer
                        </a>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div style={styles.success}>
            <div style={styles.successIcon}>✓</div>
            <div>
                <div style={styles.successTitle}>No Existing Registration</div>
                <div style={styles.successMessage}>
                    This {sourceChain === "ethereum" ? "Ethereum" : "Arweave"}{" "}
                    address has not been registered yet. You can proceed with
                    registration.
                </div>
            </div>
        </div>
    );
}

function getStyles(): Record<string, React.CSSProperties> {
    return {
        loading: {
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "16px",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "14px",
            color: brand.textSecondary,
        },
        spinner: {
            display: "inline-block",
            width: "16px",
            height: "16px",
            border: `2px solid ${brand.border}`,
            borderTop: `2px solid ${brand.primary}`,
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
        },
        error: {
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
            padding: "16px",
            background: brand.errorBg,
            border: `1px solid ${brand.error}33`,
            borderRadius: "10px",
        },
        errorIcon: {
            fontSize: "16px",
            color: brand.error,
            flexShrink: 0,
            marginTop: "2px",
        },
        errorTitle: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "14px",
            fontWeight: 600,
            color: brand.error,
            marginBottom: "4px",
        },
        errorMessage: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "13px",
            color: brand.error,
            marginBottom: "6px",
        },
        errorActions: {
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginTop: "8px",
        },
        registered: {
            padding: "16px",
            background: brand.cardSurface,
            border: `1px solid ${brand.border}`,
            borderRadius: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
        },
        registeredHeader: {
            display: "flex",
            alignItems: "center",
            gap: "8px",
        },
        registeredDot: {
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: brand.primary,
            flexShrink: 0,
        },
        registeredTitle: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "14px",
            fontWeight: 700,
            color: brand.black,
        },
        registeredDate: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "12px",
            color: brand.textTertiary,
            marginLeft: "auto",
        },
        registeredRow: {
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            padding: "10px 12px",
            background: brand.white,
            borderRadius: "8px",
            border: `1px solid ${brand.border}`,
        },
        registeredLabel: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "11px",
            fontWeight: 700,
            color: brand.textTertiary,
            textTransform: "uppercase" as const,
            letterSpacing: "0.8px",
        },
        registeredValue: {
            fontFamily: "monospace",
            fontSize: "12px",
            color: brand.black,
            wordBreak: "break-all" as const,
        },
        registeredFooter: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
        },
        registeredHint: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "12px",
            color: brand.textTertiary,
            lineHeight: 1.4,
        },
        registeredLink: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "12px",
            color: brand.primary,
            textDecoration: "none",
            whiteSpace: "nowrap",
            flexShrink: 0,
        },
        success: {
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
            padding: "16px",
            background: brand.successBg,
            border: `1px solid ${brand.success}33`,
            borderRadius: "10px",
        },
        successIcon: {
            fontSize: "16px",
            color: brand.success,
            flexShrink: 0,
            marginTop: "2px",
        },
        successTitle: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "14px",
            fontWeight: 600,
            color: brand.success,
            marginBottom: "4px",
        },
        successMessage: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "13px",
            color: brand.success,
        },
    };
}
