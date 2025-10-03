import { Context, Next } from "hono";
import { createClerkClient } from "@clerk/backend";

export const authMiddleware = async (c: Context, next: Next) => {
  // Skip auth in local development
  if (c.env.ENVIRONMENT === 'local') {
    await next();
    return;
  }

  try {
    const clerkClient = createClerkClient({
      secretKey: c.env.CLERK_SECRET_KEY,
      publishableKey: c.env.CLERK_PUBLISHABLE_KEY,
    });

    const authorizedParties = c.env.CLERK_AUTHORIZED_PARTIES
      ? c.env.CLERK_AUTHORIZED_PARTIES.split(",").map((p: string) => p.trim()).filter(Boolean)
      : undefined;

    const { isAuthenticated, toAuth } = await clerkClient.authenticateRequest(c.req.raw, {
      jwtKey: c.env.CLERK_JWT_KEY,
      authorizedParties,
    });

    if (!isAuthenticated) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Add user info to context for use in protected routes
    const auth = toAuth();
    c.set('userId', auth.userId);
    c.set('sessionId', auth.sessionId);

    await next();
  } catch (error) {
    return c.json({ error: "Unauthorized" }, 401);
  }
};
