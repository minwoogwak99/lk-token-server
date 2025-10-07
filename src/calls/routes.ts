import { Hono } from "hono";
import { describeRoute, validator } from "hono-openapi";
import { createCallSchema, addMemorySchema, paginationQuerySchema } from "./schemas";
import { createCallDescription, getUserCallsDescription, addMemoryDescription } from "./route-descriptions";

const calls = new Hono<{
  Bindings: Env;
  Variables: {
    userId: string;
    sessionId: string;
  };
}>();

// POST / - Store a new call record
calls.post(
  "/",
  describeRoute(createCallDescription),
  validator("json", createCallSchema),
  async (c) => {
    try {
      const body = c.req.valid("json");
      const { id, user_id, agent_name, started_at, ended_at, messages_json, user_location, room_id } = body;

      // Insert the session log record
      const result = await c.env.zappytalk_db
        .prepare(`
        INSERT INTO calls (id, user_id, agent_name, started_at, ended_at, deleted_at, messages_json, location, room_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
        .bind(id, user_id, agent_name, started_at, ended_at, null, messages_json, user_location || null, room_id || null)
        .run();

      if (!result.success) {
        return c.json({ error: "Failed to create session log" }, 500);
      }

      return c.json(
        {
          message: "Session log created successfully",
        },
        201
      );
    } catch (error) {
      console.error("Error in /:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  }
);

// GET /user/:user_id - Get all calls for a user with pagination
calls.get(
  "/user/:user_id",
  describeRoute(getUserCallsDescription),
  validator("query", paginationQuerySchema),
  async (c) => {
    try {
      const requestedUserId = c.req.param("user_id");
      const authenticatedUserId = c.get("userId");

      // Ensure users can only access their own calls
      if (requestedUserId !== authenticatedUserId) {
        return c.json({ error: "Access denied. You can only access your own call data." }, 403);
      }

      const query = c.req.valid("query");
      const { page, limit } = query;

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
          hasPreviousPage: page > 1,
        },
      });
    } catch (error) {
      console.error("Error in GET /user/:user_id:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  }
);

// POST /add-memory - Add memory for a call
calls.post(
  "/add-memory",
  describeRoute(addMemoryDescription),
  validator("json", addMemorySchema),
  async (c) => {
    try {
      const body = c.req.valid("json");
      const { room_id, user_id, embedding_id, memory, memory_type } = body;

      const memory_id = crypto.randomUUID();
      const created_at = new Date().toISOString();

      const result = await c.env.zappytalk_db
        .prepare(`
      INSERT INTO memories (memory_id, room_id, user_id, embedding_id, memory, memory_type, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
        .bind(memory_id, room_id, user_id, embedding_id, memory, memory_type, created_at)
        .run();

      if (!result.success) {
        return c.json({ error: "Failed to add memory" }, 500);
      }

      return c.json({ message: "Memory added successfully" }, 201);
    } catch (error) {
      console.error("Error in /add-memory:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  }
);

export default calls;
