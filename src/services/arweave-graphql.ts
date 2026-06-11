/**
 * Arweave GraphQL Client
 *
 * Queries an Arweave gateway for AR-IO-Migration attestation data items.
 */

const GATEWAY_URL =
    import.meta.env.VITE_ARWEAVE_GATEWAY_URL || "https://turbo-gateway.com";

const FALLBACK_GATEWAY_URL =
    import.meta.env.VITE_ARWEAVE_FALLBACK_GATEWAY_URL ||
    "https://arweave-search.goldsky.com";

export const ARWEAVE_EXPLORER_URL =
    import.meta.env.VITE_ARWEAVE_EXPLORER_URL ||
    "https://turbo-gateway.com";

/** Protocol-level app name tag used on all attestation data items. */
export const ATTESTATION_APP_NAME =
    import.meta.env.VITE_ATTESTATION_APP_NAME || "AR-IO-Solana-Registration";

const QUERY_TIMEOUT_MS = 15_000;

export interface AttestationResult {
    txId: string;
    sourceAddress: string;
    solanaPubkey: string;
    sourceChain: "arweave" | "ethereum";
    timestamp: number; // seconds since epoch (from Timestamp tag)
    solanaSignature?: string;
    signatureMethod?: "message" | "transaction";
    signatureData?: string; // base64url, transaction method only
}

function buildAttestationQuery(extraTagFilter?: string): string {
    return `
query($vars: [String!]!, $cursor: String) {
  transactions(
    ${extraTagFilter === "owners" ? "owners: $vars" : ""}
    tags: [
      { name: "Version", values: ["1"] }
      { name: "Action", values: ["Register"] }
      ${extraTagFilter && extraTagFilter !== "owners" ? `{ name: "${extraTagFilter}", values: $vars }` : ""}
    ]
    sort: HEIGHT_DESC
    first: 10
    after: $cursor
  ) {
    edges {
      node {
        id
        owner { address }
        tags { name value }
      }
    }
  }
}
`;
}

interface GQLEdge {
    node: {
        id: string;
        owner: { address: string };
        tags: { name: string; value: string }[];
    };
}

function getTagValue(
    tags: { name: string; value: string }[],
    name: string,
): string | undefined {
    return tags.find((t) => t.name === name)?.value;
}

function parseEdge(edge: GQLEdge): AttestationResult | null {
    const { node } = edge;

    // Post-fetch App-Name filter (removed from GQL query for reliability)
    const appName = getTagValue(node.tags, "App-Name");
    if (appName !== ATTESTATION_APP_NAME) return null;

    const sourceAddress = getTagValue(node.tags, "Source-Address");
    const solanaPubkey = getTagValue(node.tags, "Solana-Pubkey");
    const sourceChain = getTagValue(node.tags, "Source-Chain") as
        | "arweave"
        | "ethereum"
        | undefined;

    if (!sourceAddress || !solanaPubkey || !sourceChain) return null;

    const tagTimestamp = getTagValue(node.tags, "Timestamp");
    const timestamp = tagTimestamp
        ? Math.floor(Number(tagTimestamp) / 1000)
        : 0;

    const solanaSignature = getTagValue(node.tags, "Solana-Signature");
    const signatureMethod = getTagValue(node.tags, "Signature-Method") as
        | "message" | "transaction" | undefined;
    const signatureData = getTagValue(node.tags, "Signature-Data");

    return {
        txId: node.id,
        sourceAddress,
        solanaPubkey,
        sourceChain,
        timestamp,
        ...(solanaSignature ? { solanaSignature } : {}),
        ...(signatureMethod ? { signatureMethod } : {}),
        ...(signatureData ? { signatureData } : {}),
    };
}

/** Cache for attestation queries: key → { result, timestamp } */
const attestationCache = new Map<
    string,
    { result: AttestationResult | null; ts: number }
>();
const ATTESTATION_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

/** Invalidate all cache entries related to a registration */
export function invalidateRegistrationCache(
    sourceAddress: string,
    solanaPubkey: string,
): void {
    attestationCache.delete(`owner:${sourceAddress}`);
    attestationCache.delete(`tag:${sourceAddress}`);
    attestationCache.delete(`solana:${solanaPubkey}`);
}

/** Try a single gateway. Returns result or null. Throws only on hard parse errors. */
async function tryGateway(
    gatewayUrl: string,
    query: string,
    variables: Record<string, unknown>,
): Promise<AttestationResult | null | "FAILED"> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS);
    try {
        const res = await fetch(`${gatewayUrl}/graphql`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query, variables }),
            signal: controller.signal,
        });

        if (!res.ok) return "FAILED";

        const json = (await res.json()) as {
            data?: { transactions?: { edges?: GQLEdge[] } };
            errors?: { message: string }[];
        };

        if (json.errors?.length) return "FAILED";

        const edges = json.data?.transactions?.edges ?? [];
        for (const edge of edges) {
            const result = parseEdge(edge);
            if (result) return result;
        }

        return null; // query succeeded, no matching results
    } catch {
        return "FAILED";
    } finally {
        clearTimeout(timeout);
    }
}

async function queryAttestation(
    cacheKey: string,
    query: string,
    variables: Record<string, unknown>,
): Promise<AttestationResult | null> {
    const cached = attestationCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < ATTESTATION_CACHE_TTL_MS) {
        return cached.result;
    }

    // Try primary gateway
    const primary = await tryGateway(GATEWAY_URL, query, variables);
    if (primary !== "FAILED" && primary !== null) {
        attestationCache.set(cacheKey, { result: primary, ts: Date.now() });
        return primary;
    }

    // Primary returned no results or failed — try fallback
    if (primary === "FAILED") {
        console.warn("Primary gateway failed, trying fallback...");
    }
    const fallback = await tryGateway(FALLBACK_GATEWAY_URL, query, variables);
    if (fallback === "FAILED") {
        // Both gateways failed
        if (primary === "FAILED") {
            throw new Error(
                "Unable to verify registration status. Both gateways are unavailable.",
            );
        }
        // Primary returned null (no results), fallback failed — trust primary
        attestationCache.set(cacheKey, { result: null, ts: Date.now() });
        return null;
    }

    // Fallback returned a result or null
    attestationCache.set(cacheKey, {
        result: fallback,
        ts: Date.now(),
    });
    return fallback;
}

/**
 * Query attestation by Arweave owner address.
 * Used for Arweave signers where `owner.address` matches the source identity.
 */
export async function queryAttestationByOwner(
    address: string,
): Promise<AttestationResult | null> {
    return queryAttestation(
        `owner:${address}`,
        buildAttestationQuery("owners"),
        { vars: [address] },
    );
}

/**
 * Query attestation by Source-Address tag value.
 * Used for Ethereum signers where the Arweave `owner.address` differs
 * from the Ethereum address.
 */
export async function queryAttestationByTag(
    sourceAddress: string,
): Promise<AttestationResult | null> {
    return queryAttestation(
        `tag:${sourceAddress}`,
        buildAttestationQuery("Source-Address"),
        { vars: [sourceAddress] },
    );
}

/**
 * Query attestation by Solana-Pubkey tag value.
 * Used to check if a Solana address is already claimed by another source.
 */
export async function queryAttestationBySolanaPubkey(
    solanaPubkey: string,
): Promise<AttestationResult | null> {
    return queryAttestation(
        `solana:${solanaPubkey}`,
        buildAttestationQuery("Solana-Pubkey"),
        { vars: [solanaPubkey] },
    );
}
