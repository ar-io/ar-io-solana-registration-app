/**
 * Snapshot Asset Lookup
 *
 * Returns a wallet's ar.io holdings AS OF THE migration snapshot (2026-06-01) —
 * the frozen values that actually migrate to Solana — instead of the live AO
 * balance, which keeps changing as AO runs and confuses users comparing it to
 * their migrated Solana balance.
 *
 * Drop-in replacement for `lookupLiveAssets`: same `LiveAssetSummary` shape, so
 * the hook and `AssetPreview` are unchanged (plus an extra `withdrawing` field
 * for pending exit-vaults, which the live path never had).
 *
 * Source (`VITE_SNAPSHOT_HOLDINGS_SOURCE`):
 *   - default `/snapshot-holdings.json` — bundled in public/ (self-contained)
 *   - a full `http(s)://…` URL
 *   - a 43-char Arweave tx id — resolved via the app's Arweave gateway(s)
 * Fetched once and cached in-module; lookups are O(1) thereafter.
 */
import type { LiveAssetSummary, VaultInfo } from "./ao-asset-lookup.ts";

export const SNAPSHOT_TIMESTAMP = "2026-06-01T19:14:52.295Z";
export const SNAPSHOT_DATE_LABEL = "June 1, 2026";

interface SnapshotEntry {
    solana?: string | null;
    liquid: string;
    staked: string;
    delegated: string;
    vaulted: string;
    withdrawing: string;
    total: string;
    isGatewayOperator: boolean;
    ownedNameCount: number;
    controlledNameCount: number;
    gatewayFqdn?: string;
    gatewayStatus?: string; // "joined" | "leaving"
    gatewayStakeBoost?: string; // mARIO — flat migration boost (557 operators)
    delegations?: { gateway: string; amountMario: string }[];
    vaults?: { vaultId: string; amountMario: string; endTimestamp: number | null }[];
}

interface SnapshotFile {
    schema: string;
    snapshotTimestamp: string;
    byArweave: Record<string, SnapshotEntry>;
    bySolana: Record<string, SnapshotEntry & { arweave: string[] }>;
}

const SOURCE: string =
    import.meta.env.VITE_SNAPSHOT_HOLDINGS_SOURCE || "/snapshot-holdings.json";
const GATEWAY: string =
    import.meta.env.VITE_ARWEAVE_GATEWAY_URL || "https://arweave.net";
const FALLBACK: string | undefined =
    import.meta.env.VITE_ARWEAVE_FALLBACK_GATEWAY_URL;

/** Resolve the source to one or more fetch URLs (with gateway fallback for tx ids). */
function urlsFor(source: string): string[] {
    if (source.startsWith("/") || source.startsWith("http")) return [source];
    const gateways = FALLBACK ? [GATEWAY, FALLBACK] : [GATEWAY];
    return gateways.map((g) => `${g.replace(/\/+$/, "")}/${source}`);
}

let cache: SnapshotFile | null = null;
let inflight: Promise<SnapshotFile> | null = null;
/** Lazily-built lowercase index of the ETH (0x…) keys, for case-insensitive lookup. */
let ethIndex: Map<string, SnapshotEntry> | null = null;

const ETH_RE = /^0x[0-9a-fA-F]{40}$/;

/**
 * ETH addresses are case-insensitive; the snapshot keys them EIP-55 checksummed.
 * If a wallet passes a differently-cased ETH address, a direct key lookup misses
 * and the user wrongly sees "no assets". Resolve those via a lowercase index.
 */
function ethEntry(snap: SnapshotFile, address: string): SnapshotEntry | undefined {
    if (!ethIndex) {
        ethIndex = new Map();
        for (const [k, v] of Object.entries(snap.byArweave)) {
            if (ETH_RE.test(k)) ethIndex.set(k.toLowerCase(), v);
        }
    }
    return ethIndex.get(address.toLowerCase());
}

async function loadSnapshot(): Promise<SnapshotFile> {
    if (cache) return cache;
    if (inflight) return inflight;
    inflight = (async () => {
        let lastErr: unknown;
        for (const url of urlsFor(SOURCE)) {
            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                cache = (await res.json()) as SnapshotFile;
                return cache;
            } catch (e) {
                lastErr = e;
            }
        }
        throw new Error(
            `Failed to load snapshot holdings from "${SOURCE}": ${
                lastErr instanceof Error ? lastErr.message : String(lastErr)
            }`,
        );
    })().finally(() => {
        inflight = null;
    });
    return inflight;
}

const n = (x: string | undefined): number => Number(x ?? 0);

function toSummary(e: SnapshotEntry): LiveAssetSummary {
    const vaults: VaultInfo[] = (e.vaults ?? []).map((v) => ({
        balance: n(v.amountMario),
        endTimestamp: v.endTimestamp ?? 0,
    }));
    return {
        balance: n(e.liquid),
        gatewayOperator: e.isGatewayOperator,
        gatewayStake: e.isGatewayOperator ? n(e.staked) : undefined,
        gatewayFqdn: e.gatewayFqdn,
        delegationCount: e.delegations?.length ?? 0,
        delegatedStake: n(e.delegated),
        vaults,
        ownedNameCount: e.ownedNameCount,
        controlledNameCount: e.controlledNameCount,
        withdrawing: n(e.withdrawing),
        gatewayStakeBoost: e.gatewayStakeBoost ? n(e.gatewayStakeBoost) : undefined,
        gatewayStatus: e.gatewayStatus,
    };
}

/**
 * Snapshot-based replacement for `lookupLiveAssets`. Looks up by the connected
 * source address (Arweave or ETH). Returns null when the address held nothing
 * migratable at the snapshot.
 */
export async function lookupSnapshotAssets(
    address: string,
): Promise<LiveAssetSummary | null> {
    if (!address) return null;
    const snap = await loadSnapshot();
    // Arweave addresses are case-sensitive (exact match); ETH addresses are not.
    const entry =
        snap.byArweave[address] ??
        (ETH_RE.test(address) ? ethEntry(snap, address) : undefined);
    if (!entry) return null;
    return toSummary(entry);
}
