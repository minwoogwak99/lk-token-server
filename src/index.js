import { Hono } from "hono";
import { cors } from "hono/cors";
import { AccessToken, AgentDispatchClient } from "livekit-server-sdk";
import { createClerkClient } from "@clerk/backend";
const app = new Hono();
// CORS middleware for cross-origin requests
app.use('*', cors({
    origin: (origin) => {
        // Allow requests from localhost on any port for development
        if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
            return origin;
        }
        // Add your production domains here
        const allowedOrigins = [
        // Add your production client domain here when deploying
        // 'https://yourdomain.com'
        ];
        return allowedOrigins.includes(origin || '') ? origin : undefined;
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
}));
// Authentication middleware for protected routes
const authMiddleware = async (c, next) => {
    try {
        const clerkClient = createClerkClient({
            secretKey: c.env.CLERK_SECRET_KEY,
            publishableKey: c.env.CLERK_PUBLISHABLE_KEY,
        });
        const authorizedParties = c.env.CLERK_AUTHORIZED_PARTIES
            ? c.env.CLERK_AUTHORIZED_PARTIES.split(",").map((p) => p.trim()).filter(Boolean)
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
    }
    catch (error) {
        return c.json({ error: "Unauthorized" }, 401);
    }
};
app.get("/", (c) => {
    return c.text("LiveKit Token Server");
});
// Protect sensitive routes
app.use("/get-agents", authMiddleware);
app.use("/dispatch-agent", authMiddleware);
app.use("/users/:user_id", authMiddleware);
app.get("/get-agents", async (c) => {
    try {
        const agents = await c.env.AGENTS_KV.list();
        return c.json(agents.keys);
    }
    catch (error) {
        return c.json({ error: "Failed to fetch agents" }, 500);
    }
});
app.get("/dispatch-agent", async (c) => {
    try {
        const apiKey = c.env.LIVEKIT_API_KEY;
        const apiSecret = c.env.LIVEKIT_API_SECRET;
        const livekitUrl = c.env.LIVEKIT_URL;
        const userName = c.req.query("userName");
        if (!apiKey || !apiSecret) {
            return c.json({ error: "LiveKit API credentials not configured" }, 500);
        }
        // Get query parameters for room and identity, with defaults
        const roomName = c.req.query("room") || "quickstart-room";
        const participantName = c.req.query("identity") || "quickstart-user";
        const agentName = c.req.query("agentName") || "voice-agent-dev";
        // Create access token
        const at = new AccessToken(apiKey, apiSecret, {
            identity: participantName,
            name: participantName,
            // Token to expire after 10 minutes
            ttl: "10m",
        });
        // Add grants for room join
        at.addGrant({
            roomJoin: true,
            room: roomName,
            // You can add more grants here as needed:
            // canPublish: true,
            // canSubscribe: true,
            // canPublishData: true,
        });
        const token = await at.toJwt();
        // START DISPATCHING AGENT
        const agentDispatchClient = new AgentDispatchClient(livekitUrl, apiKey, apiSecret);
        await agentDispatchClient.createDispatch(roomName, agentName, {
            metadata: JSON.stringify({
                userName
            })
        });
        // END DISPATCHING AGENT
        return c.json({
            token,
            room: roomName,
            identity: participantName,
        });
    }
    catch (error) {
        return c.json({ error: "Failed to generate token" }, 500);
    }
});
// User management endpoints
// POST /users/check-or-create - Check if user exists, create if not (for sign-in flow)
app.post("/users/check-or-create", async (c) => {
    try {
        const body = await c.req.json();
        const { user_id, user_name, email, profile_img } = body;
        if (!user_id || !user_name || !email) {
            return c.json({ error: "user_id, user_name, and email are required" }, 400);
        }
        // Check if user already exists
        const existingUser = await c.env.zappytalk_db
            .prepare("SELECT * FROM users WHERE user_id = ? AND deleted_at IS NULL")
            .bind(user_id)
            .first();
        if (existingUser) {
            return c.json({
                exists: true,
                user: existingUser,
                message: "User already exists"
            });
        }
        // Create new user
        const now = new Date().toISOString();
        const result = await c.env.zappytalk_db
            .prepare(`
        INSERT INTO users (user_id, user_name, email, profile_img, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?)
      `)
            .bind(user_id, user_name, email, profile_img || null, now, now)
            .run();
        if (!result.success) {
            return c.json({ error: "Failed to create user" }, 500);
        }
        // Fetch the created user
        const newUser = await c.env.zappytalk_db
            .prepare("SELECT * FROM users WHERE user_id = ?")
            .bind(user_id)
            .first();
        return c.json({
            exists: false,
            user: newUser,
            message: "User created successfully"
        }, 201);
    }
    catch (error) {
        console.error("Error in /users/check-or-create:", error);
        return c.json({ error: "Internal server error" }, 500);
    }
});
// GET /users/:user_id - Get user information (authenticated)
app.get("/users/:user_id", async (c) => {
    try {
        const requestedUserId = c.req.param("user_id");
        const authenticatedUserId = c.get('userId');
        // Optional: Check if user is requesting their own data or has permission
        // For now, let's allow users to only access their own data
        if (requestedUserId !== authenticatedUserId) {
            return c.json({ error: "Access denied. You can only access your own user data." }, 403);
        }
        const user = await c.env.zappytalk_db
            .prepare("SELECT user_id, user_name, email, profile_img, created_at, updated_at FROM users WHERE user_id = ? AND deleted_at IS NULL")
            .bind(requestedUserId)
            .first();
        if (!user) {
            return c.json({ error: "User not found" }, 404);
        }
        return c.json({ user });
    }
    catch (error) {
        console.error("Error in /users/:user_id:", error);
        return c.json({ error: "Internal server error" }, 500);
    }
});
// app.post("/dispatch-agent", async (c) => {
//   try {
//     const apiKey = c.env.LIVEKIT_API_KEY;
//     const apiSecret = c.env.LIVEKIT_API_SECRET;
//     const livekitUrl = c.env.LIVEKIT_URL;
//     if (!apiKey || !apiSecret || !livekitUrl) {
//       return c.json({ error: "LiveKit API credentials not configured" }, 500);
//     }
//     // Get request body
//     const body = await c.req.json().catch(() => ({}));
//     const roomName = body.room || c.req.query("room");
//     const agentName = body.agentName || c.req.query("agentName");
//     const metadata = body.metadata || c.req.query("metadata") || "{}";
//     if (!roomName) {
//       return c.json({ error: "Room name is required" }, 400);
//     }
//     // Create agent dispatch client
//     const agentDispatchClient = new AgentDispatchClient(
//       livekitUrl,
//       apiKey,
//       apiSecret
//     );
//     // Dispatch the air-voice-agent
//     const dispatch = await agentDispatchClient.createDispatch(
//       roomName,
//       agentName || "air-voice-agent",
//       {
//         metadata: metadata,
//       }
//     );
//     return c.json({
//       success: true,
//       dispatch: dispatch,
//       room: roomName,
//       agentName: agentName || "air-voice-agent",
//       metadata: metadata,
//     });
//   } catch (error) {
//     return c.json(
//       {
//         error: "Failed to dispatch agent",
//         details: error instanceof Error ? error.message : String(error),
//       },
//       500
//     );
//   }
// });
export default app;
