import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/client.js";

const noteSchema = z.object({
  time: z.number().nonnegative(),
  lane: z.number().int().min(0).max(5),
  holdMs: z.number().nonnegative().optional(),
});

const upsertBody = z.object({
  songId: z.string().uuid(),
  difficulty: z.enum(["easy", "normal", "hard", "expert"]),
  level: z.number().int().min(1).max(30),
  bpm: z.number().positive(),
  offsetMs: z.number().int().default(0),
  source: z.enum(["manual", "local-ai", "claude-ai"]),
  notes: z.array(noteSchema),
});

export const chartsRoutes = new Hono();

chartsRoutes.get("/", async (c) => {
  const songId = c.req.query("songId");
  const rows = songId
    ? await db.select().from(schema.charts).where(eq(schema.charts.songId, songId))
    : await db.select().from(schema.charts);
  return c.json(rows);
});

chartsRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const [row] = await db.select().from(schema.charts).where(eq(schema.charts.id, id));
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(row);
});

chartsRoutes.post("/", async (c) => {
  const body = upsertBody.parse(await c.req.json());
  const [created] = await db.insert(schema.charts).values(body).returning();
  return c.json(created, 201);
});

chartsRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = upsertBody.parse(await c.req.json());
  const [updated] = await db
    .update(schema.charts)
    .set(body)
    .where(eq(schema.charts.id, id))
    .returning();
  if (!updated) return c.json({ error: "not found" }, 404);
  return c.json(updated);
});

chartsRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await db.delete(schema.charts).where(eq(schema.charts.id, id));
  return c.json({ ok: true });
});
