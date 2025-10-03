import { resolver } from "hono-openapi";
import { z } from "zod";

export const checkOrCreateUserDescription = {
  tags: ["Users"],
  description: "Check if user exists, create if not",
  responses: {
    200: {
      description: "User already exists",
      content: {
        "application/json": {
          schema: resolver(
            z.object({
              exists: z.boolean(),
              user: z.any(),
              message: z.string(),
            })
          ),
        },
      },
    },
    201: {
      description: "User created",
      content: {
        "application/json": {
          schema: resolver(
            z.object({
              exists: z.boolean(),
              user: z.any(),
              message: z.string(),
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

export const getUserDescription = {
  tags: ["Users"],
  description: "Get user information",
  responses: {
    200: {
      description: "User found",
      content: {
        "application/json": {
          schema: resolver(z.object({ user: z.any() })),
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
    404: {
      description: "User not found",
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

export const updateUserDescription = {
  tags: ["Users"],
  description: "Update user information",
  responses: {
    200: {
      description: "User updated",
      content: {
        "application/json": {
          schema: resolver(
            z.object({
              user: z.any(),
              message: z.string(),
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
    404: {
      description: "User not found",
      content: {
        "application/json": {
          schema: resolver(z.object({ error: z.string() })),
        },
      },
    },
    409: {
      description: "Email already exists",
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
