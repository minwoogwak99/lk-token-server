import { Hono } from "hono";
import { cors } from "hono/cors";
import { AccessToken, AgentDispatchClient } from "livekit-server-sdk";
import { createClerkClient } from "@clerk/backend";

const app = new Hono<{ 
  Bindings: Env;
  Variables: {
    userId: string;
    sessionId: string;
  };
}>();

// CORS middleware for cross-origin requests
app.use('*', cors({
  origin: (origin) => {
    // Allow requests from localhost on any port for development
    if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      return origin;
    }
    // Allow requests from local network IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
    if (origin && (
      origin.includes('192.168.') || 
      origin.includes('10.') ||
      /172\.(1[6-9]|2[0-9]|3[01])\./.test(origin)
    )) {
      return origin;
    }
    // Add your production domains here
    const allowedOrigins: string[] = [
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
const authMiddleware = async (c: import("hono").Context, next: import("hono").Next) => {
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

app.get("/", (c) => {
  return c.text("LiveKit Token Server");
});

// Protect sensitive routes
app.use("/get-agents", authMiddleware);
app.use("/dispatch-agent", authMiddleware);
app.use("/users/:user_id", authMiddleware);
app.use("/calls", authMiddleware);
app.use("/calls/user/:user_id", authMiddleware);

app.get("/get-agents", async (c) => {
  try {
    const agents = await c.env.AGENTS_KV.list();
    return c.json(agents.keys);
  } catch (error) {
    return c.json({ error: "Failed to fetch agents" }, 500);
  }
});

app.get("/dispatch-agent", async (c) => {
  try {
    const apiKey = c.env.LIVEKIT_API_KEY;
    const apiSecret = c.env.LIVEKIT_API_SECRET;
    const livekitUrl = c.env.LIVEKIT_URL;
    
    if (!apiKey || !apiSecret) {
      return c.json({ error: "LiveKit API credentials not configured" }, 500);
    }
    
    // Get query parameters for room and identity, with defaults
    const roomName = c.req.query("room") || "quickstart-room";
    const userName = c.req.query("userName")
    const participantIdentity = c.req.query("identity") || "quickstart-user";
    const agentName = c.req.query("agentName") || "voice-agent-dev";
    const userContext = c.req.query("userContext") || "{}";

    // Create access token
    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantIdentity,
      name: userName,
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
    const agentDispatchClient = new AgentDispatchClient(
      livekitUrl,
      apiKey,
      apiSecret
    );

    await agentDispatchClient.createDispatch(roomName, agentName, {
      metadata: JSON.stringify({
        userName,
        userId: participantIdentity,
        userContext: {
          ...JSON.parse(userContext),
        }
      })
    });
    // END DISPATCHING AGENT

    return c.json({
      token,
      room: roomName,
      identity: participantIdentity,
    });
  } catch (error) {
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

  } catch (error) {
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

  } catch (error) {
    console.error("Error in /users/:user_id:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// PUT /users/:user_id - Update user information (authenticated)
app.put("/users/:user_id", async (c) => {
  try {
    const requestedUserId = c.req.param("user_id");
    const authenticatedUserId = c.get('userId');

    // Ensure users can only edit their own data
    if (requestedUserId !== authenticatedUserId) {
      return c.json({ error: "Access denied. You can only edit your own user data." }, 403);
    }

    // Parse request body
    const body = await c.req.json();
    const { user_name, email, profile_img } = body;

    // Validate that at least one field is provided for update
    if (!user_name && !email && profile_img === undefined) {
      return c.json({ error: "At least one field (user_name, email, or profile_img) must be provided for update" }, 400);
    }

    // Validate required fields if they are being updated
    if (user_name !== undefined && (!user_name || user_name.trim().length === 0)) {
      return c.json({ error: "user_name cannot be empty" }, 400);
    }

    if (email !== undefined && (!email || email.trim().length === 0 || !email.includes('@'))) {
      return c.json({ error: "Valid email is required" }, 400);
    }

    // Check if user exists
    const existingUser = await c.env.zappytalk_db
      .prepare("SELECT * FROM users WHERE user_id = ? AND deleted_at IS NULL")
      .bind(requestedUserId)
      .first();

    if (!existingUser) {
      return c.json({ error: "User not found" }, 404);
    }

    // Build dynamic update query
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    if (user_name !== undefined) {
      updateFields.push("user_name = ?");
      updateValues.push(user_name.trim());
    }

    if (email !== undefined) {
      updateFields.push("email = ?");
      updateValues.push(email.trim().toLowerCase());
    }

    if (profile_img !== undefined) {
      updateFields.push("profile_img = ?");
      updateValues.push(profile_img);
    }

    // Always update the updated_at timestamp
    updateFields.push("updated_at = ?");
    updateValues.push(new Date().toISOString());

    // Add user_id for WHERE clause
    updateValues.push(requestedUserId);

    const updateQuery = `UPDATE users SET ${updateFields.join(", ")} WHERE user_id = ? AND deleted_at IS NULL`;

    const result = await c.env.zappytalk_db
      .prepare(updateQuery)
      .bind(...updateValues)
      .run();

    if (!result.success) {
      return c.json({ error: "Failed to update user" }, 500);
    }

    // Fetch and return the updated user
    const updatedUser = await c.env.zappytalk_db
      .prepare("SELECT user_id, user_name, email, profile_img, created_at, updated_at FROM users WHERE user_id = ? AND deleted_at IS NULL")
      .bind(requestedUserId)
      .first();

    return c.json({ 
      user: updatedUser,
      message: "User updated successfully"
    });

  } catch (error) {
    console.error("Error in PUT /users/:user_id:", error);
    
    // Handle unique constraint violation for email
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return c.json({ error: "Email already exists. Please use a different email address." }, 409);
    }
    
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Call management endpoints
// POST /calls - Store a new call record
app.post("/calls", async (c) => {
  try {
    const body = await c.req.json();
    const { id, user_id, agent_name, started_at, ended_at, messages_json, user_location } = body;


    if (!user_id || !agent_name || !started_at || !ended_at || !messages_json) {
      return c.json({
        error: "user_id, agent_name, started_at, ended_at, and messages_json are required"
      }, 400);
    }

    // Insert the session log record
    const result = await c.env.zappytalk_db
      .prepare(`
        INSERT INTO calls (id, user_id, agent_name, started_at, ended_at, deleted_at, messages_json, location)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(id, user_id, agent_name, started_at, ended_at, null, messages_json, user_location || null)
      .run();

    if (!result.success) {
      return c.json({ error: "Failed to create session log" }, 500);
    }


    return c.json({
      message: "Session log created successfully"
    }, 201);

  } catch (error) {
    console.error("Error in /calls:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /calls/user/:user_id - Get all calls for a user with pagination
app.get("/calls/user/:user_id", async (c) => {
  try {
    const requestedUserId = c.req.param("user_id");
    const authenticatedUserId = c.get('userId');

    // Ensure users can only access their own calls
    if (requestedUserId !== authenticatedUserId) {
      return c.json({ error: "Access denied. You can only access your own call data." }, 403);
    }

    // Pagination parameters
    const page = parseInt(c.req.query("page") || "1");
    const limit = parseInt(c.req.query("limit") || "10");

    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 100) {
      return c.json({ error: "Invalid pagination parameters. Page must be >= 1, limit must be between 1 and 100." }, 400);
    }

    const offset = (page - 1) * limit;

    // Get total count of calls for the user
    const countResult = await c.env.zappytalk_db
      .prepare("SELECT COUNT(*) as total FROM calls WHERE user_id = ? AND deleted_at IS NULL")
      .bind(requestedUserId)
      .first();

    const totalCalls = (countResult as { total: number })?.total || 0;
    const totalPages = Math.ceil(totalCalls / limit);

    // Fetch paginated calls
    const calls = await c.env.zappytalk_db
      .prepare(`
        SELECT id, user_id, agent_name, started_at, ended_at, summary, messages_json, location
        FROM calls
        WHERE user_id = ? AND deleted_at IS NULL
        ORDER BY started_at DESC
        LIMIT ? OFFSET ?
      `)
      .bind(requestedUserId, limit, offset)
      .all();

    return c.json({
      calls: calls.results || [],
      pagination: {
        page,
        limit,
        totalCalls,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    });

  } catch (error) {
    console.error("Error in GET /calls/user/:user_id:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /default-agent - Get the default agent for a user
app.get("/default-agent", async (c) => {
  return c.json({ agent: c.env.DEFAULT_AGENT_NAME || "" });
});

app.put("/calls/:call_id/summary", async (c) => {
  try {
    const callId = c.req.param("call_id");

    if (!callId) {
      return c.json({ error: "call_id path parameter is required" }, 400);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch (parseError) {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    if (!body || typeof body !== "object" || body === null) {
      return c.json({ error: "Request body must be a JSON object" }, 400);
    }

    const summary = (body as { summary?: unknown }).summary;

    // checking call exist
    const existingCall = await c.env.zappytalk_db
      .prepare("SELECT id FROM calls WHERE id = ? AND deleted_at IS NULL")
      .bind(callId)
      .first();

    if (!existingCall) {
      return c.json({ error: "Call not found" }, 404);
    }

    const updateResult = await c.env.zappytalk_db
      .prepare("UPDATE calls SET summary = ? WHERE id = ? AND deleted_at IS NULL")
      .bind(summary, callId)
      .run();

    if (!updateResult.success || (updateResult.meta as { changes?: number } | undefined)?.changes === 0) {
      return c.json({ error: "Failed to update call summary" }, 500);
    }

    return c.json({
      message: "Call summary updated successfully"
    });

  } catch (error) {
    console.error("Error in PUT /calls/:call_id/summary:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default app;
