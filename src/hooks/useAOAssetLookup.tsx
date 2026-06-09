import { useState, useEffect } from "react";
import { type LiveAssetSummary } from "../services/ao-asset-lookup.ts";
// Source holdings from the FROZEN migration snapshot (what actually migrates to
// Solana), not the live AO balance — which keeps drifting and confuses users.
import { lookupSnapshotAssets } from "../services/snapshot-asset-lookup.ts";

export function useAOAssetLookup(sourceAddress: string) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [assets, setAssets] = useState<LiveAssetSummary | null>(null);

    useEffect(() => {
        if (!sourceAddress) {
            setAssets(null);
            setError(null);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);

        lookupSnapshotAssets(sourceAddress)
            .then((result) => {
                if (!cancelled) {
                    setAssets(result);
                    setLoading(false);
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    setError(
                        err instanceof Error ? err.message : "Lookup failed",
                    );
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [sourceAddress]);

    return { loading, error, assets };
}
