import React from "react";
import { brand } from "../App.tsx";
import { useAOAssetLookup } from "../hooks/useAOAssetLookup.tsx";
import { SNAPSHOT_DATE_LABEL } from "../services/snapshot-asset-lookup.ts";

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
                Loading your snapshot holdings...
            </div>
        );
    }

    if (error) {
        return (
            <div style={styles.errorContainer}>
                <div style={styles.errorTitle}>Unable to look up assets</div>
                <p style={styles.errorText}>{error}</p>
                <p style={styles.errorHint}>
                    This is usually temporary — please try again in a moment.
                </p>
            </div>
        );
    }

    if (!assets) {
        return (
            <div style={styles.wrapper}>
                <div style={styles.emptyContainer}>
                    <div style={styles.emptyTitle}>No assets at the snapshot</div>
                    <p style={styles.emptyText}>
                        We didn't find any ar.io assets for this address in the
                        migration snapshot ({SNAPSHOT_DATE_LABEL}). This could mean:
                    </p>
                    <ul style={styles.emptyReasons}>
                        <li>
                            The address held no ARIO, ArNS names, or stake at the
                            snapshot
                        </li>
                        <li>
                            The assets were acquired after the snapshot — only
                            snapshot holdings migrate
                        </li>
                        <li>This isn't the address that held your assets</li>
                    </ul>
                    <p style={styles.emptyText}>
                        Double-check you're using the Arweave, Ethereum, or Solana
                        address that held your assets at the snapshot.
                    </p>
                </div>
            </div>
        );
    }

    const totalNames = assets.ownedNameCount + assets.controlledNameCount;
    const isExitingGateway =
        !!assets.gatewayFqdn && assets.gatewayStatus === "leaving";
    const hasAnyAssets =
        assets.balance > 0 ||
        assets.gatewayOperator ||
        assets.delegationCount > 0 ||
        totalNames > 0 ||
        assets.vaults.length > 0 ||
        (assets.withdrawing ?? 0) > 0 ||
        (assets.gatewayStakeBoost ?? 0) > 0 ||
        isExitingGateway;

    if (!hasAnyAssets) {
        return (
            <div style={styles.emptyContainer}>
                <div style={styles.emptyTitle}>No assets at the snapshot</div>
                <p style={styles.emptyText}>
                    We didn't find any ar.io assets for this address in the
                    migration snapshot ({SNAPSHOT_DATE_LABEL}). This could mean:
                </p>
                <ul style={styles.emptyReasons}>
                    <li>
                        The address held no ARIO, ArNS names, or stake at the
                        snapshot
                    </li>
                    <li>
                        The assets were acquired after the snapshot — only
                        snapshot holdings migrate
                    </li>
                    <li>This isn't the address that held your assets</li>
                </ul>
                <p style={styles.emptyText}>
                    Double-check you're using the Arweave, Ethereum, or Solana
                    address that held your assets at the snapshot.
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

    if ((assets.gatewayStakeBoost ?? 0) > 0) {
        rows.push({
            label: "Migration Boost",
            value: `+${formatBalance(assets.gatewayStakeBoost ?? 0)}`,
            sub: "added to your gateway stake on Solana",
        });
    }

    if (assets.delegationCount > 0) {
        rows.push({
            label: "Delegated Stake",
            value: `${formatBalance(assets.delegatedStake)} across ${assets.delegationCount}`,
        });
    }

    // Leaving gateways have no operator stake (it has moved into exit-vaults),
    // so the Gateway Stake row above won't render — surface the exit explicitly
    // so the operator understands why their stake shows as a pending withdrawal.
    if (isExitingGateway) {
        rows.push({
            label: "Gateway",
            value: "Exiting",
            sub: assets.gatewayFqdn || undefined,
        });
    }

    if ((assets.withdrawing ?? 0) > 0) {
        rows.push({
            label: "Pending Withdrawals",
            value: formatBalance(assets.withdrawing ?? 0),
            sub: "gateway or delegation stake being withdrawn",
        });
    }

    if (assets.ownedNameCount > 0) {
        rows.push({
            label: "ArNS Names Owned",
            value: assets.ownedNameCount.toString(),
        });
    }

    if (assets.controlledNameCount > 0) {
        rows.push({
            label: "ArNS Names Controlled",
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

    const claimDirect = !!assets.registeredSolana;

    return (
        <div style={styles.wrapper}>
            <div style={styles.header}>
                <span style={styles.headerTitle}>
                    {context === "own"
                        ? "Your ar.io Assets at the Snapshot"
                        : "ar.io Assets at the Snapshot"}
                </span>
                <span style={styles.headerNote}>
                    {context === "own"
                        ? `These are your holdings captured at the migration snapshot (${SNAPSHOT_DATE_LABEL}) — exactly what migrates to your Solana address. Activity on AO after the snapshot is not reflected here.`
                        : `Holdings captured at the migration snapshot (${SNAPSHOT_DATE_LABEL}) — exactly what migrates to Solana.`}
                </span>
            </div>

            {claimDirect ? (
                <div style={styles.claimBanner}>
                    <div style={styles.claimDot} />
                    <div style={styles.claimContent}>
                        <span style={styles.claimTitle}>Migrated to Solana</span>
                        <span style={styles.claimText}>
                            These assets have been delivered to{" "}
                            <code style={styles.claimAddress}>
                                {assets.registeredSolana}
                            </code>
                            . No further action is required.
                        </span>
                    </div>
                </div>
            ) : (
                <div style={styles.escrowBanner}>
                    <div style={styles.escrowDot} />
                    <div style={styles.escrowContent}>
                        <span style={styles.escrowTitle}>
                            Escrow — Claimable Soon
                        </span>
                        <span style={styles.escrowText}>
                            This address was not registered before the snapshot.
                            These assets are held in escrow and will be available
                            to claim once the escrow process opens.
                        </span>
                    </div>
                </div>
            )}

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
            // Match the static info-card shadow used elsewhere (e.g. StatusPage
            // result card) so the panel reads as the same kind of surface.
            boxShadow: "0 1px 3px rgba(35, 35, 45, 0.04)",
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
        claimBanner: {
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
            padding: "12px 14px",
            background: brand.successBg,
            border: `1px solid ${brand.success}33`,
            borderRadius: "10px",
        },
        claimDot: {
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: brand.success,
            flexShrink: 0,
            marginTop: "4px",
        },
        claimContent: {
            display: "flex",
            flexDirection: "column" as const,
            gap: "2px",
        },
        claimTitle: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "13px",
            fontWeight: 700,
            color: brand.success,
        },
        claimText: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "12px",
            color: brand.textSecondary,
            lineHeight: 1.5,
        },
        claimAddress: {
            fontFamily: "monospace",
            fontSize: "11px",
            background: "rgba(26, 135, 84, 0.08)",
            padding: "1px 5px",
            borderRadius: "4px",
            wordBreak: "break-all" as const,
            color: brand.black,
        },
        escrowBanner: {
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
            padding: "12px 14px",
            background: "#FFF8EC",
            border: "1px solid #F59E0B33",
            borderRadius: "10px",
        },
        escrowDot: {
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: "#F59E0B",
            flexShrink: 0,
            marginTop: "4px",
        },
        escrowContent: {
            display: "flex",
            flexDirection: "column" as const,
            gap: "2px",
        },
        escrowTitle: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "13px",
            fontWeight: 700,
            color: "#B45309",
        },
        escrowText: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "12px",
            color: brand.textSecondary,
            lineHeight: 1.5,
        },
    };
}
