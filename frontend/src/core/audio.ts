// Wraps Web Audio API: load a Blob, decode, play with low-latency clock.

export interface AudioHandle {
  ctx: AudioContext;
  buffer: AudioBuffer;
  durationSec: number;
  start: (offsetSec?: number) => void;
  stop: () => void;
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

  return {
    ctx,
    buffer,
    durationSec: buffer.duration,
    start(offsetSec = 0) {
      this.stop();
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
    },
    stop() {
      if (source) {
        try {
          source.stop();
        } catch {}
        source.disconnect();
        source = null;
      }
      playing = false;
    },
    elapsedSec() {
      if (!playing) return 0;
      return ctx.currentTime - startCtxTime + startOffset;
    },
    isPlaying() {
      return playing;
    },
  };
}
