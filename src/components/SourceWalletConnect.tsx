import React, { useState } from "react";
import { brand } from "../App.tsx";
import { ArweaveWalletConnect } from "./ArweaveWalletConnect.tsx";
import { EthereumWalletConnect } from "./EthereumWalletConnect.tsx";

type WalletType = "arweave" | "ethereum";

interface SourceWalletConnectProps {
    onConnect: (address: string, chain: WalletType, ethereumProvider?: any) => void;
    onDisconnect: () => void;
    connectedAddress?: string;
    connectedChain?: WalletType;
    isReconnectStep?: boolean;
    expectedAddress?: string;
    expectedChain?: WalletType;
}

export function SourceWalletConnect({
    onConnect,
    onDisconnect,
    connectedAddress,
    connectedChain,
    isReconnectStep = false,
    expectedAddress,
    expectedChain,
}: SourceWalletConnectProps) {
    const [selectedType, setSelectedType] = useState<WalletType>(
        connectedChain || expectedChain || "arweave",
    );
    const [mismatchError, setMismatchError] = useState(false);

    const styles = getStyles();

    // Wrapper function to validate reconnection
    const handleConnect = (address: string, chain: WalletType, provider?: any) => {
        setMismatchError(false);
        if (isReconnectStep && expectedAddress && expectedChain) {
            if (address !== expectedAddress || chain !== expectedChain) {
                setMismatchError(true);
                return;
            }
        }
        onConnect(address, chain, provider);
    };

    // If connected, show the connected wallet regardless of tab
    if (connectedAddress && connectedChain) {
        return (
            <div>
                {isReconnectStep && (
                    <p style={styles.reconnectHint}>
                        Re-connect to the same{" "}
                        {connectedChain === "ethereum" ? "Ethereum" : "Arweave"}{" "}
                        address to finalize the registration:
                        <code style={styles.expectedAddress}>
                            {expectedAddress}
                        </code>
                    </p>
                )}
                {connectedChain === "arweave" ? (
                    <ArweaveWalletConnect
                        onConnect={(addr) => handleConnect(addr, "arweave")}
                        onDisconnect={onDisconnect}
                        connectedAddress={connectedAddress}
                    />
                ) : (
                    <EthereumWalletConnect
                        onConnect={(addr, provider) => handleConnect(addr, "ethereum", provider)}
                        onDisconnect={onDisconnect}
                        connectedAddress={connectedAddress}
                    />
                )}
            </div>
        );
    }

    return (
        <div style={styles.wrapper}>
            {isReconnectStep && expectedAddress && expectedChain && (
                <div style={styles.reconnectMessage}>
                    <div style={styles.reconnectIcon}>🔄</div>
                    <div>
                        <div style={styles.reconnectTitle}>
                            Re-connect Required
                        </div>
                        <div style={styles.reconnectText}>
                            Please reconnect to your{" "}
                            {expectedChain === "ethereum"
                                ? "Ethereum"
                                : "Arweave"}{" "}
                            wallet to confirm the same address:
                        </div>
                        <code style={styles.expectedAddressCode}>
                            {expectedAddress}
                        </code>
                    </div>
                </div>
            )}

            <div style={styles.tabs}>
                <button
                    className={`tab-btn ${selectedType === "arweave" ? "tab-btn--active" : ""}`}
                    style={{
                        ...styles.tab,
                        ...(selectedType === "arweave" ? styles.tabActive : {}),
                    }}
                    onClick={() => setSelectedType("arweave")}
                    disabled={isReconnectStep && expectedChain !== "arweave"}
                >
                    Arweave
                </button>
                <button
                    className={`tab-btn ${selectedType === "ethereum" ? "tab-btn--active" : ""}`}
                    style={{
                        ...styles.tab,
                        ...(selectedType === "ethereum"
                            ? styles.tabActive
                            : {}),
                        ...(isReconnectStep && expectedChain !== "ethereum"
                            ? { opacity: 0.5, cursor: "not-allowed" }
                            : {}),
                    }}
                    onClick={() => setSelectedType("ethereum")}
                    disabled={isReconnectStep && expectedChain !== "ethereum"}
                >
                    Ethereum
                </button>
            </div>

            {mismatchError && expectedAddress && (
                <div style={styles.mismatchError}>
                    <div style={styles.mismatchTitle}>Address Mismatch</div>
                    <div style={styles.mismatchText}>
                        Please reconnect with the same{" "}
                        {expectedChain === "ethereum" ? "Ethereum" : "Arweave"}{" "}
                        wallet used earlier:
                    </div>
                    <code style={styles.expectedAddressCode}>
                        {expectedAddress}
                    </code>
                </div>
            )}

            {selectedType === "arweave" ? (
                <ArweaveWalletConnect
                    onConnect={(addr) => handleConnect(addr, "arweave")}
                    onDisconnect={onDisconnect}
                />
            ) : (
                <EthereumWalletConnect
                    onConnect={(addr, provider) => handleConnect(addr, "ethereum", provider)}
                    onDisconnect={onDisconnect}
                />
            )}
        </div>
    );
}

function getStyles(): Record<string, React.CSSProperties> {
    return {
        wrapper: {
            display: "flex",
            flexDirection: "column",
            gap: "14px",
        },
        reconnectMessage: {
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            padding: "16px",
            background: brand.cardSurface,
            border: `1px solid ${brand.border}`,
            borderRadius: "12px",
        },
        reconnectIcon: {
            display: "none",
        },
        reconnectTitle: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "14px",
            fontWeight: 700,
            color: brand.black,
            marginBottom: "0px",
        },
        reconnectText: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "13px",
            color: brand.textSecondary,
            marginBottom: "4px",
            lineHeight: 1.5,
        },
        expectedAddressCode: {
            fontFamily: "monospace",
            fontSize: "12px",
            color: brand.black,
            background: brand.white,
            padding: "8px 12px",
            borderRadius: "8px",
            border: `1px solid ${brand.border}`,
            display: "block",
            wordBreak: "break-all" as const,
        },
        reconnectHint: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "13px",
            color: brand.textSecondary,
            marginBottom: "12px",
        },
        expectedAddress: {
            fontFamily: "monospace",
            fontSize: "12px",
            color: brand.black,
            background: brand.cardSurface,
            padding: "2px 4px",
            borderRadius: "4px",
            marginLeft: "6px",
        },
        tabs: {
            display: "flex",
            gap: "0",
            borderRadius: "10px",
            overflow: "hidden",
            border: `1px solid ${brand.border}`,
            width: "fit-content",
        },
        tab: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "13px",
            fontWeight: 600,
            padding: "8px 20px",
            border: "none",
            cursor: "pointer",
            background: brand.white,
            color: brand.textSecondary,
            transition: "background 0.15s, color 0.15s",
        },
        tabActive: {
            background: brand.primary,
            color: brand.white,
        },
        mismatchError: {
            padding: "14px 16px",
            background: brand.errorBg,
            border: `1px solid ${brand.error}33`,
            borderRadius: "10px",
        },
        mismatchTitle: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "14px",
            fontWeight: 600,
            color: brand.error,
            marginBottom: "4px",
        },
        mismatchText: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "13px",
            color: brand.error,
            marginBottom: "8px",
        },
    };
}
