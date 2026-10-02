import { CHAIN_ID, REGISTRY, RPC_URL } from "@/lib/config";

export function GET() {
  return Response.json({ chainId: CHAIN_ID, registry: REGISTRY, rpcUrl: RPC_URL });
}
