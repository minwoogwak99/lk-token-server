import { resolver } from "hono-openapi";
import { z } from "zod";

export const getAgentsDescription = {
  tags: ["Agents"],
  description: "Get list of available agents",
  responses: {
    200: {
      description: "List of agent keys",
      content: {
        "application/json": {
          schema: resolver(z.array(z.object({ name: z.string() }))),
        },
      },
    },
  },
};

export const dispatchAgentDescription = {
  tags: ["Agents"],
  description: "Dispatch an agent to a LiveKit room",
  responses: {
    200: {
      description: "Agent dispatched successfully",
      content: {
        "application/json": {
          schema: resolver(
            z.object({
              token: z.string(),
              room: z.string(),
              identity: z.string(),
            })
          ),
        },
      },
    },
    500: {
      description: "Server error",
      content: {
        "application/json": {
          schema: resolver(z.object({ error: z.string() })),
        },
      },
    },
  },
};

export const getDefaultAgentDescription = {
  tags: ["Agents"],
  description: "Get default agent name",
  responses: {
    200: {
      description: "Default agent name",
      content: {
        "application/json": {
          schema: resolver(z.object({ agent: z.string() })),
        },
      },
    },
  },
};
