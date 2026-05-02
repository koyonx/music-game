import { pgTable, uuid, text, integer, real, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";

export const players = pgTable("players", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const songs = pgTable("songs", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  artist: text("artist").notNull().default(""),
  durationSec: real("duration_sec").notNull(),
  bpm: real("bpm"),
  audioHash: text("audio_hash").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const charts = pgTable(
  "charts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    songId: uuid("song_id")
      .notNull()
      .references(() => songs.id, { onDelete: "cascade" }),
    difficulty: text("difficulty").notNull(), // easy/normal/hard/expert
    level: integer("level").notNull(),
    bpm: real("bpm").notNull(),
    offsetMs: integer("offset_ms").notNull().default(0),
    source: text("source").notNull(), // manual/local-ai/claude-ai
    notes: jsonb("notes").notNull(), // Note[]
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    bySong: index("charts_by_song").on(t.songId),
  }),
);

export const scores = pgTable(
  "scores",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chartId: uuid("chart_id")
      .notNull()
      .references(() => charts.id, { onDelete: "cascade" }),
    playerId: uuid("player_id").references(() => players.id, { onDelete: "set null" }),
    themeUsed: text("theme_used").notNull().default("default"),
    score: integer("score").notNull(),
    accuracy: real("accuracy").notNull(),
    perfect: integer("perfect").notNull().default(0),
    great: integer("great").notNull().default(0),
    good: integer("good").notNull().default(0),
    miss: integer("miss").notNull().default(0),
    maxCombo: integer("max_combo").notNull().default(0),
    totalNotes: integer("total_notes").notNull().default(0),
    fullCombo: boolean("full_combo").notNull().default(false),
    allPerfect: boolean("all_perfect").notNull().default(false),
    playedAt: timestamp("played_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    byChart: index("scores_by_chart").on(t.chartId),
    byPlayed: index("scores_by_played").on(t.playedAt),
  }),
);

export const scoreJudgments = pgTable(
  "score_judgments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scoreId: uuid("score_id")
      .notNull()
      .references(() => scores.id, { onDelete: "cascade" }),
    noteIndex: integer("note_index").notNull(),
    lane: integer("lane").notNull(),
    expectedTime: real("expected_time").notNull(),
    actualTime: real("actual_time"),
    judgment: text("judgment").notNull(),
    deltaMs: real("delta_ms").notNull().default(0),
  },
  (t) => ({
    byScore: index("judgments_by_score").on(t.scoreId),
  }),
);
