import { resolver } from "hono-openapi";
import { z } from "zod";

export const createCallDescription = {
  tags: ["Calls"],
  description: "Create a new call record",
  responses: {
    201: {
      description: "Call created successfully",
      content: {
        "application/json": {
          schema: resolver(z.object({ message: z.string() })),
        },
      },
    },
    400: {
      description: "Bad request",
      content: {
        "application/json": {
          schema: resolver(z.object({ error: z.string() })),
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

export const getUserCallsDescription = {
  tags: ["Calls"],
  description: "Get all calls for a user with pagination",
  responses: {
    200: {
      description: "List of calls",
      content: {
        "application/json": {
          schema: resolver(
            z.object({
              calls: z.array(z.any()),
              pagination: z.object({
                page: z.number(),
                limit: z.number(),
                totalCalls: z.number(),
                totalPages: z.number(),
                hasNextPage: z.boolean(),
                hasPreviousPage: z.boolean(),
              }),
            })
          ),
        },
      },
    },
    400: {
      description: "Bad request",
      content: {
        "application/json": {
          schema: resolver(z.object({ error: z.string() })),
        },
      },
    },
    403: {
      description: "Access denied",
      content: {
        "application/json": {
          schema: resolver(z.object({ error: z.string() })),
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

export const updateCallSummaryDescription = {
  tags: ["Calls"],
  description: "Update call summary",
  responses: {
    200: {
      description: "Summary updated successfully",
      content: {
        "application/json": {
          schema: resolver(z.object({ message: z.string() })),
        },
      },
    },
    400: {
      description: "Bad request",
      content: {
        "application/json": {
          schema: resolver(z.object({ error: z.string() })),
        },
      },
    },
    404: {
      description: "Call not found",
      content: {
        "application/json": {
          schema: resolver(z.object({ error: z.string() })),
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

export const addMemoryDescription = {
  tags: ["Calls"],
  description: "Add memory for a call",
  responses: {
    201: {
      description: "Memory added successfully",
      content: {
        "application/json": {
          schema: resolver(z.object({ message: z.string() })),
        },
      },
    },
    400: {
      description: "Bad request",
      content: {
        "application/json": {
          schema: resolver(z.object({ error: z.string() })),
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
