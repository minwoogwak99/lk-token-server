import { Hono } from "hono";
import { AccessToken, AgentDispatchClient } from "livekit-server-sdk";
import { describeRoute, validator } from "hono-openapi";
import { dispatchAgentQuerySchema } from "./schemas";
import { getAgentsDescription, dispatchAgentDescription, getDefaultAgentDescription } from "./route-descriptions";

const agents = new Hono<{
  Bindings: Env;
  Variables: {
    userId: string;
    sessionId: string;
  };
}>();

agents.get(
  "/get-agents",
  describeRoute(getAgentsDescription),
  async (c) => {
    try {
      const agents = await c.env.AGENTS_KV.list();
      return c.json(agents.keys);
    } catch (error) {
      return c.json({ error: "Failed to fetch agents" }, 500);
    }
  }
);

agents.get(
  "/dispatch-agent",
  describeRoute(dispatchAgentDescription),
  validator("query", dispatchAgentQuerySchema),
  async (c) => {
    try {
      const apiKey = c.env.LIVEKIT_API_KEY;
      const apiSecret = c.env.LIVEKIT_API_SECRET;
      const livekitUrl = c.env.LIVEKIT_URL;

      if (!apiKey || !apiSecret) {
        return c.json({ error: "LiveKit API credentials not configured" }, 500);
      }

      const query = c.req.valid("query");
      const roomName = query.room || "quickstart-room";
      const userName = query.userName;
      const participantIdentity = query.identity || "quickstart-user";
      const agentName = query.agentName || "voice-agent-dev";
      const userContext = query.userContext || "{}";

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
          },
        }),
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
  }
);

agents.get(
  "/default-agent",
  describeRoute(getDefaultAgentDescription),
  async (c) => {
    return c.json({ agent: c.env.DEFAULT_AGENT_NAME || "" });
  }
);

export default agents;
