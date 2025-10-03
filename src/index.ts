import { Hono } from "hono";
import { corsMiddleware } from "./middleware/cors";
import { authMiddleware } from "./middleware/auth";
import agentsRoutes from "./agents/routes";
import usersRoutes from "./users/routes";
import callsRoutes from "./calls/routes";
import { openAPIRouteHandler } from "hono-openapi";
import { Scalar } from "@scalar/hono-api-reference";

const app = new Hono<{
  Bindings: Env;
  Variables: {
    userId: string;
    sessionId: string;
  };
}>();

// CORS middleware for cross-origin requests
app.use('*', corsMiddleware);

app.get("/", (c) => {
  return c.text("ZappyTalk Server");
});

// OpenAPI documentation endpoint
app.get(
  "/openapi",
  openAPIRouteHandler(app, {
    documentation: {
      info: {
        title: "ZappyTalk API",
        version: "1.0.0",
        description: "ZappyTalk Server API Documentation",
      },
      servers: [
        { url: "http://localhost:4000", description: "Local Development" },
        { url: "https://zappy-talk-server.numeric.workers.dev", description: "Production" },
      ],
    },
  })
);

// Scalar API Reference UI
app.get(
  "/scalar",
  Scalar({
    url: "/openapi",
    pageTitle: "ZappyTalk API Reference",
    theme: "default",
  })
);

// Apply auth middleware to protected agent routes
app.use("/get-agents", authMiddleware);
app.use("/dispatch-agent", authMiddleware);

// Mount agent routes
app.route("/", agentsRoutes);

// Apply auth middleware to protected user routes (except check-or-create)
app.use("/users/:user_id", authMiddleware);

// Mount user routes
app.route("/users", usersRoutes);

// Apply auth middleware to protected call routes
app.use("/calls", authMiddleware);
app.use("/calls/user/:user_id", authMiddleware);

// Mount call routes
app.route("/calls", callsRoutes);

export default app;
