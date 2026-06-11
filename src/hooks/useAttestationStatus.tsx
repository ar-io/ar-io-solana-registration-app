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
      return;
    }

    let cancelled = false;

    const fetchStatus = async () => {
      try {
        setLoading(true);
        setError(null);

        // Check localStorage first (instant, works before gateways index).
        // Skip for Solana lookups — they need the GraphQL cross-check to
        // detect superseded mappings, which localStorage can't provide.
        if (sourceChain !== 'solana') {
          try {
            const regKey = 'ar-io-registrations';
            const regs = JSON.parse(localStorage.getItem(regKey) || '{}');
            const local = regs[sourceAddress];
            if (local) {
              if (cancelled) return;
              setRegistered(true);
              setSolanaPubkey(local.solanaPubkey);
              setRegisteredSourceAddress(sourceAddress);
              setTxId(local.txId);
              setRegisteredAt(
                local.timestamp
                  ? new Date(local.timestamp).toISOString()
                  : null,
              );
              setSuperseded(false);
              setSupersededBySolana(null);
              setLoading(false);
              return;
            }
          } catch {
            // localStorage unavailable — continue to GraphQL
          }
        }

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

          // Cross-check: if looking up by Solana address, verify the source
          // still points back to this Solana address. If the source has since
          // re-registered to a different Solana wallet, this mapping is stale.
          if (sourceChain === 'solana') {
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
              } else {
                setSuperseded(false);
                setSupersededBySolana(null);
              }
            } catch {
              // Cross-check failed — don't block, just skip
              setSuperseded(false);
              setSupersededBySolana(null);
            }
          } else {
            setSuperseded(false);
            setSupersededBySolana(null);
          }
        } else {
          setRegistered(false);
          setSolanaPubkey(null);
          setRegisteredSourceAddress(null);
          setTxId(null);
          setRegisteredAt(null);
          setSuperseded(false);
          setSupersededBySolana(null);
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

  return { loading, registered, solanaPubkey, registeredSourceAddress, txId, registeredAt, error, retry, superseded, supersededBySolana };
}
