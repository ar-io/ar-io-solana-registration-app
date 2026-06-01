import React, { useState, useCallback, useEffect, useRef } from "react";
import { brand } from "../App.tsx";
import { SourceWalletConnect } from "../components/SourceWalletConnect.tsx";
import { SolanaWalletConnect } from "../components/SolanaWalletConnect.tsx";
import { ExistingRegistrationCheck } from "../components/ExistingRegistrationCheck.tsx";
import { SourceAddressSigner } from "../components/SourceAddressSigner.tsx";
import { RegistrationProgress } from "../components/RegistrationProgress.tsx";
import { AssetPreview } from "../components/AssetPreview.tsx";
import { CountdownTimer } from "../components/CountdownTimer.tsx";
import {
    ARWEAVE_EXPLORER_URL,
    queryAttestationBySolanaPubkey,
    queryAttestationByOwner,
    queryAttestationByTag,
    invalidateRegistrationCache,
} from "../services/arweave-graphql.ts";

/** June 1, 2026 00:00 UTC — registration closes when snapshot window opens */
const SNAPSHOT_WINDOW_START = new Date("2026-06-01T00:00:00Z").getTime();

type RegistrationStep =
    | "idle"
    | "source_connected"
    | "registration_checked"
    | "solana_connected"
    | "address_signed"
    | "signing"
    | "error"
    | "confirmed";

