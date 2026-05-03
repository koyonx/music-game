import type {
  Chart,
  Song,
  ScorePost,
  ScoreRecord,
  ChartStats,
  AiGenerateRequest,
  AiGenerateResponse,
} from "@shared/types";

const BASE = (import.meta.env.VITE_API_BASE as string) || "http://localhost:8787";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  songs: {
    list: () => req<Song[]>(`/api/songs`),
    get: (id: string) => req<Song>(`/api/songs/${id}`),
    upsert: (s: Omit<Song, "id" | "createdAt">) =>
      req<Song>(`/api/songs`, { method: "POST", body: JSON.stringify(s) }),
    delete: (id: string) =>
      req<{ ok: true }>(`/api/songs/${id}`, { method: "DELETE" }),
  },
  charts: {
    listForSong: (songId: string) => req<Chart[]>(`/api/charts?songId=${songId}`),
    get: (id: string) => req<Chart>(`/api/charts/${id}`),
    create: (c: Omit<Chart, "id" | "createdAt">) =>
      req<Chart>(`/api/charts`, { method: "POST", body: JSON.stringify(c) }),
    update: (id: string, c: Omit<Chart, "id" | "createdAt">) =>
      req<Chart>(`/api/charts/${id}`, { method: "PUT", body: JSON.stringify(c) }),
    delete: (id: string) =>
      req<{ ok: true }>(`/api/charts/${id}`, { method: "DELETE" }),
  },
  scores: {
    post: (s: ScorePost) =>
      req<ScoreRecord>(`/api/scores`, { method: "POST", body: JSON.stringify(s) }),
    list: (chartId?: string, limit = 50) =>
      req<ScoreRecord[]>(
        `/api/scores?${chartId ? `chartId=${chartId}&` : ""}limit=${limit}`,
      ),
    get: (id: string) => req<ScoreRecord>(`/api/scores/${id}`),
    stats: (chartId: string) => req<ChartStats>(`/api/scores/stats/${chartId}`),
  },
  ai: {
    generate: (body: AiGenerateRequest) =>
      req<AiGenerateResponse & { usage?: unknown }>(`/api/ai/generate`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
  },
};
