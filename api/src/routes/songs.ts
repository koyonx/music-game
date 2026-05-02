import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/client.js";

const upsertBody = z.object({
  title: z.string().min(1),
  artist: z.string().default(""),
  durationSec: z.number().positive(),
  bpm: z.number().positive().optional(),
  audioHash: z.string().min(8),
});

export const songsRoutes = new Hono();

songsRoutes.get("/", async (c) => {
  const rows = await db.select().from(schema.songs).orderBy(schema.songs.createdAt);
  return c.json(rows);
});

songsRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const [row] = await db.select().from(schema.songs).where(eq(schema.songs.id, id));
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(row);
});

// Upsert by audioHash so re-uploading the same file doesn't duplicate.
songsRoutes.post("/", async (c) => {
  const body = upsertBody.parse(await c.req.json());
  const [existing] = await db
    .select()
    .from(schema.songs)
    .where(eq(schema.songs.audioHash, body.audioHash));
  if (existing) {
    const [updated] = await db
      .update(schema.songs)
      .set({
        title: body.title,
        artist: body.artist,
        durationSec: body.durationSec,
        bpm: body.bpm ?? existing.bpm,
      })
      .where(eq(schema.songs.id, existing.id))
      .returning();
    return c.json(updated);
  }
  const [created] = await db.insert(schema.songs).values(body).returning();
  return c.json(created, 201);
});

songsRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await db.delete(schema.songs).where(eq(schema.songs.id, id));
  return c.json({ ok: true });
});
