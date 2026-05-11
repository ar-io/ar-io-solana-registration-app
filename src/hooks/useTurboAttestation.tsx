import { useState, useCallback } from "react";
import { ATTESTATION_APP_NAME } from "../services/arweave-graphql.ts";

type Stage = "create_signer" | "upload" | "confirm" | "done" | null;

export function useTurboAttestation(
    sourceAddress: string,
    sourceChain: "arweave" | "ethereum",
    solanaPubkey: string,
    sourceAddressSignature: string,
    signatureMethod: "message" | "transaction" = "message",
    signatureTxData?: string,
    ethereumProvider?: any,
) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [stage, setStage] = useState<Stage>(null);
    const [txId, setTxId] = useState<string | null>(null);

    const sign = useCallback(async () => {
        setLoading(true);
        setError(null);
        setSuccess(false);
        setTxId(null);

        try {
            // Guard: never upload without a valid signature
            if (!sourceAddressSignature || sourceAddressSignature.trim() === "") {
                throw new Error(
                    "Missing Solana signature. Please go back and complete the authorization step.",
                );
            }

            // Dynamic imports for Turbo SDK (tree-shaking friendly)
            const { TurboFactory } = await import("@ardrive/turbo-sdk/web");

            const tags = [
                { name: "App-Name", value: ATTESTATION_APP_NAME },
                { name: "Version", value: "1" },
                { name: "Action", value: "Register" },
                { name: "Source-Address", value: sourceAddress },
                { name: "Solana-Pubkey", value: solanaPubkey },
                { name: "Source-Chain", value: sourceChain },
                { name: "Solana-Signature", value: sourceAddressSignature },
                { name: "Signature-Method", value: signatureMethod },
                ...(signatureTxData
                    ? [{ name: "Signature-Data", value: signatureTxData }]
                    : []),
                { name: "Timestamp", value: Date.now().toString() },
                { name: "Content-Type", value: "text/plain" },
            ];

            let turbo: Awaited<ReturnType<typeof TurboFactory.authenticated>>;

            if (sourceChain === "arweave") {
                // Arweave path: ArconnectSigner
                setStage("create_signer");
                console.log("Creating ArConnect signer...");

                if (!(window as any).arweaveWallet) {
                    throw new Error("Wander wallet extension not found.");
                }

                const { ArconnectSigner } =
                    await import("@ardrive/turbo-sdk/web");
                const signer = new ArconnectSigner(
                    (window as any).arweaveWallet,
                );
                console.log(
                    "ArConnect signer created, authenticating Turbo...",
                );
                turbo = TurboFactory.authenticated({ signer });
                console.log("Turbo authenticated with ArConnect signer");
            } else {
                // Ethereum path: InjectedEthereumSigner with public key recovery
                setStage("create_signer");

                // Use the provider captured during wallet connection to avoid
                // picking the wrong wallet in multi-provider environments.
                let targetProvider: any;
                if (ethereumProvider) {
                    targetProvider = ethereumProvider;
                } else {
                    // Fallback: detect at runtime (no stored provider)
                    if (!(window as any).ethereum) {
                        throw new Error("Ethereum wallet not found.");
                    }
                    const ethereum = (window as any).ethereum;
                    targetProvider = ethereum;

                    if (ethereum.providers && Array.isArray(ethereum.providers)) {
                        targetProvider = ethereum.providers.find((p: any) =>
                            !p.isPhantom && !p.isSolana && !p.solana && p.isMetaMask
                        ) || ethereum.providers.find((p: any) =>
                            !p.isPhantom && !p.isSolana && !p.solana
                        );
                        if (!targetProvider) {
                            throw new Error("No compatible Ethereum wallet found (only Solana wallets detected).");
                        }
                    } else if (ethereum.isPhantom || ethereum.isSolana || ethereum.solana) {
                        throw new Error("Detected Solana wallet instead of Ethereum wallet. Please ensure you connected with an Ethereum wallet.");
                    }
                }

                const { ethers } = await import("ethers");
                const { InjectedEthereumSigner } =
                    await import("@ar.io/sdk/web");

                const provider = new ethers.BrowserProvider(targetProvider);
                const ethersSigner = await provider.getSigner();

                // Verify we're signing with the expected address
                const signerAddress = await ethersSigner.getAddress();
                const { getAddress } = await import("ethers");
                const normalizedSignerAddress = getAddress(signerAddress);
                const normalizedSourceAddress = getAddress(sourceAddress);
                
                if (normalizedSignerAddress !== normalizedSourceAddress) {
                    throw new Error(
                        `Wallet address mismatch. Expected ${normalizedSourceAddress} but got ${normalizedSignerAddress}. ` +
                        `Please ensure you're using the same wallet you connected with.`
                    );
                }

                const injectedProvider = {
                    getSigner: () => ({
                        signMessage: async (message: string | Uint8Array) => {
                            return await ethersSigner.signMessage(
                                typeof message === "string" ? message : message,
                            );
                        },
                        getAddress: async () => sourceAddress,
                    }),
                };

                const signer = new InjectedEthereumSigner(
                    injectedProvider as any,
                );

                console.log("Setting up Ethereum signer without extra signature...");
                // Skip the redundant connect message signing step.
                // The Turbo SDK will handle signing when needed for the actual upload.

                console.log("Ethereum signer created, authenticating Turbo...");
                turbo = TurboFactory.authenticated({ signer });
                console.log("Turbo authenticated with Ethereum signer");
            }

            // Upload data item
            setStage("upload");
            console.log("Starting Turbo upload with tags:", tags);

            const body = "ar.io Migration Attestation";
            const bodyBytes = new TextEncoder().encode(body);

            console.log("Uploading file with Turbo SDK...");
            const result = await turbo.uploadFile({
                fileStreamFactory: () =>
                    new ReadableStream({
                        start(controller) {
                            controller.enqueue(bodyBytes);
                            controller.close();
                        },
                    }),
                fileSizeFactory: () => bodyBytes.byteLength,
                dataItemOpts: { tags },
            });
            console.log("Upload successful, result:", result);

            // Confirm
            setStage("confirm");
            setTxId(result.id);

            setStage("done");
            setSuccess(true);
        } catch (err) {
            console.error("Turbo attestation error:", err);

            let message = "Attestation failed";
            if (err instanceof Error) {
                message = err.message;

                // Add more specific error context
                if (err.message.includes("signer")) {
                    message = `Wallet signer error: ${err.message}`;
                } else if (err.message.includes("upload")) {
                    message = `Upload failed: ${err.message}`;
                } else if (err.message.includes("Turbo")) {
                    message = `Turbo SDK error: ${err.message}`;
                } else if (
                    err.message.includes("network") ||
                    err.message.includes("fetch")
                ) {
                    message = `Network error: ${err.message}`;
                }
            }

            setError(message);
        } finally {
            setLoading(false);
        }
    }, [sourceAddress, sourceChain, solanaPubkey, sourceAddressSignature, signatureMethod, signatureTxData, ethereumProvider]);

    return { sign, loading, error, success, stage, txId };
}
