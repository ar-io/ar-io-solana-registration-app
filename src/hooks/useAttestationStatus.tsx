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
      return;
    }

    let cancelled = false;

    const fetchStatus = async () => {
      try {
        setLoading(true);
        setError(null);

        // Check localStorage first (instant, works before gateways index)
        try {
          const regKey = 'ar-io-registrations';
          const regs = JSON.parse(localStorage.getItem(regKey) || '{}');
          const lookupKey =
            sourceChain === 'solana' ? `sol:${sourceAddress}` : sourceAddress;
          const local = regs[lookupKey];
          if (local) {
            if (cancelled) return;
            setRegistered(true);
            setSolanaPubkey(
              sourceChain === 'solana' ? sourceAddress : local.solanaPubkey,
            );
            setRegisteredSourceAddress(
              sourceChain === 'solana' ? local.sourceAddress : sourceAddress,
            );
            setTxId(local.txId);
            setRegisteredAt(
              local.timestamp
                ? new Date(local.timestamp).toISOString()
                : null,
            );
            setLoading(false);
            return;
          }
        } catch {
          // localStorage unavailable — continue to GraphQL
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
        } else {
          setRegistered(false);
          setSolanaPubkey(null);
          setRegisteredSourceAddress(null);
          setTxId(null);
          setRegisteredAt(null);
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

  return { loading, registered, solanaPubkey, registeredSourceAddress, txId, registeredAt, error, retry };
}
