import clientPromise from "../lib/mongo";
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
import { createClient, kv } from "@vercel/kv";

const MAX_EPOCH = 2; // keep ephemeral keys active for this many Sui epochs from now (1 epoch ~= 24h)
const suiClient = new SuiClient({ url: getFullnodeUrl("testnet") });

export const GET = async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const userAddress = searchParams.get("address") as string;
  try {
    // const client = await clientPromise;
    // const db = client.db("SuiGram");

    const user: any = await kv.get(`acc:${userAddress}`);
    const ephemeralKeyPair = keypairFromSecretKey(user.privateKey);
    console.log(user);

    const payload = JSON.stringify(
      {
        maxEpoch: user.maxEpoch,
        jwtRandomness: user.randomness,
        extendedEphemeralPublicKey: getExtendedEphemeralPublicKey(
          ephemeralKeyPair.getPublicKey()
        ),
        jwt: user.jwt,
        salt: user.salt,
        keyClaimName: "sub",
      },
      null,
      2
    );

    const res = await fetch("https://prover-dev.mystenlabs.com/v1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });
    const zkProofs = await res.json();

    if (zkProofs?.error) {
      return Response.json({ message: zkProofs?.message }, { status: 404 });
    }
    console.log(zkProofs);
    return Response.json({ message: zkProofs }, { status: 200 });
  } catch (error: any) {
    console.log(error);
    return Response.json({ message: error.message }, { status: 500 });
  }
};

function keypairFromSecretKey(privateKeyBase64: string): Ed25519Keypair {
  const keyPair = decodeSuiPrivateKey(privateKeyBase64);
  return Ed25519Keypair.fromSecretKey(keyPair.secretKey);
}
