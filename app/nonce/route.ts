import { kv } from "@vercel/kv";
import { SuiClient, getFullnodeUrl } from "@mysten/sui.js/client";
import { Ed25519Keypair } from "@mysten/sui.js/keypairs/ed25519";
import {
  genAddressSeed,
  generateNonce,
  generateRandomness,
  getExtendedEphemeralPublicKey,
  getZkLoginSignature,
  jwtToAddress,
} from "@mysten/zklogin";
import {
  SerializedSignature,
  decodeSuiPrivateKey,
} from "@mysten/sui.js/cryptography";

export const GET = async (req: Request) => {
  try {
    const ephemeralKeyPair = new Ed25519Keypair();
    const suiClient = new SuiClient({ url: getFullnodeUrl("testnet") });
    const { epoch } = await suiClient.getLatestSuiSystemState();

    const randomness = generateRandomness();
    const MAX_EPOCH = 2; // keep ephemeral keys active for this many Sui epochs from now (1 epoch ~= 24h)
    const maxEpoch = Number(epoch) + MAX_EPOCH; // the ephemeral key will be valid for MAX_EPOCH from now

    const nonce = generateNonce(
      ephemeralKeyPair.getPublicKey(),
      maxEpoch,
      randomness
    );

    return Response.json({
      nonce: nonce,
      key: ephemeralKeyPair.getSecretKey(),
    });
  } catch (error: any) {
    return Response.json({ message: error?.message }, { status: 500 });
  }
};
