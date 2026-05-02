import { Hono } from "hono";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";

const featuresSchema = z.object({
  durationSec: z.number().positive(),
  bpm: z.number().positive(),
  beats: z.array(z.number().nonnegative()),
  onsets: z.array(
    z.object({
      time: z.number().nonnegative(),
      band: z.union([z.literal(0), z.literal(1), z.literal(2)]),
      strength: z.number().min(0).max(1),
    }),
  ),
});

const generateBody = z.object({
  songTitle: z.string().min(1),
  difficulty: z.enum(["easy", "normal", "hard", "expert"]),
  features: featuresSchema,
});

const SYSTEM_PROMPT = `You are an expert rhythm game chart designer for a 6-key falling-note game (lanes 0-5, mapped to keys S D F J K L).

Your task: convert audio analysis features (BPM, beat times, spectral onsets) into a playable note chart in strict JSON.

Note placement rules:
- A "note" is { "time": <seconds from song start>, "lane": <0-5>, "holdMs": <optional, omit for taps> }
- Map low-frequency onsets (band 0, kick/bass) toward lanes 0-1 or 4-5 (outer)
- Map mid onsets (band 1, snare/vocal) toward lanes 2-3 (inner)
- Map high onsets (band 2, hi-hat/cymbal) freely; favor lanes 1-4
- Avoid placing two notes in the same lane within 80ms
- Do not stack more than 3 simultaneous notes (same time +/- 20ms)
- Prefer notes on or near beat times for readability

Difficulty density targets (approx notes/second over the playable region):
- easy: 1.5
- normal: 3.0
- hard: 5.0
- expert: 8.0

Patterning principles:
- Mix single taps, alternations between hands (lanes 0-2 vs 3-5), and short rolls
- Use occasional long notes (holdMs >= 250) on sustained sounds for variety; keep <10% of total notes
- Keep the first 1.5 seconds empty as lead-in
- Stop placing notes 0.5s before durationSec

Output format: Return ONLY a JSON object matching the provided schema. No prose, no markdown fences.`;

export const aiRoutes = new Hono();

aiRoutes.post("/generate", async (c) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return c.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server" },
      503,
    );
  }

  const body = generateBody.parse(await c.req.json());

  const client = new Anthropic({ apiKey });

  const userPayload = {
    songTitle: body.songTitle,
    difficulty: body.difficulty,
    features: {
      durationSec: body.features.durationSec,
      bpm: body.features.bpm,
      beatCount: body.features.beats.length,
      beats: body.features.beats,
      onsets: body.features.onsets,
    },
  };

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              difficulty: {
                type: "string",
                enum: ["easy", "normal", "hard", "expert"],
              },
              level: { type: "integer", minimum: 1, maximum: 30 },
              bpm: { type: "number" },
              offsetMs: { type: "integer" },
              source: { type: "string", enum: ["claude-ai"] },
              notes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    time: { type: "number" },
                    lane: { type: "integer", minimum: 0, maximum: 5 },
                    holdMs: { type: "number" },
                  },
                  required: ["time", "lane"],
                  additionalProperties: false,
                },
              },
            },
            required: ["difficulty", "level", "bpm", "offsetMs", "source", "notes"],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: "user",
          content: `Generate a 6-key chart for this song.\n\n${JSON.stringify(userPayload)}`,
        },
      ],
    });

    const textBlock = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text",
    );
    if (!textBlock) {
      return c.json({ error: "model returned no text content" }, 502);
    }

    let chart;
    try {
      chart = JSON.parse(textBlock.text);
    } catch {
      return c.json(
        { error: "model returned invalid JSON", raw: textBlock.text.slice(0, 500) },
        502,
      );
    }

    return c.json({
      chart,
      usage: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
        cacheRead: response.usage.cache_read_input_tokens ?? 0,
        cacheWrite: response.usage.cache_creation_input_tokens ?? 0,
      },
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return c.json({ error: "rate limited by Anthropic, try again shortly" }, 429);
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return c.json({ error: "invalid ANTHROPIC_API_KEY on server" }, 401);
    }
    if (err instanceof Anthropic.APIError) {
      return c.json({ error: `anthropic api error: ${err.message}` }, err.status ?? 502);
    }
    throw err;
  }
});
