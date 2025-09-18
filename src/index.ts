import { Hono } from "hono";
import { AccessToken, AgentDispatchClient } from "livekit-server-sdk";
import agents from "./agents.json";

type Bindings = {
  LIVEKIT_API_KEY: string;
  LIVEKIT_API_SECRET: string;
  LIVEKIT_URL: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get("/", (c) => {
  return c.text("LiveKit Token Server");
});

app.get("/get-agents", (c) => {
  return c.json(agents);
});

app.get("/getToken", async (c) => {
  try {
    const apiKey = c.env.LIVEKIT_API_KEY;
    const apiSecret = c.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      return c.json({ error: "LiveKit API credentials not configured" }, 500);
    }

    // Get query parameters for room and identity, with defaults
    const roomName = c.req.query("room") || "quickstart-room";
    const participantName = c.req.query("identity") || "quickstart-user";

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

    return c.json({
      token,
      room: roomName,
      identity: participantName,
    });
  } catch (error) {
    return c.json({ error: "Failed to generate token" }, 500);
  }
});

app.post("/dispatch-agent", async (c) => {
  try {
    const apiKey = c.env.LIVEKIT_API_KEY;
    const apiSecret = c.env.LIVEKIT_API_SECRET;
    const livekitUrl = c.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !livekitUrl) {
      return c.json({ error: "LiveKit API credentials not configured" }, 500);
    }

    // Get request body
    const body = await c.req.json().catch(() => ({}));
    const roomName = body.room || c.req.query("room");
    const agentName = body.agentName || c.req.query("agentName");
    const metadata = body.metadata || c.req.query("metadata") || "{}";

    if (!roomName) {
      return c.json({ error: "Room name is required" }, 400);
    }

    // Create agent dispatch client
    const agentDispatchClient = new AgentDispatchClient(
      livekitUrl,
      apiKey,
      apiSecret
    );

    // Dispatch the air-voice-agent
    const dispatch = await agentDispatchClient.createDispatch(
      roomName,
      agentName || "air-voice-agent",
      {
        metadata: metadata,
      }
    );

    return c.json({
      success: true,
      dispatch: dispatch,
      room: roomName,
      agentName: agentName || "air-voice-agent",
      metadata: metadata,
    });
  } catch (error) {
    return c.json(
      {
        error: "Failed to dispatch agent",
        details: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

export default app;
