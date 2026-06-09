/**
 * Live Asset Lookup via AR.IO SDK (AO Backend)
 *
 * Queries the live AO network for a user's current ARIO holdings:
 * balance, gateway status, delegations, and ArNS names.
 * Uses 5 parallel calls via Promise.allSettled to minimize latency
 * and gracefully handle individual call failures.
 */

import { ARIO, ANTRegistry } from "@ar.io/sdk/web";
import type { AoARIORead, AoANTRegistryRead } from "@ar.io/sdk/web";

export interface VaultInfo {
    balance: number; // mARIO
    endTimestamp: number; // unix seconds — when vault unlocks
}

export interface LiveAssetSummary {
    balance: number; // mARIO — unlocked/transferable tokens
    gatewayOperator: boolean;
    gatewayStake?: number; // mARIO, if operator
    gatewayFqdn?: string; // e.g. "vilenarios.ar-io.dev"
    delegationCount: number;
    delegatedStake: number; // mARIO — active stake across delegations
    vaults: VaultInfo[]; // personal locked token vaults
    ownedNameCount: number; // ArNS names where address is ANT owner
    controlledNameCount: number; // ArNS names where address is ANT controller (not owner)
    withdrawing?: number; // mARIO — pending operator/delegate exit-vaults (snapshot source only)
    gatewayStakeBoost?: number; // mARIO — flat migration boost added to operator stake (snapshot source only)
    gatewayStatus?: string; // "joined" | "leaving" — gateway lifecycle state at snapshot (snapshot source only)
    registeredSolana?: string | null; // Solana destination registered before snapshot (null = escrow)
}

let arioInstance: AoARIORead | null = null;
let antRegistryInstance: AoANTRegistryRead | null = null;

function getARIO(): AoARIORead {
    if (!arioInstance) {
        // AO backend — queries the live AR.IO mainnet process via cu.ardrive.io
        arioInstance = ARIO.mainnet();
    }
    return arioInstance;
}

function getANTRegistry(): AoANTRegistryRead {
    if (!antRegistryInstance) {
        antRegistryInstance = ANTRegistry.init();
    }
    return antRegistryInstance;
}

/** In-memory cache: address → { result, timestamp } */
const assetCache = new Map<
    string,
    { result: LiveAssetSummary | null; ts: number }
>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** In-flight deduplication: address → pending promise */
const inflight = new Map<string, Promise<LiveAssetSummary | null>>();

/**
 * Look up a user's live AR.IO assets on the AO network.
 *
 * Results are cached for 5 minutes per address. Concurrent requests
 * for the same address share a single in-flight promise (deduped).
 */
export async function lookupLiveAssets(
    address: string,
): Promise<LiveAssetSummary | null> {
    // Return cached result if fresh
    const cached = assetCache.get(address);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
        return cached.result;
    }

    // Deduplicate concurrent requests for the same address
    const existing = inflight.get(address);
    if (existing) return existing;

    const promise = fetchLiveAssets(address).finally(() => {
        inflight.delete(address);
    });
    inflight.set(address, promise);
    return promise;
}

async function fetchLiveAssets(
    address: string,
): Promise<LiveAssetSummary | null> {
    const ario = getARIO();
    const antRegistry = getANTRegistry();

    const [
        balanceResult,
        gatewayResult,
        delegationsResult,
        aclResult,
        vaultsResult,
    ] = await Promise.allSettled([
        ario.getBalance({ address }),
        ario.getGateway({ address }),
        ario.getDelegations({ address, limit: 100 }),
        antRegistry.accessControlList({ address }),
        ario.getVaults({ filters: { address: [address] }, limit: 100 }),
    ]);

    // If every call failed, surface the error
    if (
        balanceResult.status === "rejected" &&
        gatewayResult.status === "rejected" &&
        delegationsResult.status === "rejected" &&
        aclResult.status === "rejected" &&
        vaultsResult.status === "rejected"
    ) {
        throw new Error(
            "Unable to reach the ar.io network. Please try again later.",
        );
    }

    const balance =
        balanceResult.status === "fulfilled" ? balanceResult.value : 0;

    let gatewayOperator = false;
    let gatewayStake: number | undefined;
    let gatewayFqdn: string | undefined;
    if (gatewayResult.status === "fulfilled" && gatewayResult.value) {
        gatewayOperator = true;
        gatewayStake = gatewayResult.value.operatorStake;
        gatewayFqdn = gatewayResult.value.settings?.fqdn;
    }

    let delegationCount = 0;
    let delegatedStake = 0;
    if (delegationsResult.status === "fulfilled") {
        delegationCount = delegationsResult.value.totalItems ?? 0;
        // Sum only active stake delegations (type: 'stake')
        delegatedStake = delegationsResult.value.items.reduce(
            (sum: number, d: any) =>
                sum + (d.type === "vault" ? 0 : (d.balance ?? d.delegatedStake ?? 0)),
            0,
        );
    }

    let ownedNameCount = 0;
    let controlledNameCount = 0;
    if (aclResult.status === "fulfilled") {
        const { Owned = [], Controlled = [] } = aclResult.value;
        ownedNameCount = Owned.length;
        // Controlled includes all ANTs where address is a controller,
        // but some of those the address also owns — only count the
        // ones that are purely controlled (not owned).
        const ownedSet = new Set(Owned);
        controlledNameCount = Controlled.filter((id) => !ownedSet.has(id)).length;
    }

    const vaults: VaultInfo[] = [];
    if (vaultsResult.status === "fulfilled") {
        for (const v of vaultsResult.value.items) {
            vaults.push({
                balance: v.balance,
                endTimestamp: v.endTimestamp,
            });
        }
    }

    const result: LiveAssetSummary = {
        balance,
        gatewayOperator,
        gatewayStake,
        gatewayFqdn,
        delegationCount,
        delegatedStake,
        vaults,
        ownedNameCount,
        controlledNameCount,
    };

    assetCache.set(address, { result, ts: Date.now() });
    return result;
}
