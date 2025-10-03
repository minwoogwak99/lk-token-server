import { Hono } from "hono";
import { describeRoute, validator } from "hono-openapi";
import { checkOrCreateUserSchema, updateUserSchema } from "./schemas";
import { checkOrCreateUserDescription, getUserDescription, updateUserDescription } from "./route-descriptions";

const users = new Hono<{
  Bindings: Env;
  Variables: {
    userId: string;
    sessionId: string;
  };
}>();

// POST /check-or-create - Check if user exists, create if not (for sign-in flow)
users.post(
  "/check-or-create",
  describeRoute(checkOrCreateUserDescription),
  validator("json", checkOrCreateUserSchema),
  async (c) => {
    try {
      const body = c.req.valid("json");
      const { user_id, user_name, email, profile_img } = body;

      // Check if user already exists
      const existingUser = await c.env.zappytalk_db
        .prepare("SELECT * FROM users WHERE user_id = ? AND deleted_at IS NULL")
        .bind(user_id)
        .first();

      if (existingUser) {
        return c.json({
          exists: true,
          user: existingUser,
          message: "User already exists",
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

      return c.json(
        {
          exists: false,
          user: newUser,
          message: "User created successfully",
        },
        201
      );
    } catch (error) {
      console.error("Error in /check-or-create:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  }
);

// GET /:user_id - Get user information (authenticated)
users.get(
  "/:user_id",
  describeRoute(getUserDescription),
  async (c) => {
    try {
      const requestedUserId = c.req.param("user_id");
      const authenticatedUserId = c.get("userId");

      // Optional: Check if user is requesting their own data or has permission
      // For now, let's allow users to only access their own data
      if (requestedUserId !== authenticatedUserId) {
        return c.json(
          { error: "Access denied. You can only access your own user data." },
          403
        );
      }

      const user = await c.env.zappytalk_db
        .prepare(
          "SELECT user_id, user_name, email, profile_img, created_at, updated_at FROM users WHERE user_id = ? AND deleted_at IS NULL"
        )
        .bind(requestedUserId)
        .first();

      if (!user) {
        return c.json({ error: "User not found" }, 404);
      }

      return c.json({ user });
    } catch (error) {
      console.error("Error in /:user_id:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  }
);

// PUT /:user_id - Update user information (authenticated)
users.put(
  "/:user_id",
  describeRoute(updateUserDescription),
  validator("json", updateUserSchema),
  async (c) => {
    try {
      const requestedUserId = c.req.param("user_id");
      const authenticatedUserId = c.get("userId");

      // Ensure users can only edit their own data
      if (requestedUserId !== authenticatedUserId) {
        return c.json(
          { error: "Access denied. You can only edit your own user data." },
          403
        );
      }

      // Parse request body
      const body = c.req.valid("json");
      const { user_name, email, profile_img } = body;

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
        .prepare(
          "SELECT user_id, user_name, email, profile_img, created_at, updated_at FROM users WHERE user_id = ? AND deleted_at IS NULL"
        )
        .bind(requestedUserId)
        .first();

      return c.json({
        user: updatedUser,
        message: "User updated successfully",
      });
    } catch (error) {
      console.error("Error in PUT /:user_id:", error);

      // Handle unique constraint violation for email
      if (
        error instanceof Error &&
        error.message.includes("UNIQUE constraint failed")
      ) {
        return c.json(
          {
            error:
              "Email already exists. Please use a different email address.",
          },
          409
        );
      }

      return c.json({ error: "Internal server error" }, 500);
    }
  }
);

export default users;
