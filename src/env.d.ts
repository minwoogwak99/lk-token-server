declare interface Env {
  /** Clerk secret key for backend verification */
  CLERK_SECRET_KEY: string;
  /** Clerk publishable key for client identification (may be used in some flows) */
  CLERK_PUBLISHABLE_KEY: string;
  /** Optional PEM public key to enable networkless JWT verification */
  CLERK_JWT_KEY?: string;
  /** Optional comma-separated list of authorized origins for azp validation */
  CLERK_AUTHORIZED_PARTIES?: string;
  /** D1 Database binding */
  zappytalk_db: D1Database;
  /** KV namespace for agents */
  AGENTS_KV: KVNamespace;
  /** LiveKit configuration */
  LIVEKIT_API_KEY: string;
  LIVEKIT_API_SECRET: string;
  LIVEKIT_URL: string;
}


