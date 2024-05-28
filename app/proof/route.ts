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

    // const user = await db.collection("Users").findOne({ address: userAddress });
    const users = createClient({
      url: process.env.USERS_REST_API_URL,
      token: process.env.USERS_REST_API_TOKEN,
    });

    const use = await users.hgetall(`user:${userAddress}`);
    console.log(use);
    return Response.json({ message: "gotten user", use });

    const user: any = await kv.get(`user:${userAddress}`);

    const payload = JSON.stringify(
      {
        maxEpoch: user?.max,
        jwtRandomness: user?.randomness,
        extendedEphemeralPublicKey: getExtendedEphemeralPublicKey(
          user?.publickKey
        ),
        jwt: user?.jwt,
        salt: user?.salt,
        keyClaimName: "sub",
      },
      null,
      2
    );

    const zkProofs = await fetch("https://prover-dev.mystenlabs.com/v1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    })
      .then((res) => {
        console.debug("[completeZkLogin] ZK proving service success");
        return res.json();
      })
      .catch((error: unknown) => {
        console.warn("[completeZkLogin] ZK proving service error:", error);
        return null;
      })
      .finally(() => {
        console.log("done");
      });

    if (!zkProofs) {
      return Response.json({ message: "No Zk proof" }, { status: 404 });
    }
    console.log(zkProofs);
    return Response.json({ message: zkProofs }, { status: 200 });
  } catch (error: any) {
    console.log(error);
    return Response.json({ message: error.message }, { status: 500 });
  }
};
