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

const MAX_EPOCH = 2; // keep ephemeral keys active for this many Sui epochs from now (1 epoch ~= 24h)
const suiClient = new SuiClient({ url: getFullnodeUrl("testnet") });
async function getSaltFromMystenAPI(jwtEncoded: string) {
  const url: string =
    process.env.NEXT_PUBLIC_SALT_API ||
    "https://salt.api.mystenlabs.com/get_salt";
  const payload = { token: jwtEncoded };

  const response = await fetch(url!, {
    method: "POST",
    mode: "cors",
    cache: "no-cache",
    headers: {
      "Content-Type": "application/json",
    },
    referrerPolicy: "no-referrer",
    body: JSON.stringify(payload),
  });

  const responseJson = await response.json();
  console.log(responseJson);

  return responseJson.salt;
}

export const GET = async (req: Request) => {
  const { epoch } = await suiClient.getLatestSuiSystemState();
  const maxEpoch = Number(epoch) + MAX_EPOCH; // the ephemeral key will be valid for MAX_EPOCH from now
  const { searchParams } = new URL(req.url);
  const jwt = searchParams.get("jwt") as string;

  const ephemeralKeyPair = new Ed25519Keypair();
  try {
    const salt = await getSaltFromMystenAPI(jwt);
    console.log(salt);
    return Response.json(salt);
    const userSalt = BigInt("1234").toString();
    const address = jwtToAddress(jwt, userSalt);
    const randomness = generateRandomness();
    const user = JSON.stringify({
      address,
      salt: userSalt,
      jwt,
      privateKey: ephemeralKeyPair.getSecretKey(),
      randomness,
      maxEpoch,
    });

    console.log(user);

    await kv.set(`acc:${address}`, user, { ex: 2 * 60 * 60 }); // Set TTL to 1 day
    // await kv.set(`news`, "tokos", { ex: 1 * 60 * 60 }); // Set TTL to 1 day

    return new Response(
      JSON.stringify({ message: "Sign in successful!", address }),
      { status: 200 }
    );
  } catch (error: any) {
    console.error("This is the error:", error);
    return new Response(error.message, { status: 500 });
  }
};

const getZkProof = async (userAddress: string, privateKey: string) => {
  const ephemeralKeyPair = keypairFromSecretKey(privateKey);
  const ephemeralPublicKey = ephemeralKeyPair.getPublicKey();
  const { epoch } = await suiClient.getLatestSuiSystemState();
  const maxEpoch = Number(epoch) + MAX_EPOCH; // the ephemeral key will be valid for MAX_EPOCH from now
  const randomness = generateRandomness();

  const user: any = await kv.get(`user:${userAddress}`);

  if (!user) {
    console.error("User not found");
    return;
  }

  const payload = JSON.stringify(
    {
      maxEpoch: maxEpoch,
      jwtRandomness: randomness,
      extendedEphemeralPublicKey:
        getExtendedEphemeralPublicKey(ephemeralPublicKey),
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
    });

  if (!zkProofs) {
    return;
  }
  console.log(zkProofs);
};

/**
 * Create a keypair from a base64-encoded secret key
 */
function keypairFromSecretKey(privateKeyBase64: string): Ed25519Keypair {
  const keyPair = decodeSuiPrivateKey(privateKeyBase64);
  return Ed25519Keypair.fromSecretKey(keyPair.secretKey);
}