export function RegisterPage() {
    const registrationClosed = Date.now() >= SNAPSHOT_WINDOW_START;

    const [step, setStep] = useState<RegistrationStep>("idle");
    const [sourceAddress, setSourceAddress] = useState("");
    const [sourceChain, setSourceChain] = useState<"arweave" | "ethereum">(
        "arweave",
    );
    const [existingRegistration, setExistingRegistration] = useState<any>(null);
    const [solanaPubkey, setSolanaPubkey] = useState("");
    const [sourceAddressSignature, setSourceAddressSignature] = useState("");
    const [signatureMethod, setSignatureMethod] = useState<"message" | "transaction">("message");
    const [signatureTxData, setSignatureTxData] = useState<string | undefined>();
    const [transactionId, setTransactionId] = useState<string | null>(null);
    const [ethereumProvider, setEthereumProvider] = useState<any>(null);
    const [solanaCheckWarning, setSolanaCheckWarning] = useState<string | null>(
        null,
    );

    const styles = getStyles();

    // Step 1: Source wallet connection
    const handleSourceConnect = useCallback(
        (address: string, chain: "arweave" | "ethereum", provider?: any) => {
            setSourceAddress(address);
            setSourceChain(chain);
            if (chain === "ethereum" && provider) {
                setEthereumProvider(provider);
            } else {
                setEthereumProvider(null);
            }
            setStep("source_connected");
        },
        [],
    );

    const handleSourceDisconnect = useCallback(() => {
        setSourceAddress("");
        setExistingRegistration(null);
        setEthereumProvider(null);
        setSolanaPubkey("");
        setSourceAddressSignature("");
        setSignatureMethod("message");
        setSignatureTxData(undefined);
        setSignError(null);
        setSolanaCheckError(null);
        setSolanaCheckWarning(null);
        setStep("idle");
    }, []);

    // Step 2: Registration check complete
    const handleRegistrationChecked = useCallback((registration: any) => {
        setExistingRegistration(registration);
        setStep("registration_checked");
    }, []);

    // Step 3: Solana wallet connection + uniqueness check
    const [solanaCheckError, setSolanaCheckError] = useState<string | null>(
        null,
    );
    const [solanaChecking, setSolanaChecking] = useState(false);

    const handleSolanaConnect = useCallback(
        async (pubkey: string) => {
            setSolanaPubkey(pubkey);
            setSolanaCheckError(null);
            setSolanaCheckWarning(null);
            setSolanaChecking(true);

            // If re-registering and they picked the SAME Solana wallet, warn but allow
            if (
                existingRegistration &&
                existingRegistration.solanaPubkey === pubkey
            ) {
                setSolanaCheckWarning(
                    "This Solana address is already linked to this source address. You can continue to resubmit your registration, or use a different Solana wallet.",
                );
            }

            // Check GraphQL (authoritative — includes cross-check for stale mappings)
            try {
                const existing =
                    await queryAttestationBySolanaPubkey(pubkey);
                if (
                    existing &&
                    existing.sourceAddress !== sourceAddress
                ) {
                    // Cross-check: has the original source since re-registered
                    // to a different Solana wallet? If so, this one is stale.
                    const latestForSource =
                        existing.sourceChain === "arweave"
                            ? await queryAttestationByOwner(existing.sourceAddress)
                            : await queryAttestationByTag(existing.sourceAddress);

                    if (
                        latestForSource &&
                        latestForSource.solanaPubkey !== pubkey
                    ) {
                        // The original source moved to a different Solana wallet.
                        // This Solana address is free to use.
                    } else {
                        setSolanaCheckError(
                            `This Solana address is already linked to ${existing.sourceChain === "ethereum" ? "Ethereum" : "Arweave"} address ${existing.sourceAddress}. Each Solana address can only be used once.`,
                        );
                        setSolanaChecking(false);
                        return;
                    }
                }
            } catch {
                setSolanaCheckWarning(
                    "Could not verify Solana address availability. You may proceed, but if this address is already registered to a different source address, your registration may not be honored.",
                );
            }

            setSolanaChecking(false);
            setStep("solana_connected");
        },
        [sourceAddress, existingRegistration],
    );

    const handleSolanaDisconnect = useCallback(() => {
        setSolanaPubkey("");
        setSourceAddressSignature("");
        setSignatureMethod("message");
        setSignatureTxData(undefined);
        setSignError(null);
        setSolanaCheckError(null);
        setSolanaCheckWarning(null);
        setSolanaChecking(false);
        setStep("registration_checked");
    }, []);

    // Step 4: Source address signing
    const handleSourceAddressSigned = useCallback(
        (signature: string, method: "message" | "transaction", txData?: string) => {
            setSourceAddressSignature(signature);
            setSignatureMethod(method);
            setSignatureTxData(txData);
            setStep("address_signed");
        },
        [],
    );

    const [signError, setSignError] = useState<string | null>(null);

    const handleSourceSignError = useCallback((error: Error) => {
        console.error("Source address signing error:", error);
        // Stay on step 4 and show error inline — don't advance to step 5
        setSignError(error.message);
    }, []);

    // Step 5: Auto-detect if source wallet is still connected, skip reconnect
    const autoDetectSourceWallet = useCallback(async () => {
        try {
            if (sourceChain === "arweave" && (window as any).arweaveWallet) {
                const addr = await (window as any).arweaveWallet.getActiveAddress();
                if (addr === sourceAddress) {
                    setStep("signing");
                    return;
                }
            }
            if (sourceChain === "ethereum") {
                const eth = ethereumProvider || (window as any).ethereum;
                if (eth) {
                    const accounts = await eth.request({
                        method: "eth_accounts", // passive — doesn't prompt
                    });
                    if (accounts?.[0]) {
                        const { getAddress } = await import("ethers");
                        const normalized = getAddress(accounts[0]);
                        if (normalized === sourceAddress) {
                            setStep("signing");
                            return;
                        }
                    }
                }
            }
        } catch {
            // Detection failed — fall through to manual reconnect
        }
    }, [sourceAddress, sourceChain, ethereumProvider]);

    // Try auto-detect when we reach the reconnect step
    useEffect(() => {
        if (step === "address_signed") {
            autoDetectSourceWallet();
        }
    }, [step, autoDetectSourceWallet]);

    const handleSourceReconnect = useCallback(
        (address: string, chain: "arweave" | "ethereum", provider?: any) => {
            if (address === sourceAddress && chain === sourceChain) {
                if (chain === "ethereum" && provider) {
                    setEthereumProvider(provider);
                }
                setStep("signing");
            } else {
                console.error("Address mismatch during reconnection");
                setStep("error");
            }
        },
        [sourceAddress, sourceChain],
    );

    const handleSourceReconnectDisconnect = useCallback(() => {
        setStep("address_signed");
    }, []);

    const handleRegistrationComplete = useCallback(
        (txId?: string) => {
            if (txId) {
                setTransactionId(txId);
            }
            // Invalidate all caches so status checks and uniqueness checks
            // reflect this registration immediately
            invalidateRegistrationCache(sourceAddress, solanaPubkey);

            // Track registered wallets in localStorage
            try {
                const walletKey = "ar-io-registered-wallets";
                const wallets = JSON.parse(
                    localStorage.getItem(walletKey) || "[]",
                );
                if (!wallets.includes(sourceAddress)) {
                    wallets.push(sourceAddress);
                    localStorage.setItem(walletKey, JSON.stringify(wallets));
                }

                const solanaKey = "ar-io-registered-solana";
                const solanaMap: Record<string, string> = JSON.parse(
                    localStorage.getItem(solanaKey) || "{}",
                );
                solanaMap[solanaPubkey] = sourceAddress;
                localStorage.setItem(
                    solanaKey,
                    JSON.stringify(solanaMap),
                );

                // Store full registration details for instant Status page lookup
                const regKey = "ar-io-registrations";
                const regs: Record<string, any> = JSON.parse(
                    localStorage.getItem(regKey) || "{}",
                );
                regs[sourceAddress] = {
                    solanaPubkey,
                    txId: txId || null,
                    timestamp: Date.now(),
                    sourceChain,
                };
                // Also index by Solana pubkey for reverse lookups
                regs[`sol:${solanaPubkey}`] = {
                    sourceAddress,
                    txId: txId || null,
                    timestamp: Date.now(),
                    sourceChain,
                };
                localStorage.setItem(regKey, JSON.stringify(regs));
            } catch {
                // localStorage unavailable — ignore
            }
            setStep("confirmed");
        },
        [sourceAddress],
    );

    const handleRegistrationError = useCallback(() => {
        setStep("error");
    }, []);

    const handleStartOver = useCallback(() => {
        setStep("idle");
        setSourceAddress("");
        setSourceChain("arweave");
        setExistingRegistration(null);
        setSolanaPubkey("");
        setSourceAddressSignature("");
        setSignatureMethod("message");
        setSignatureTxData(undefined);
        setTransactionId(null);
        setEthereumProvider(null);
        setSolanaCheckError(null);
        setSolanaCheckWarning(null);
        setSolanaChecking(false);
        setSignError(null);
    }, []);

    const stepNumber = (s: RegistrationStep): number => {
        switch (s) {
            case "idle":
                return 1;
            case "source_connected":
                return 2;
            case "registration_checked":
                return 3;
            case "solana_connected":
                return 4;
            case "address_signed":
            case "signing":
            case "error":
                return 5;
            case "confirmed":
                return 6;
        }
    };

    const current = stepNumber(step);

    const sourceLabel =
        sourceChain === "ethereum" ? "Ethereum address" : "Arweave address";

    return (
        <div className="register-container" style={styles.container}>
            <img
                src="./hero.png"
                alt="ar.io migrating to Solana"
                style={styles.heroImage}
            />
            <h2 className="register-title" style={styles.title}>
                Register for the Migration
            </h2>
            <p style={styles.subtitle}>
                Ar.io is migrating to Solana. Connect your{" "}
                {sourceAddress
                    ? sourceChain === "ethereum"
                        ? "Ethereum"
                        : "Arweave"
                    : "Arweave or Ethereum"}{" "}
                wallet, then link it to your Solana address. Your $ARIO
                tokens, ArNS names, vaults, and staking positions will
                be transferred based on your balances at the time of the
                snapshot.
            </p>
            {!registrationClosed && <CountdownTimer />}

            {registrationClosed && (
                <div style={styles.closedBanner}>
                    <div style={styles.closedHeader}>
                        <div style={styles.closedDot} />
                        <span style={styles.closedTitle}>
                            Registration is Closed
                        </span>
                    </div>
                    <p style={styles.closedText}>
                        The snapshot window is now open and new registrations are
                        no longer accepted. If you previously registered, you can
                        check your status below.
                    </p>
                    <a
                        href="#/status"
                        className="btn-primary"
                        style={{
                            textDecoration: "none",
                            display: "inline-block",
                            textAlign: "center",
                        }}
                    >
                        Check Registration Status
                    </a>
                </div>
            )}

            {!registrationClosed && <>
            <hr style={styles.divider} />

            {/* Step 1: Connect source wallet */}
            <StepCard
                number={1}
                title="Connect Your Arweave or Ethereum Wallet"
                active={current === 1}
                completed={current > 1}
            >
                <SourceWalletConnect
                    onConnect={handleSourceConnect}
                    onDisconnect={handleSourceDisconnect}
                    connectedAddress={sourceAddress || undefined}
                    connectedChain={sourceAddress ? sourceChain : undefined}
                />
            </StepCard>

            {/* Step 2: Check Existing Registration */}
            <StepCard
                number={2}
                title="Check Registration Status"
                active={current === 2}
                completed={current > 2}
            >
                {current >= 2 ? (
                    <ExistingRegistrationCheck
                        sourceAddress={sourceAddress}
                        sourceChain={sourceChain}
                        onComplete={handleRegistrationChecked}
                    />
                ) : (
                    <p style={styles.disabledText}>
                        Connect your wallet first.
                    </p>
                )}
            </StepCard>

            {/* Asset preview — shown once source wallet is connected */}
            {current >= 2 && sourceAddress && (
                <AssetPreview sourceAddress={sourceAddress} />
            )}

            {/* Step 3: Solana Destination Wallet */}
            <StepCard
                number={3}
                title="Connect Your Solana Wallet"
                active={current === 3}
                completed={current > 3}
            >
                {current >= 3 ? (
                    <>
                        <SolanaWalletConnect
                            onConnect={handleSolanaConnect}
                            onDisconnect={handleSolanaDisconnect}
                            connectedPubkey={solanaPubkey || undefined}
                            isActive={current === 3}
                        />
                        {solanaChecking && (
                            <div style={styles.checkingRow}>
                                <span style={styles.spinner} />
                                Verifying Solana address availability...
                            </div>
                        )}
                        {solanaCheckError && (
                            <div style={styles.solanaError}>
                                <div style={styles.solanaErrorTitle}>
                                    Solana Address Already Registered
                                </div>
                                <p style={styles.solanaErrorText}>
                                    {solanaCheckError}
                                </p>
                                <p style={styles.solanaErrorHint}>
                                    Please disconnect and use a different
                                    Solana wallet.
                                </p>
                            </div>
                        )}
                        {solanaCheckWarning && !solanaCheckError && (
                            <div style={styles.solanaWarning}>
                                <div style={styles.solanaWarningTitle}>
                                    {step === "solana_connected"
                                        ? "Resubmitting Attestation"
                                        : "Already Registered"}
                                </div>
                                <p style={styles.solanaWarningText}>
                                    {solanaCheckWarning}
                                </p>
                                {step !== "solana_connected" && (
                                    <button
                                        className="btn-primary"
                                        onClick={() => setStep("solana_connected")}
                                        style={{
                                            marginTop: "8px",
                                            fontSize: "13px",
                                            padding: "8px 16px",
                                        }}
                                    >
                                        Continue Anyway
                                    </button>
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    <p style={styles.disabledText}>
                        Complete the previous step first.
                    </p>
                )}
            </StepCard>

            {/* Step 4: Sign Source Address */}
            <StepCard
                number={4}
                title="Authorize Migration with Solana Wallet"
                active={current === 4}
                completed={current > 4}
            >
                {current >= 4 ? (
                    <>
                        <SourceAddressSigner
                            sourceAddress={sourceAddress}
                            sourceChain={sourceChain}
                            onSigned={(sig, method, txData) => {
                                setSignError(null);
                                handleSourceAddressSigned(sig, method, txData);
                            }}
                            onError={handleSourceSignError}
                            signature={sourceAddressSignature || undefined}
                        />
                        {signError && (
                            <div style={styles.signError}>
                                <div style={styles.signErrorTitle}>
                                    Signing Failed
                                </div>
                                <p style={styles.signErrorText}>
                                    {signError.includes("0x6a81") || signError.includes("ledger")
                                        ? "Your Ledger could not sign the message. Please ensure your Ledger is unlocked, the Solana app is open, and both Phantom and the Ledger Solana app are updated to the latest version."
                                        : signError}
                                </p>
                                <button
                                    className="btn-primary"
                                    onClick={() => setSignError(null)}
                                    style={{ marginTop: "8px" }}
                                >
                                    Try Again
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <p style={styles.disabledText}>
                        Connect your Solana wallet first.
                    </p>
                )}
            </StepCard>

            {/* Step 5: Confirm & Register */}
            <StepCard
                number={5}
                title="Confirm & Register"
                active={current === 5}
                completed={step === "confirmed"}
            >
                {current >= 5 && step === "address_signed" && (
                    <div style={styles.reconnectSection}>
                        <p style={styles.reconnectDescription}>
                            Reconnect your {sourceLabel} wallet to finalize.
                            This will permanently link your wallets for the
                            migration.
                        </p>
                        <SourceWalletConnect
                            onConnect={handleSourceReconnect}
                            onDisconnect={handleSourceReconnectDisconnect}
                            connectedAddress={undefined}
                            connectedChain={undefined}
                            isReconnectStep={true}
                            expectedAddress={sourceAddress}
                            expectedChain={sourceChain}
                        />
                    </div>
                )}
                {current >= 5 && (step === "signing" || step === "error") && (
                    <>
                        <RegistrationProgress
                            sourceAddress={sourceAddress}
                            sourceChain={sourceChain}
                            solanaPubkey={solanaPubkey}
                            sourceAddressSignature={sourceAddressSignature}
                            signatureMethod={signatureMethod}
                            signatureTxData={signatureTxData}
                            ethereumProvider={ethereumProvider}
                            onComplete={handleRegistrationComplete}
                            onError={handleRegistrationError}
                        />
                        {step === "error" && (
                            <button
                                className="btn-secondary"
                                onClick={handleStartOver}
                                style={{
                                    marginTop: "8px",
                                    background: "transparent",
                                    border: `1px solid ${brand.border}`,
                                    color: brand.textSecondary,
                                    padding: "8px 16px",
                                    borderRadius: "10px",
                                    cursor: "pointer",
                                    fontFamily:
                                        "'Plus Jakarta Sans', sans-serif",
                                    fontSize: "13px",
                                }}
                            >
                                Start Over
                            </button>
                        )}
                    </>
                )}
                {current < 5 && (
                    <p style={styles.disabledText}>
                        Complete the previous steps first.
                    </p>
                )}
            </StepCard>

            {step === "confirmed" && (
                <div className="success-banner" style={styles.successBanner}>
                    <div style={styles.successHeader}>
                        <div style={styles.successDot} />
                        <span style={styles.successTitle}>
                            Registration Complete
                        </span>
                    </div>
                    <p style={styles.successText}>
                        Your {sourceLabel}{" "}
                        <code style={styles.code}>{sourceAddress}</code> is
                        now linked to Solana address{" "}
                        <code style={styles.code}>{solanaPubkey}</code>.
                        Your $ARIO tokens, names, and staking positions will
                        be transferred during the migration window. No
                        further action is required.
                    </p>
                    {transactionId && (
                        <span style={styles.txInline}>
                            TX:{" "}
                            <a
                                href={`${ARWEAVE_EXPLORER_URL}/${transactionId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={styles.txInlineLink}
                            >
                                {transactionId.substring(0, 16)}...
                            </a>
                        </span>
                    )}
                    <div style={styles.successActions}>
                        <a
                            href={`#/status/${sourceAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-primary"
                            style={{
                                textDecoration: "none",
                                display: "inline-block",
                                textAlign: "center",
                            }}
                        >
                            View Registration Status
                        </a>
                        <button
                            className="btn-secondary"
                            onClick={handleStartOver}
                        >
                            Register Another Wallet
                        </button>
                        <button
                            className="btn-text"
                            style={{ fontSize: "13px" }}
                            onClick={() => {
                                const count = (() => {
                                    try {
                                        return JSON.parse(
                                            localStorage.getItem(
                                                "ar-io-registered-wallets",
                                            ) || "[]",
                                        ).length;
                                    } catch {
                                        return 1;
                                    }
                                })();
                                const deadline = new Date("2026-06-01T00:00:00Z").getTime();
                                const diff = deadline - Date.now();
                                let urgency = "";
                                if (diff <= 0) {
                                    urgency = "The snapshot window is open NOW";
                                } else {
                                    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                                    if (days > 1) {
                                        urgency = `Only ${days} days left`;
                                    } else {
                                        const hours = Math.floor(diff / (1000 * 60 * 60));
                                        urgency = hours > 1
                                            ? `Only ${hours} hours left`
                                            : "Less than an hour left";
                                    }
                                }
                                const walletText = count > 1
                                    ? `I just registered ${count} wallets`
                                    : "I just registered";
                                const text = encodeURIComponent(
                                    `${walletText} for the @ar_io_network migration to Solana! ${urgency} to register before the snapshot. Don't miss it 👇`,
                                );
                                const url = encodeURIComponent("https://ar.io/solana-migration");
                                window.open(
                                    `https://x.com/intent/tweet?text=${text}&url=${url}`,
                                    "_blank",
                                    "noopener",
                                );
                            }}
                        >
                            Share on X
                        </button>
                    </div>
                </div>
            )}
            </>}
        </div>
    );
}

function StepCard({
    number,
    title,
    active,
    completed,
    children,
}: {
    number: number;
    title: string;
    active: boolean;
    completed: boolean;
    children: React.ReactNode;
}) {
    const styles = getStyles();

    return (
        <div
            className="step-card"
            style={{
                ...styles.stepCard,
                borderColor: active ? brand.primary : brand.border,
                opacity: !active && !completed ? 0.6 : 1,
                boxShadow: active
                    ? '0 4px 20px rgba(84, 39, 200, 0.08)'
                    : '0 1px 3px rgba(35, 35, 45, 0.04)',
            }}
        >
            <div style={styles.stepHeader}>
                <div
                    style={{
                        ...styles.stepNumber,
                        background: completed
                            ? brand.success
                            : active
                              ? brand.primary
                              : brand.cardSurface,
                        color:
                            completed || active
                                ? brand.white
                                : brand.textSecondary,
                    }}
                >
                    {completed ? "\u2713" : number}
                </div>
                <h3 style={styles.stepTitle}>{title}</h3>
            </div>
            <div className="step-content" style={styles.stepContent}>
                {children}
            </div>
        </div>
    );
}

function getStyles(): Record<string, React.CSSProperties> {
    return {
        container: {
            maxWidth: "900px",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: "24px",
        },
        heroImage: {
            width: "100%",
            height: "auto",
            borderRadius: "16px",
            marginBottom: "4px",
        },
        title: {
            fontFamily: "'Besley', Georgia, serif",
            fontSize: "40px",
            fontWeight: 800,
            color: brand.black,
            lineHeight: 1.15,
            margin: 0,
            whiteSpace: "nowrap",
        },
        divider: {
            border: "none",
            borderTop: `1px solid ${brand.border}`,
            margin: "4px 0",
        },
        subtitle: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "17px",
            color: brand.textSecondary,
            lineHeight: 1.7,
            marginTop: "-8px",
        },
        successBanner: {
            background: brand.successBg,
            border: `1px solid ${brand.success}33`,
            borderRadius: "16px",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
        },
        successHeader: {
            display: "flex",
            alignItems: "center",
            gap: "8px",
        },
        successDot: {
            width: "10px",
            height: "10px",
            borderRadius: "50%",
            background: brand.success,
            flexShrink: 0,
        },
        successTitle: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "16px",
            fontWeight: 700,
            color: brand.success,
        },
        successText: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "14px",
            color: brand.textSecondary,
            lineHeight: 1.7,
            margin: 0,
        },
        code: {
            fontFamily: "monospace",
            fontSize: "12px",
            background: "rgba(84, 39, 200, 0.06)",
            padding: "2px 6px",
            borderRadius: "4px",
            wordBreak: "break-all" as const,
            color: brand.black,
        },
        txInline: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "12px",
            color: brand.textTertiary,
        },
        txInlineLink: {
            fontFamily: "monospace",
            fontSize: "12px",
            color: brand.primary,
            textDecoration: "none",
        },
        stepCard: {
            border: `1px solid ${brand.border}`,
            borderRadius: "16px",
            padding: "28px",
            background: `radial-gradient(ellipse 140% 120% at top left, rgba(84, 39, 200, 0.03), transparent), rgba(255, 255, 255, 0.85)`,
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            transition: "border-color 0.2s, opacity 0.2s, box-shadow 0.2s",
        },
        stepHeader: {
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "16px",
        },
        stepNumber: {
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "14px",
            fontWeight: 700,
            flexShrink: 0,
            transition: "background 0.2s",
        },
        stepTitle: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "18px",
            fontWeight: 700,
            color: brand.black,
        },
        stepContent: {
            paddingLeft: "52px",
        },
        signError: {
            padding: "14px 16px",
            background: brand.errorBg,
            border: `1px solid ${brand.error}33`,
            borderRadius: "10px",
            marginTop: "12px",
        },
        signErrorTitle: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "14px",
            fontWeight: 700,
            color: brand.error,
            marginBottom: "4px",
        },
        signErrorText: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "13px",
            color: brand.error,
            lineHeight: 1.5,
            margin: 0,
        },
        checkingRow: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "13px",
            color: brand.textSecondary,
            padding: "8px 0",
        },
        spinner: {
            display: "inline-block",
            width: "14px",
            height: "14px",
            border: `2px solid ${brand.border}`,
            borderTopColor: brand.primary,
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
            flexShrink: 0,
        },
        solanaError: {
            padding: "14px 16px",
            background: brand.errorBg,
            border: `1px solid ${brand.error}33`,
            borderRadius: "10px",
            marginTop: "8px",
        },
        solanaErrorTitle: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "14px",
            fontWeight: 700,
            color: brand.error,
            marginBottom: "4px",
        },
        solanaErrorText: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "13px",
            color: brand.error,
            lineHeight: 1.5,
            margin: 0,
        },
        solanaErrorHint: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "13px",
            color: brand.textSecondary,
            margin: "8px 0 0 0",
            lineHeight: 1.5,
        },
        solanaWarning: {
            padding: "14px 16px",
            background: "#FFF4E6",
            border: "1px solid #F59E0B33",
            borderRadius: "10px",
            marginTop: "8px",
        },
        solanaWarningTitle: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "14px",
            fontWeight: 700,
            color: "#F59E0B",
            marginBottom: "4px",
        },
        solanaWarningText: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "13px",
            color: "#92400E",
            lineHeight: 1.5,
            margin: 0,
        },
        disabledText: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "13px",
            color: brand.textTertiary,
        },
        successActions: {
            display: "flex",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
        },
        reconnectSection: {
            display: "flex",
            flexDirection: "column",
            gap: "16px",
        },
        reconnectDescription: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "14px",
            color: brand.textSecondary,
            lineHeight: 1.6,
            margin: 0,
        },
        closedBanner: {
            background: brand.errorBg,
            border: `1px solid ${brand.error}33`,
            borderRadius: "16px",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
        },
        closedHeader: {
            display: "flex",
            alignItems: "center",
            gap: "8px",
        },
        closedDot: {
            width: "10px",
            height: "10px",
            borderRadius: "50%",
            background: brand.error,
            flexShrink: 0,
        },
        closedTitle: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "16px",
            fontWeight: 700,
            color: brand.error,
        },
        closedText: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "14px",
            color: brand.textSecondary,
            lineHeight: 1.7,
            margin: 0,
        },
    };
}
