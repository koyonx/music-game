import type { AudioFeatures, Difficulty } from "@shared/types";
import { api } from "../api/client";

export async function generateChartViaClaude(
  songTitle: string,
  features: AudioFeatures,
  difficulty: Difficulty,
) {
  const res = await api.ai.generate({ songTitle, difficulty, features });
  return res.chart;
}
