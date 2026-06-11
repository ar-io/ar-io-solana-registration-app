/**
 * Client-side Solana signature verification for attestation data items.
 * Never throws — always returns a result object.
 */

export type SignatureVerificationResult =
    | { status: "verified" }
    | { status: "invalid"; reason: string }
    | { status: "unable"; reason: string };

export async function verifySolanaSignature(params: {
    solanaSignature?: string;
    signatureMethod?: "message" | "transaction";
    signatureData?: string;
    sourceAddress: string;
    solanaPubkey: string;
}): Promise<SignatureVerificationResult> {
    try {
        const { solanaSignature, signatureMethod, signatureData, sourceAddress, solanaPubkey } = params;

        if (!solanaSignature || !signatureMethod) {
            return { status: "unable", reason: "Attestation is missing signature tags" };
        }

        if (signatureMethod === "transaction" && !signatureData) {
            return { status: "unable", reason: "Transaction method but no Signature-Data tag" };
        }

        const [bs58, ed25519] = await Promise.all([
            import("bs58"),
            import("@noble/ed25519"),
        ]);

        const signature = bs58.default.decode(solanaSignature);
        const pubkey = bs58.default.decode(solanaPubkey);

        let message: Uint8Array;
        if (signatureMethod === "message") {
            message = new TextEncoder().encode(sourceAddress);
        } else {
            // Decode base64url → bytes
            const b64 = signatureData!.replace(/-/g, "+").replace(/_/g, "/");
            const binary = atob(b64);
            message = Uint8Array.from(binary, (c) => c.charCodeAt(0));
        }

        const valid = await ed25519.verify(signature, message, pubkey);
        if (valid) {
            return { status: "verified" };
        }
        return { status: "invalid", reason: "Ed25519 signature does not match" };
    } catch (err) {
        return {
            status: "unable",
            reason: err instanceof Error ? err.message : "Verification error",
        };
    }
}
