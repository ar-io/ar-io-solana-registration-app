import { useState, useEffect, useCallback } from 'react';
import {
  queryAttestationByOwner,
  queryAttestationByTag,
  queryAttestationBySolanaPubkey,
} from '../services/arweave-graphql.ts';

export function useAttestationStatus(
  sourceAddress: string,
  sourceChain: 'arweave' | 'ethereum' | 'solana' = 'arweave',
) {
  const [loading, setLoading] = useState(!!sourceAddress);
  const [registered, setRegistered] = useState(false);
  const [solanaPubkey, setSolanaPubkey] = useState<string | null>(null);
  const [registeredSourceAddress, setRegisteredSourceAddress] = useState<string | null>(null);
  const [txId, setTxId] = useState<string | null>(null);
  const [registeredAt, setRegisteredAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [superseded, setSuperseded] = useState(false);
  const [supersededBySolana, setSupersededBySolana] = useState<string | null>(null);
  const [solanaConflict, setSolanaConflict] = useState(false);
  const [solanaClaimedBySource, setSolanaClaimedBySource] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const retry = useCallback(() => {
    setRetryCount((c) => c + 1);
  }, []);

  useEffect(() => {
    if (!sourceAddress) {
      setRegistered(false);
      setSolanaPubkey(null);
      setTxId(null);
      setRegisteredAt(null);
      setError(null);
      setSuperseded(false);
      setSupersededBySolana(null);
      setSolanaConflict(false);
      setSolanaClaimedBySource(null);
      return;
    }

    let cancelled = false;

    const fetchStatus = async () => {
      try {
        setLoading(true);
        setError(null);

        // Note: localStorage fast-path removed — all lookups now go through
        // GraphQL so cross-checks (superseded + conflict) can run. The Status
        // page is post-snapshot so the extra network call is acceptable.

        // Arweave: query by owner; Ethereum: by Source-Address tag; Solana: by Solana-Pubkey tag
        let result;
        if (sourceChain === 'arweave') {
          result = await queryAttestationByOwner(sourceAddress);
        } else if (sourceChain === 'ethereum') {
          result = await queryAttestationByTag(sourceAddress);
        } else {
          result = await queryAttestationBySolanaPubkey(sourceAddress);
        }

        if (cancelled) return;

        if (result) {
          setRegistered(true);
          setSolanaPubkey(result.solanaPubkey);
          setRegisteredSourceAddress(result.sourceAddress);
          setTxId(result.txId);
          setRegisteredAt(
            result.timestamp > 0
              ? new Date(result.timestamp * 1000).toISOString()
              : null,
          );

          // Cross-checks to detect stale or conflicting mappings.
          if (sourceChain === 'solana') {
            // Solana lookup: verify the source still points back here.
            setSuperseded(false);
            setSupersededBySolana(null);
            setSolanaConflict(false);
            setSolanaClaimedBySource(null);
            try {
              const latestForSource =
                result.sourceChain === 'arweave'
                  ? await queryAttestationByOwner(result.sourceAddress)
                  : await queryAttestationByTag(result.sourceAddress);

              if (cancelled) return;

              if (
                latestForSource &&
                latestForSource.solanaPubkey !== sourceAddress
              ) {
                setSuperseded(true);
                setSupersededBySolana(latestForSource.solanaPubkey);
              }
            } catch {
              // Cross-check failed — don't block
            }
          } else {
            // Arweave/ETH lookup: verify the Solana address hasn't been
            // claimed by a different source in a more recent attestation.
            setSuperseded(false);
            setSupersededBySolana(null);
            setSolanaConflict(false);
            setSolanaClaimedBySource(null);
            try {
              const latestForSolana =
                await queryAttestationBySolanaPubkey(result.solanaPubkey);

              if (cancelled) return;

              if (
                latestForSolana &&
                latestForSolana.sourceAddress !== result.sourceAddress
              ) {
                setSolanaConflict(true);
                setSolanaClaimedBySource(latestForSolana.sourceAddress);
              }
            } catch {
              // Cross-check failed — don't block
            }
          }
        } else {
          setRegistered(false);
          setSolanaPubkey(null);
          setRegisteredSourceAddress(null);
          setTxId(null);
          setRegisteredAt(null);
          setSuperseded(false);
          setSupersededBySolana(null);
          setSolanaConflict(false);
          setSolanaClaimedBySource(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to fetch status',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchStatus();

    return () => {
      cancelled = true;
    };
  }, [sourceAddress, sourceChain, retryCount]);

  return { loading, registered, solanaPubkey, registeredSourceAddress, txId, registeredAt, error, retry, superseded, supersededBySolana, solanaConflict, solanaClaimedBySource };
}
