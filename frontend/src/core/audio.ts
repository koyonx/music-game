// Wraps Web Audio API: load a Blob, decode, play with low-latency clock.

export interface AudioHandle {
  ctx: AudioContext;
  buffer: AudioBuffer;
  durationSec: number;
  // start() resumes the AudioContext if needed (browsers' autoplay policy
  // leaves it suspended until a user gesture), then begins playback. The
  // returned promise resolves once playback has actually started.
  start: (offsetSec?: number) => Promise<void>;
  stop: () => void;
  // Stop and release the AudioContext. Call from screen teardown — browsers
  // (Safari/iOS in particular) cap concurrent contexts and stop accepting
  // new playback once the cap is reached.
  close: () => Promise<void>;
  // Returns elapsed seconds since start() was called (0 if not playing).
  elapsedSec: () => number;
  isPlaying: () => boolean;
}

export async function loadAudio(blob: Blob): Promise<AudioHandle> {
  const ctx = new AudioContext();
  const arrayBuffer = await blob.arrayBuffer();
  const buffer = await ctx.decodeAudioData(arrayBuffer);

  let source: AudioBufferSourceNode | null = null;
  let startCtxTime = 0;
  let startOffset = 0;
  let playing = false;
  let everStarted = false;

  const stop = () => {
    if (source) {
      try {
        source.stop();
      } catch {}
      source.disconnect();
      source = null;
    }
    playing = false;
  };

  return {
    ctx,
    buffer,
    durationSec: buffer.duration,
    async start(offsetSec = 0) {
      stop();
      // Browsers (Safari/iOS, many Chrome setups) leave AudioContexts in
      // `suspended` state until a user gesture. Without this resume the
      // visual timer would advance while playback stayed silent.
      if (ctx.state === "suspended") {
        try {
          await ctx.resume();
        } catch {}
      }
      source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => {
        playing = false;
      };
      startCtxTime = ctx.currentTime;
      startOffset = offsetSec;
      source.start(0, offsetSec);
      playing = true;
      everStarted = true;
    },
    stop,
    async close() {
      stop();
      try {
        await ctx.close();
      } catch {}
    },
    // Wall-time elapsed since `start()` was last called, in seconds.
    // Keeps advancing using the AudioContext clock even after playback
    // ends, so callers (the game loop) can continue judging notes that
    // sit past the buffer end due to a positive timing offset.
    elapsedSec() {
      if (!everStarted) return 0;
      return ctx.currentTime - startCtxTime + startOffset;
    },
    isPlaying() {
      return playing;
    },
  };
}
