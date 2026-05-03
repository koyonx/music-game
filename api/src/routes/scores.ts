import { Hono } from "hono";
import { z } from "zod";
import { desc, eq, max, sql } from "drizzle-orm";
import { db, schema } from "../db/client.js";

const summarySchema = z.object({
  perfect: z.number().int().nonnegative(),
  great: z.number().int().nonnegative(),
  good: z.number().int().nonnegative(),
  miss: z.number().int().nonnegative(),
  maxCombo: z.number().int().nonnegative(),
  totalNotes: z.number().int().nonnegative(),
  score: z.number().int().min(0).max(1_000_000),
  accuracy: z.number().min(0).max(1),
  fullCombo: z.boolean(),
  allPerfect: z.boolean(),
});

const judgmentSchema = z.object({
  noteIndex: z.number().int().nonnegative(),
  lane: z.number().int().min(0).max(5),
  expectedTime: z.number().nonnegative(),
  actualTime: z.number().nullable(),
  judgment: z.enum(["perfect", "great", "good", "miss"]),
  deltaMs: z.number(),
});

const postBody = z.object({
  chartId: z.string().uuid(),
  playerId: z.string().uuid().optional(),
  themeUsed: z.string().default("default"),
  summary: summarySchema,
  judgments: z.array(judgmentSchema),
});

export const scoresRoutes = new Hono();

scoresRoutes.post("/", async (c) => {
  const body = postBody.parse(await c.req.json());
  const [score] = await db
    .insert(schema.scores)
    .values({
      chartId: body.chartId,
      playerId: body.playerId ?? null,
      themeUsed: body.themeUsed,
      score: body.summary.score,
      accuracy: body.summary.accuracy,
      perfect: body.summary.perfect,
      great: body.summary.great,
      good: body.summary.good,
      miss: body.summary.miss,
      maxCombo: body.summary.maxCombo,
      totalNotes: body.summary.totalNotes,
      fullCombo: body.summary.fullCombo,
      allPerfect: body.summary.allPerfect,
    })
    .returning();

  if (body.judgments.length > 0) {
    // Chunk to keep parameter counts reasonable.
    const chunkSize = 500;
    for (let i = 0; i < body.judgments.length; i += chunkSize) {
      const chunk = body.judgments.slice(i, i + chunkSize).map((j) => ({
        scoreId: score.id,
        noteIndex: j.noteIndex,
        lane: j.lane,
        expectedTime: j.expectedTime,
        actualTime: j.actualTime,
        judgment: j.judgment,
        deltaMs: j.deltaMs,
      }));
      await db.insert(schema.scoreJudgments).values(chunk);
    }
  }
  return c.json(score, 201);
});

scoresRoutes.get("/", async (c) => {
  const chartId = c.req.query("chartId");
  const limit = Math.min(Number(c.req.query("limit") ?? "50"), 500);
  const rows = chartId
    ? await db
        .select()
        .from(schema.scores)
        .where(eq(schema.scores.chartId, chartId))
        .orderBy(desc(schema.scores.playedAt))
        .limit(limit)
    : await db
        .select()
        .from(schema.scores)
        .orderBy(desc(schema.scores.playedAt))
        .limit(limit);
  return c.json(rows);
});

scoresRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const [row] = await db.select().from(schema.scores).where(eq(schema.scores.id, id));
  if (!row) return c.json({ error: "not found" }, 404);
  const judgments = await db
    .select()
    .from(schema.scoreJudgments)
    .where(eq(schema.scoreJudgments.scoreId, id));
  return c.json({ ...row, judgments });
});

scoresRoutes.get("/stats/:chartId", async (c) => {
  const chartId = c.req.param("chartId");
  // Best run: pick the single row with the highest score, and report ITS
  // accuracy. Computing max(score) and max(accuracy) independently can
  // surface a (score, accuracy) pair that no actual play achieved.
  const [best] = await db
    .select({ score: schema.scores.score, accuracy: schema.scores.accuracy })
    .from(schema.scores)
    .where(eq(schema.scores.chartId, chartId))
    .orderBy(desc(schema.scores.score), desc(schema.scores.accuracy))
    .limit(1);

  const [agg] = await db
    .select({
      playCount: sql<number>`count(*)::int`,
      lastPlayedAt: max(schema.scores.playedAt),
      fullComboCount: sql<number>`sum(case when ${schema.scores.fullCombo} then 1 else 0 end)::int`,
      allPerfectCount: sql<number>`sum(case when ${schema.scores.allPerfect} then 1 else 0 end)::int`,
    })
    .from(schema.scores)
    .where(eq(schema.scores.chartId, chartId));

  return c.json({
    chartId,
    bestScore: best?.score ?? 0,
    bestAccuracy: best?.accuracy ?? 0,
    playCount: agg?.playCount ?? 0,
    lastPlayedAt: agg?.lastPlayedAt ?? null,
    fullComboCount: agg?.fullComboCount ?? 0,
    allPerfectCount: agg?.allPerfectCount ?? 0,
  });
});
