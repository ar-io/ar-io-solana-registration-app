import React, { useEffect, useState } from "react";
import { brand } from "../App.tsx";
import { ARWEAVE_EXPLORER_URL } from "../services/arweave-graphql.ts";
import { useTurboAttestation } from "../hooks/useTurboAttestation.tsx";

interface RegistrationProgressProps {
    sourceAddress: string;
    sourceChain: "arweave" | "ethereum";
    solanaPubkey: string;
    sourceAddressSignature: string;
    signatureMethod?: "message" | "transaction";
    signatureTxData?: string;
    ethereumProvider?: any;
    onComplete: (txId?: string) => void;
    onError: (err: Error) => void;
}

type ProgressStep = {
    label: string;
    status: "pending" | "active" | "done" | "error";
};

export function RegistrationProgress({
    sourceAddress,
    sourceChain,
    solanaPubkey,
    sourceAddressSignature,
    signatureMethod = "message",
    signatureTxData,
    ethereumProvider,
    onComplete,
    onError,
}: RegistrationProgressProps) {
    const { sign, loading, error, success, stage, txId } = useTurboAttestation(
        sourceAddress,
        sourceChain,
        solanaPubkey,
        sourceAddressSignature,
        signatureMethod,
        signatureTxData,
        ethereumProvider,
    );

    const [confirmed, setConfirmed] = useState(false);

    const styles = getStyles();

    useEffect(() => {
        if (success) {
            onComplete(txId || undefined);
        }
    }, [success, txId, onComplete]);

    useEffect(() => {
        if (error) {
            onError(new Error(error));
        }
    }, [error, onError]);

    const steps: ProgressStep[] = [
        {
            label: "Creating wallet signer...",
            status: getStepStatus(stage, "create_signer", !!error),
        },
        {
            label: "Uploading registration to Arweave...",
            status: getStepStatus(stage, "upload", !!error),
        },
        {
            label: "Registration confirmed",
            status: getStepStatus(stage, "confirm", !!error),
        },
    ];

    // Pre-sign state: show summary + confirmation
    if (!loading && !success && !error) {
        const fromLabel =
            sourceChain === "ethereum" ? "From (Ethereum)" : "From (Arweave)";

        return (
            <div style={styles.wrapper}>
                <p style={styles.description}>
                    Sign with your{" "}
                    {sourceChain === "ethereum" ? "Ethereum" : "Arweave"} wallet
                    to finalize. This permanently links your{" "}
                    {sourceChain === "ethereum" ? "Ethereum" : "Arweave"}{" "}
                    address to the Solana address below.
                </p>
                <div style={styles.summary}>
                    <div style={styles.summaryRow}>
                        <span style={styles.summaryLabel}>{fromLabel}</span>
                        <code style={styles.summaryValue}>{sourceAddress}</code>
                    </div>
                    <div style={styles.summaryRow}>
                        <span style={styles.summaryLabel}>To (Solana)</span>
                        <code style={styles.summaryValue}>{solanaPubkey}</code>
                    </div>
                </div>

                <label style={styles.confirmLabel}>
                    <input
                        type="checkbox"
                        checked={confirmed}
                        onChange={(e) => setConfirmed(e.target.checked)}
                        style={styles.checkbox}
                    />
                    <span style={styles.confirmText}>
                        I confirm both addresses above are correct. I understand
                        this will permanently link my
                        {sourceChain === "ethereum"
                            ? " Ethereum"
                            : " Arweave"}{" "}
                        address to this Solana address. During the migration, all
                        my ARIO tokens, ArNS names, staking positions, and vaults
                        will be transferred to this Solana address and{" "}
                        <strong>this cannot be undone</strong>.
                    </span>
                </label>

                <button
                    className="btn-primary-lg"
                    onClick={sign}
                    disabled={!confirmed || !sourceAddressSignature}
                    style={{
                        opacity: confirmed && sourceAddressSignature ? 1 : 0.5,
                        cursor: confirmed && sourceAddressSignature ? "pointer" : "not-allowed",
                    }}
                >
                    Sign & Register
                </button>
            </div>
        );
    }

    return (
        <div style={styles.wrapper}>
            <div style={styles.stepList}>
                {steps.map((step, i) => (
                    <div key={i} style={styles.stepRow}>
                        <div
                            style={{
                                ...styles.stepIndicator,
                                background:
                                    step.status === "done"
                                        ? brand.success
                                        : step.status === "active"
                                          ? brand.primary
                                          : step.status === "error"
                                            ? brand.error
                                            : brand.border,
                                color:
                                    step.status === "pending"
                                        ? brand.textTertiary
                                        : brand.white,
                                ...(step.status === "active"
                                    ? {
                                          animation:
                                              "spin 1.2s linear infinite",
                                          borderTop: `2px solid ${brand.white}`,
                                          borderRight: `2px solid transparent`,
                                          borderBottom: `2px solid transparent`,
                                          borderLeft: `2px solid transparent`,
                                          background: brand.primary,
                                      }
                                    : {}),
                            }}
                        >
                            {step.status === "done"
                                ? "\u2713"
                                : step.status === "active"
                                  ? ""
                                  : step.status === "error"
                                    ? "\u2717"
                                    : ""}
                        </div>
                        <span
                            style={{
                                ...styles.stepLabel,
                                color:
                                    step.status === "done"
                                        ? brand.success
                                        : step.status === "active"
                                          ? brand.black
                                          : step.status === "error"
                                            ? brand.error
                                            : brand.textTertiary,
                            }}
                        >
                            {step.label}
                        </span>
                    </div>
                ))}
            </div>

            {/* Show tx ID on success */}
            {success && txId && (
                <div style={styles.txBlock}>
                    <span style={styles.txLabel}>TX:</span>{" "}
                    <a
                        href={`${ARWEAVE_EXPLORER_URL}/${txId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={styles.txLink}
                    >
                        {txId.substring(0, 16)}...
                    </a>
                </div>
            )}

            {error && (
                <div style={styles.errorBlock}>
                    <div style={styles.errorText}>{error}</div>
                    <button
                        className="btn-primary"
                        onClick={sign}
                        style={{ marginTop: "10px" }}
                    >
                        Try Again
                    </button>
                </div>
            )}
        </div>
    );
}

function getStepStatus(
    stage: string | null,
    stepName: string,
    hasError: boolean,
): "pending" | "active" | "done" | "error" {
    // Map stages to step indices: create_signer=0, upload=1, confirm/done=2
    const stageToStep: Record<string, number> = {
        create_signer: 0,
        upload: 1,
        confirm: 2,
        done: 2,
    };
    const stepToIdx: Record<string, number> = {
        create_signer: 0,
        upload: 1,
        confirm: 2,
    };

    const currentIdx = stage ? (stageToStep[stage] ?? -1) : -1;
    const stepIdx = stepToIdx[stepName] ?? -1;

    if (hasError) {
        if (stepIdx < currentIdx) return "done";
        if (stepIdx === currentIdx) return "error";
        return "pending";
    }

    if (stepIdx < currentIdx) return "done";
    if (stepIdx === currentIdx) {
        // confirm and done both map to step 2 — show as done when stage is done/confirm
        return stage === "done" || stage === "confirm" ? "done" : "active";
    }
    return "pending";
}

function getStyles(): Record<string, React.CSSProperties> {
    return {
        wrapper: {
            display: "flex",
            flexDirection: "column",
            gap: "16px",
        },
        description: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "14px",
            color: brand.textSecondary,
            lineHeight: 1.6,
            margin: 0,
        },
        summary: {
            background: brand.cardSurface,
            border: `1px solid ${brand.border}`,
            borderRadius: "10px",
            padding: "16px 18px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
        },
        summaryRow: {
            display: "flex",
            flexDirection: "column",
            gap: "4px",
        },
        summaryLabel: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "11px",
            fontWeight: 700,
            color: brand.textTertiary,
            textTransform: "uppercase" as const,
            letterSpacing: "0.8px",
        },
        summaryValue: {
            fontFamily: "monospace",
            fontSize: "12px",
            color: brand.black,
            wordBreak: "break-all" as const,
        },
        confirmLabel: {
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
            cursor: "pointer",
            padding: "12px 14px",
            background: brand.cardSurface,
            borderRadius: "10px",
            border: `1px solid ${brand.border}`,
        },
        checkbox: {
            marginTop: "2px",
            accentColor: brand.primary,
            width: "16px",
            height: "16px",
            flexShrink: 0,
            cursor: "pointer",
        },
        confirmText: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "13px",
            color: brand.textSecondary,
            lineHeight: 1.5,
        },
        stepList: {
            display: "flex",
            flexDirection: "column",
            gap: "14px",
        },
        stepRow: {
            display: "flex",
            alignItems: "center",
            gap: "12px",
        },
        stepIndicator: {
            width: "24px",
            height: "24px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "12px",
            fontWeight: 700,
            flexShrink: 0,
            transition: "background 0.2s",
        },
        stepLabel: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "14px",
            fontWeight: 500,
            transition: "color 0.2s",
        },
        txBlock: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "13px",
            color: brand.textSecondary,
            padding: "12px 14px",
            background: brand.successBg,
            borderRadius: "10px",
            border: `1px solid ${brand.success}33`,
        },
        txLabel: {
            fontWeight: 600,
            color: brand.success,
        },
        txLink: {
            fontFamily: "monospace",
            fontSize: "12px",
            color: brand.primary,
            textDecoration: "underline",
            wordBreak: "break-all" as const,
        },
        errorBlock: {
            background: brand.errorBg,
            padding: "14px 16px",
            borderRadius: "10px",
            border: `1px solid ${brand.error}33`,
        },
        errorText: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "13px",
            color: brand.error,
            lineHeight: 1.5,
        },
    };
}
