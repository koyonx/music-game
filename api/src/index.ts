import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import { songsRoutes } from "./routes/songs.js";
import { chartsRoutes } from "./routes/charts.js";
import { scoresRoutes } from "./routes/scores.js";
import { aiRoutes } from "./routes/ai.js";

const app = new Hono();

app.use("*", logger());
app.use("*", cors({ origin: "*" }));

app.get("/health", (c) => c.json({ ok: true }));

app.route("/api/songs", songsRoutes);
app.route("/api/charts", chartsRoutes);
app.route("/api/scores", scoresRoutes);
app.route("/api/ai", aiRoutes);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message ?? "internal error" }, 500);
});

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port, hostname: "0.0.0.0" });
console.log(`api listening on :${port}`);
