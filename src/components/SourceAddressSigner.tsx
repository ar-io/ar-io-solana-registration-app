import React, { useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { brand } from "../App.tsx";

export type SignatureMethod = "message" | "transaction";

interface SourceAddressSignerProps {
    sourceAddress: string;
    sourceChain: "arweave" | "ethereum";
    onSigned: (signature: string, method: SignatureMethod, txData?: string) => void;
    onError: (error: Error) => void;
    signature?: string;
}

export function SourceAddressSigner({
    sourceAddress,
    sourceChain,
    onSigned,
    onError,
    signature,
}: SourceAddressSignerProps) {
    const { publicKey, signMessage, signTransaction } = useWallet();
    const { connection } = useConnection();
    const [signing, setSigning] = useState(false);
    const [signingStatus, setSigningStatus] = useState("");

    const styles = getStyles();

    const handleSignAddress = useCallback(async () => {
        if (!publicKey) {
            onError(new Error("Solana wallet not properly connected"));
            return;
        }

        setSigning(true);
        setSigningStatus("Waiting for wallet approval...");
        try {
            const message = new TextEncoder().encode(sourceAddress);
            const bs58 = await import("bs58");

            // Try signMessage first (works for software wallets)
            if (signMessage) {
                try {
                    const signedMessage = await Promise.race([
                        signMessage(message),
                        new Promise<never>((_, reject) =>
                            setTimeout(
                                () => reject(new Error("TIMEOUT")),
                                60000,
                            ),
                        ),
                    ]);

                    // Validate non-empty
                    if (
                        !signedMessage ||
                        signedMessage.length === 0 ||
                        signedMessage.every((b: number) => b === 0)
                    ) {
                        throw new Error(
                            "Wallet returned an empty or invalid signature.",
                        );
                    }

                    // Verify the signature is cryptographically valid
                    const { verify } = await import("@noble/ed25519");
                    const isValid = await verify(
                        signedMessage,
                        message,
                        publicKey.toBytes(),
                    );
                    if (!isValid) {
                        throw new Error(
                            "Signature verification failed. The wallet returned bytes that are not a valid signature for this message.",
                        );
                    }

                    const signatureBase58 =
                        bs58.default.encode(signedMessage);
                    console.log("signMessage succeeded, verified");
                    onSigned(signatureBase58, "message");
                    return;
                } catch (msgErr: any) {
                    const errStr = msgErr?.message ?? String(msgErr);
                    // User explicitly rejected — don't retry
                    const isUserRejection =
                        errStr.includes("User rejected") ||
                        errStr.includes("user rejected") ||
                        errStr.includes("denied") ||
                        (msgErr?.code === 4001);

                    // Known hardware wallet errors + generic signMessage failures
                    // that could be Ledger-related
                    const canFallback =
                        !isUserRejection &&
                        signTransaction != null &&
                        (errStr.includes("0x6a81") ||
                         errStr.includes("ledgerUnknownSignError") ||
                         errStr.includes("Ledger device") ||
                         errStr.includes("Ledger Sign Error") ||
                         msgErr?.name === "WalletSignMessageError");

                    console.warn(
                        "signMessage failed:",
                        errStr || msgErr?.name || "(unknown)",
                        canFallback ? "— trying signTransaction fallback" : "",
                    );
                    if (!canFallback) throw msgErr;
                    // Fall through to signTransaction
                }
            }

            // Fallback: signTransaction with memo (works on Ledger)
            if (!signTransaction) {
                throw new Error(
                    "Your wallet does not support message signing or transaction signing.",
                );
            }

            setSigningStatus("Hardware wallet detected. Preparing transaction for your device...");
            console.log("Using signTransaction fallback for hardware wallet");
            // Brief pause so the user sees the status before the wallet popup
            await new Promise((r) => setTimeout(r, 1500));
            const { Transaction, TransactionInstruction, PublicKey } =
                await import("@solana/web3.js");

            const MEMO_PROGRAM_ID = new PublicKey(
                "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
            );

            const memoData = `ar.io-registration:${sourceAddress}`;
            const memoIx = new TransactionInstruction({
                keys: [],
                programId: MEMO_PROGRAM_ID,
                data: Buffer.from(memoData, "utf-8"),
            });

            const { blockhash } =
                await connection.getLatestBlockhash("finalized");

            // IMPORTANT: Must use legacy Transaction (not VersionedTransaction).
            // The verifier parses the legacy 3-byte header format. Changing
            // to v0 messages would break verification.
            const tx = new Transaction();
            tx.recentBlockhash = blockhash;
            tx.feePayer = publicKey;
            tx.add(memoIx);

            setSigningStatus("Approve the transaction on your device. This will not send any tokens.");
            const signedTx = await signTransaction(tx);
            const txSig = signedTx.signatures[0];

            if (!txSig || !txSig.signature) {
                throw new Error(
                    "Hardware wallet did not produce a signature. Please ensure your Ledger is unlocked and the Solana app is open.",
                );
            }

            // Verify the transaction signature before accepting
            const txMessageBytes = signedTx.serializeMessage();
            const { verify } = await import("@noble/ed25519");
            const isTxValid = await verify(
                txSig.signature,
                txMessageBytes,
                publicKey.toBytes(),
            );
            if (!isTxValid) {
                throw new Error(
                    "Transaction signature verification failed. The hardware wallet may not have signed correctly.",
                );
            }

            const signatureBase58 = bs58.default.encode(txSig.signature);
            // Encode as base64url: "+" chars in standard base64 get form-decoded
            // to spaces somewhere in the upload pipeline, which corrupts the
            // stored tag. base64url's URL-safe alphabet (-, _) survives intact.
            // Node's base64 decoder accepts both alphabets, so the verifier
            // reads either form transparently.
            const txData = Buffer.from(txMessageBytes)
                .toString("base64")
                .replace(/\+/g, "-")
                .replace(/\//g, "_");

            console.log("signTransaction fallback succeeded, verified");
            onSigned(signatureBase58, "transaction", txData);
        } catch (error) {
            onError(
                error instanceof Error
                    ? error
                    : new Error("Failed to sign with Solana wallet."),
            );
        } finally {
            setSigning(false);
            setSigningStatus("");
        }
    }, [sourceAddress, publicKey, signMessage, signTransaction, connection, onSigned, onError]);

    // Show completed state if we have a signature
    if (signature) {
        return (
            <div style={styles.completed}>
                <div style={styles.completedHeader}>
                    <div style={styles.successDot} />
                    <span style={styles.completedLabel}>
                        Solana Authorization Complete
                    </span>
                </div>
                <div style={styles.proofDetails}>
                    <div style={styles.proofRow}>
                        <span style={styles.proofLabel}>
                            Linked Address:
                        </span>
                        <code style={styles.proofValue}>{sourceAddress}</code>
                    </div>
                    <div style={styles.proofRow}>
                        <span style={styles.proofLabel}>Solana Signature:</span>
                        <code style={styles.proofValue}>
                            {signature.substring(0, 20)}...
                            {signature.substring(signature.length - 20)}
                        </code>
                    </div>
                    <div style={styles.proofRow}>
                        <span style={styles.proofLabel}>Signed By:</span>
                        <code style={styles.proofValue}>
                            {publicKey?.toBase58()}
                        </code>
                    </div>
                </div>
            </div>
        );
    }

    const chainLabel = sourceChain === "ethereum" ? "Ethereum" : "Arweave";

    return (
        <div style={styles.wrapper}>
            <p style={styles.description}>
                Sign with your Solana wallet to prove you own it. This
                links your {chainLabel} address to your Solana address for
                the migration.
            </p>

            <div style={styles.addressInfo}>
                <span style={styles.addressLabel}>
                    {chainLabel} Address to Authorize:
                </span>
                <code style={styles.addressValue}>{sourceAddress}</code>
            </div>

            <div style={styles.walletInfo}>
                <span style={styles.walletLabel}>
                    Signing with Solana Wallet:
                </span>
                <code style={styles.walletValue}>
                    {publicKey?.toBase58() || "Not connected"}
                </code>
            </div>

            <button
                className="btn-primary"
                onClick={handleSignAddress}
                disabled={signing || !publicKey}
                style={{
                    opacity: signing || !publicKey ? 0.5 : 1,
                    cursor: signing || !publicKey ? "not-allowed" : "pointer",
                }}
            >
                {signing ? "Signing..." : "Authorize with Solana"}
            </button>

            {signingStatus && (
                <p style={styles.signingStatus}>{signingStatus}</p>
            )}

            {!signing && (
                <p style={styles.hint}>
                    Your wallet will ask you to sign a message. This does not
                    send any tokens.
                </p>
            )}
        </div>
    );
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
        addressInfo: {
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            padding: "12px",
            background: brand.cardSurface,
            borderRadius: "10px",
            border: `1px solid ${brand.border}`,
        },
        addressLabel: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "12px",
            fontWeight: 600,
            color: brand.textSecondary,
        },
        addressValue: {
            fontFamily: "monospace",
            fontSize: "13px",
            color: brand.black,
            wordBreak: "break-all" as const,
        },
        walletInfo: {
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            padding: "12px",
            background: brand.lavender,
            borderRadius: "10px",
            border: `1px solid ${brand.primary}33`,
        },
        walletLabel: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "12px",
            fontWeight: 600,
            color: brand.primary,
        },
        walletValue: {
            fontFamily: "monospace",
            fontSize: "13px",
            color: brand.black,
            wordBreak: "break-all" as const,
        },
        signingStatus: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "13px",
            fontWeight: 500,
            color: brand.primary,
            margin: 0,
        },
        hint: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "12px",
            color: brand.textTertiary,
            margin: 0,
            textAlign: "center" as const,
        },
        completed: {
            display: "flex",
            flexDirection: "column",
            gap: "12px",
        },
        completedHeader: {
            display: "flex",
            alignItems: "center",
            gap: "10px",
        },
        successDot: {
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: brand.success,
            flexShrink: 0,
        },
        completedLabel: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "14px",
            fontWeight: 600,
            color: brand.success,
        },
        proofDetails: {
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            padding: "12px",
            background: brand.successBg,
            borderRadius: "10px",
            border: `1px solid ${brand.success}33`,
        },
        proofRow: {
            display: "flex",
            flexDirection: "column",
            gap: "2px",
        },
        proofLabel: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "11px",
            fontWeight: 700,
            color: brand.textTertiary,
            textTransform: "uppercase" as const,
            letterSpacing: "0.8px",
        },
        proofValue: {
            fontFamily: "monospace",
            fontSize: "12px",
            color: brand.black,
            wordBreak: "break-all" as const,
        },
    };
}
