import React from "react";
import { brand } from "../App.tsx";
import { useAOAssetLookup } from "../hooks/useAOAssetLookup.tsx";

interface AssetPreviewProps {
    sourceAddress: string;
    /** "own" when showing the connected user's assets, "lookup" for status page */
    context?: "own" | "lookup";
}

export function AssetPreview({ sourceAddress, context = "own" }: AssetPreviewProps) {
    const { loading, error, assets } = useAOAssetLookup(sourceAddress);

    const styles = getStyles();

    if (loading) {
        return (
            <div style={styles.loading}>
                <span style={styles.spinner} />
                Looking up your assets on the ar.io network...
            </div>
        );
    }

    if (error) {
        return (
            <div style={styles.errorContainer}>
                <div style={styles.errorTitle}>Unable to look up assets</div>
                <p style={styles.errorText}>{error}</p>
                <p style={styles.errorHint}>
                    You can still proceed with registration. Your assets will
                    be verified during the migration.
                </p>
            </div>
        );
    }

    if (!assets) {
        return null;
    }

    const totalNames = assets.ownedNameCount + assets.controlledNameCount;
    const hasAnyAssets =
        assets.balance > 0 ||
        assets.gatewayOperator ||
        assets.delegationCount > 0 ||
        totalNames > 0 ||
        assets.vaults.length > 0;

    if (!hasAnyAssets) {
        return (
            <div style={styles.emptyContainer}>
                <div style={styles.emptyTitle}>No assets found</div>
                <p style={styles.emptyText}>
                    We didn't find any ar.io assets associated with this
                    address. This could mean:
                </p>
                <ul style={styles.emptyReasons}>
                    <li>The address has no ARIO tokens or ANTs</li>
                    <li>You may be connected with the wrong wallet</li>
                </ul>
                <p style={styles.emptyText}>
                    If you believe this is incorrect, try disconnecting and
                    reconnecting with a different wallet, or contact support.
                </p>
            </div>
        );
    }

    // Build rows — only include items the user actually has
    const rows: { label: string; value: string; sub?: string }[] = [];

    if (assets.balance > 0) {
        rows.push({
            label: "Available Balance",
            value: formatBalance(assets.balance),
        });
    }

    if (assets.gatewayOperator && assets.gatewayStake) {
        rows.push({
            label: "Gateway Stake",
            value: formatBalance(assets.gatewayStake),
            sub: assets.gatewayFqdn || undefined,
        });
    }

    if (assets.delegationCount > 0) {
        rows.push({
            label: "Delegated Stake",
            value: `${formatBalance(assets.delegatedStake)} across ${assets.delegationCount}`,
        });
    }

    if (assets.ownedNameCount > 0) {
        rows.push({
            label: "ANTs Owned",
            value: assets.ownedNameCount.toString(),
        });
    }

    if (assets.controlledNameCount > 0) {
        rows.push({
            label: "ANTs Controlled",
            value: assets.controlledNameCount.toString(),
        });
    }

    const totalVaulted = assets.vaults.reduce((s, v) => s + v.balance, 0);
    if (assets.vaults.length > 0) {
        rows.push({
            label: `Locked Tokens (${assets.vaults.length} vault${assets.vaults.length !== 1 ? "s" : ""})`,
            value: formatBalance(totalVaulted),
        });
    }

    const isOdd = rows.length % 2 !== 0;

    return (
        <div style={styles.wrapper}>
            <div style={styles.header}>
                <span style={styles.headerTitle}>
                    {context === "own"
                        ? "Your Current ar.io Assets"
                        : "Current ar.io Assets"}
                </span>
                <span style={styles.headerNote}>
                    {context === "own"
                        ? "These are your assets right now. At the time of the snapshot, whatever you hold will be migrated to your Solana address."
                        : "Assets held by this address at the time of the snapshot will be migrated."}
                </span>
            </div>
            <div className="asset-grid" style={styles.grid}>
                {rows.map((row, i) => (
                    <div
                        key={row.label}
                        style={{
                            ...styles.cell,
                            ...(isOdd && i === rows.length - 1
                                ? { gridColumn: "1 / -1" }
                                : {}),
                        }}
                    >
                        <span style={styles.cellLabel}>{row.label}</span>
                        <span style={styles.cellValue}>{row.value}</span>
                        {row.sub && (
                            <span style={styles.cellSub}>{row.sub}</span>
                        )}
                    </div>
                ))}
            </div>

            {assets.vaults.length > 0 && (
                <p style={styles.vaultNote}>
                    Locked tokens will remain locked on Solana with the same
                    unlock schedule.
                </p>
            )}
        </div>
    );
}

function formatBalance(mario: number): string {
    const ario = mario / 1_000_000;
    return (
        ario.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 6,
        }) + " ARIO"
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
        loading: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "14px",
            color: brand.textSecondary,
            padding: "8px 0",
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
        errorContainer: {
            background: brand.errorBg,
            borderRadius: "10px",
            padding: "14px 16px",
        },
        errorTitle: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "14px",
            fontWeight: 700,
            color: brand.error,
            marginBottom: "6px",
        },
        errorText: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "13px",
            color: brand.error,
            margin: 0,
            lineHeight: 1.5,
        },
        errorHint: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "13px",
            color: brand.textSecondary,
            margin: "8px 0 0 0",
            lineHeight: 1.5,
        },
        emptyContainer: {
            background: brand.cardSurface,
            borderRadius: "10px",
            padding: "16px",
        },
        emptyTitle: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "14px",
            fontWeight: 700,
            color: brand.black,
            marginBottom: "6px",
        },
        emptyText: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "13px",
            color: brand.textSecondary,
            margin: 0,
            lineHeight: 1.6,
        },
        emptyReasons: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "13px",
            color: brand.textSecondary,
            lineHeight: 1.6,
            paddingLeft: "18px",
            margin: "8px 0",
        },
        grid: {
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1px",
            background: brand.border,
            borderRadius: "12px",
            overflow: "hidden",
            border: `1px solid ${brand.border}`,
        },
        cell: {
            display: "flex",
            flexDirection: "column",
            gap: "5px",
            padding: "16px 18px",
            background: brand.cardSurface,
        },
        cellLabel: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "11px",
            fontWeight: 700,
            color: brand.textTertiary,
            textTransform: "uppercase" as const,
            letterSpacing: "0.8px",
        },
        cellValue: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "17px",
            fontWeight: 800,
            color: brand.black,
        },
        cellSub: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "12px",
            color: brand.textTertiary,
            marginTop: "2px",
        },
        vaultNote: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "12px",
            color: brand.textTertiary,
            margin: 0,
            fontStyle: "italic",
        },
    };
}
