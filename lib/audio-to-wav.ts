/**
 * Client-side audio → WAV converter using Web Audio API.
 * Converts any browser-supported format (MP3, OGG, M4A, FLAC, WAV)
 * to 16 kHz mono 16-bit PCM WAV for server-side YAMNet analysis.
 */

const TARGET_SR = 16_000;

export async function audioFileToWav(file: File): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new AudioContext({ sampleRate: TARGET_SR });

  try {
    const decoded = await audioCtx.decodeAudioData(arrayBuffer);
    const mono =
      decoded.numberOfChannels === 1
        ? decoded.getChannelData(0)
        : mixToMono(decoded);
    return encodeWav(mono, TARGET_SR);
  } finally {
    await audioCtx.close();
  }
}

function mixToMono(buf: AudioBuffer): Float32Array {
  const len = buf.length;
  const out = new Float32Array(len);
  const channels = buf.numberOfChannels;
  for (let ch = 0; ch < channels; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) out[i] += data[i];
  }
  for (let i = 0; i < len; i++) out[i] /= channels;
  return out;
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const numSamples = samples.length;
  const dataBytes = numSamples * 2; // 16-bit
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeString(view, 8, "WAVE");

  // fmt chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample

  // data chunk
  writeString(view, 36, "data");
  view.setUint32(40, dataBytes, true);

  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, Math.round(clamped * 32767), true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
