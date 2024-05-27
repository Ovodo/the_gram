import { jwtToAddress } from "@mysten/zklogin";
import { Slackey } from "next/font/google";

export const GET = (req: Request) => {
  const { searchParams } = new URL(req.url);
  const jwt = searchParams.get("jwt") as string;
  console.log(jwt);

  const salt = searchParams.get("salt");
  try {
    const address = jwtToAddress(jwt, BigInt("1234").toString());
    console.log(address);

    return Response.json({ address });
  } catch (error: any) {
    console.error("This is the error :", error);
    return Response.json(error.message);
  }
};
