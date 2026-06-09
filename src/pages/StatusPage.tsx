import React, { useState } from "react";
import { brand } from "../App.tsx";
import { ARWEAVE_EXPLORER_URL } from "../services/arweave-graphql.ts";
import { AssetPreview } from "../components/AssetPreview.tsx";
import { MigrationStats } from "../components/MigrationStats.tsx";
import { SnapshotDownload } from "../components/SnapshotDownload.tsx";
import { useAttestationStatus } from "../hooks/useAttestationStatus.tsx";

function detectChain(address: string): "arweave" | "ethereum" | "solana" {
    if (/^0x[0-9a-fA-F]{40}$/.test(address)) return "ethereum";
    // Solana: base58, 32-44 chars, no lowercase 'l', 'I', 'O', '0' in base58
    // but simplest heuristic: Arweave is always 43 chars base64url
    if (address.length === 43 && /^[a-zA-Z0-9_-]+$/.test(address))
        return "arweave";
    // If it's base58-ish and not Arweave length, likely Solana
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return "solana";
    return "arweave";
}

export function StatusPage({
    sourceAddress: initialAddress,
}: {
    sourceAddress?: string;
}) {
    const [address, setAddress] = useState(initialAddress || "");
    const [lookupAddress, setLookupAddress] = useState(initialAddress || "");

    const styles = getStyles();

    const chain = detectChain(lookupAddress);
    const {
        loading,
        registered,
        solanaPubkey,
        registeredSourceAddress,
        txId,
        registeredAt,
        error,
    } = useAttestationStatus(lookupAddress, chain);

    const handleLookup = (e: React.FormEvent) => {
        e.preventDefault();
        setLookupAddress(address.trim());
        window.location.hash = `/status/${address.trim()}`;
    };

    return (
        <div style={styles.container}>
            <h2 style={styles.title}>Registration Status</h2>
            <p style={styles.subtitle}>
                Check the registration status for an Arweave, Ethereum, or
                Solana address.
            </p>

            <form
                onSubmit={handleLookup}
                className="status-form"
                style={styles.form}
            >
                <input
                    type="text"
                    className="input"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Enter Arweave, Ethereum or Solana address..."
                    style={{ flex: 1 }}
                />
                <button
                    type="submit"
                    className="btn-primary"
                    disabled={!address.trim()}
                >
                    Look Up
                </button>
            </form>

            {/* Landing state: global "by the numbers" until a specific lookup runs */}
            {!lookupAddress && <MigrationStats />}

            {lookupAddress && (
                <div style={styles.resultCard}>
                    <div style={styles.resultHeader}>
                        <span style={styles.label}>
                            {chain === "ethereum"
                                ? "Ethereum Address"
                                : chain === "solana"
                                  ? "Solana Address"
                                  : "Arweave Address"}
                        </span>
                        <code style={styles.addressCode}>{lookupAddress}</code>
                    </div>

                    {loading && (
                        <div style={styles.loadingRow}>
                            <span style={styles.spinner} />
                            Checking status...
                        </div>
                    )}

                    {error && (
                        <div style={styles.errorRow}>
                            Failed to fetch status: {error}
                        </div>
                    )}

                    {!loading && !error && (
                        <div style={styles.statusBody}>
                            <div style={styles.statusRow}>
                                <span style={styles.label}>Registered</span>
                                <span
                                    style={{
                                        ...styles.statusValue,
                                        color: registered
                                            ? brand.success
                                            : brand.textTertiary,
                                    }}
                                >
                                    {registered ? "Yes" : "Not yet"}
                                </span>
                            </div>

                            {registered && solanaPubkey && (
                                <>
                                    {chain === "solana" && registeredSourceAddress && (
                                        <div style={styles.statusRow}>
                                            <span style={styles.label}>
                                                Source Address
                                            </span>
                                            <code style={styles.addressCode}>
                                                {registeredSourceAddress}
                                            </code>
                                        </div>
                                    )}
                                    {chain !== "solana" && (
                                        <div style={styles.statusRow}>
                                            <span style={styles.label}>
                                                Solana Address
                                            </span>
                                            <code style={styles.addressCode}>
                                                {solanaPubkey}
                                            </code>
                                        </div>
                                    )}
                                    {txId && (
                                        <div style={styles.statusRow}>
                                            <span style={styles.label}>
                                                Registration TX
                                            </span>
                                            <a
                                                href={`${ARWEAVE_EXPLORER_URL}/${txId}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={styles.txLink}
                                            >
                                                {txId}
                                            </a>
                                        </div>
                                    )}
                                    {registeredAt && (
                                        <div style={styles.statusRow}>
                                            <span style={styles.label}>
                                                Registered At
                                            </span>
                                            <span style={styles.statusValue}>
                                                {new Date(
                                                    registeredAt,
                                                ).toLocaleString()}
                                            </span>
                                        </div>
                                    )}
                                </>
                            )}

                            {!registered && (
                                <div>
                                    <p style={styles.notRegistered}>
                                        This address has not been registered yet.{" "}
                                        <a href="#/" style={styles.registerLink}>
                                            Register for migration
                                        </a>
                                    </p>
                                    <p style={styles.indexingNote}>
                                        If you just registered, it may take a few
                                        minutes for your registration to appear.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {lookupAddress && !loading && !error && (
                <>
                    <AssetPreview
                        sourceAddress={
                            chain === "solana" && registeredSourceAddress
                                ? registeredSourceAddress
                                : lookupAddress
                        }
                        context="lookup"
                    />
                    <SnapshotDownload
                        address={
                            chain === "solana" && registeredSourceAddress
                                ? registeredSourceAddress
                                : lookupAddress
                        }
                    />
                </>
            )}
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
        title: {
            fontFamily: "'Besley', Georgia, serif",
            fontSize: "40px",
            fontWeight: 800,
            color: brand.black,
        },
        subtitle: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "16px",
            color: brand.textSecondary,
            lineHeight: 1.7,
        },
        form: {
            display: "flex",
            gap: "8px",
        },
        resultCard: {
            border: `1px solid ${brand.border}`,
            borderRadius: "16px",
            background: brand.white,
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(35, 35, 45, 0.04)",
        },
        resultHeader: {
            padding: "18px 22px",
            borderBottom: `1px solid ${brand.border}`,
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            background: brand.cardSurface,
        },
        label: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "11px",
            fontWeight: 700,
            color: brand.textTertiary,
            textTransform: "uppercase" as const,
            letterSpacing: "0.8px",
        },
        addressCode: {
            fontFamily: "monospace",
            fontSize: "13px",
            color: brand.black,
            wordBreak: "break-all" as const,
        },
        loadingRow: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            padding: "22px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            color: brand.textSecondary,
            fontSize: "14px",
        },
        spinner: {
            display: "inline-block",
            width: "16px",
            height: "16px",
            border: `2px solid ${brand.border}`,
            borderTopColor: brand.primary,
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
        },
        errorRow: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            padding: "18px 22px",
            color: brand.error,
            fontSize: "14px",
        },
        statusBody: {
            padding: "18px 22px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
        },
        statusRow: {
            display: "flex",
            flexDirection: "column",
            gap: "4px",
        },
        statusValue: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "14px",
            fontWeight: 700,
        },
        txLink: {
            fontFamily: "monospace",
            fontSize: "12px",
            color: brand.primary,
            wordBreak: "break-all" as const,
            textDecoration: "underline",
        },
        notRegistered: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "14px",
            color: brand.textSecondary,
            lineHeight: 1.6,
        },
        registerLink: {
            color: brand.primary,
            textDecoration: "underline",
            fontWeight: 600,
        },
        indexingNote: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "12px",
            color: brand.textTertiary,
            marginTop: "8px",
            fontStyle: "italic",
        },
    };
}
