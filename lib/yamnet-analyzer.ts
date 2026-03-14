/**
 * YAMNet Audio Analyzer — production-ready TypeScript port of yamnet.py
 *
 * Runs in any JS runtime (Convex "use node" actions, Vercel serverless,
 * browser workers). No native bindings or filesystem access required.
 *
 * Model: Loaded once from a URL via tf.loadGraphModel() and cached in
 * process memory. Point YAMNET_MODEL_URL at the deployed /yamnet-model/
 * directory (served by Vercel CDN from public/).
 *
 * Audio: Accepts 16-bit or 32-bit PCM WAV buffers. For MP3/OGG/etc.,
 * convert client-side using lib/audio-to-wav.ts before uploading.
 */

import * as tf from "@tensorflow/tfjs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface YAMNetTopLabel {
  label: string;
  score: number;
}

export interface YAMNetResult {
  upload_id: string;
  duration_s: number;
  n_frames: number;
  primary_label: string;
  primary_confidence: number;
  needs_review: boolean;
  top_labels: YAMNetTopLabel[];
  /** 1024-D L2-normalised mean embedding — suitable for similarity search */
  embedding: number[];
  latency_ms: {
    preprocess: number;
    inference: number;
    total: number;
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CLASS_MAP_URL =
  "https://raw.githubusercontent.com/tensorflow/models/master/research/audioset/yamnet/yamnet_class_map.csv";

const TARGET_SAMPLE_RATE = 16_000;
const MIN_WAVEFORM_SAMPLES = 15_600; // ~0.975 s — one YAMNet frame

// ---------------------------------------------------------------------------
// Singletons (initialised once per worker/process lifetime)
// ---------------------------------------------------------------------------

let _model: tf.GraphModel | null = null;
let _classNames: string[] | null = null;
let _modelUrl: string | null = null;

async function loadModel(modelUrl: string): Promise<tf.GraphModel> {
  // Reload if URL changed (shouldn't happen in practice)
  if (_model && _modelUrl === modelUrl) return _model;
  _model = await tf.loadGraphModel(modelUrl);
  _modelUrl = modelUrl;
  return _model;
}

async function loadClassNames(): Promise<string[]> {
  if (_classNames) return _classNames;
  const res = await fetch(CLASS_MAP_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch YAMNet class map: ${res.status}`);
  }
  const text = await res.text();
  // CSV columns: index, mid, display_name
  _classNames = text
    .trim()
    .split("\n")
    .slice(1) // skip header
    .map((line) => {
      const parts = line.split(",");
      return (parts[2] ?? "").replace(/^"|"$/g, "").trim();
    });
  return _classNames;
}

// ---------------------------------------------------------------------------
// Audio helpers (replaces librosa)
// ---------------------------------------------------------------------------

/**
 * Parse a 16-bit or 32-bit PCM WAV buffer into a mono Float32Array
 * at the file's native sample rate.
 */
function parseWav(buf: Uint8Array): {
  samples: Float32Array;
  sampleRate: number;
} {
  // RIFF header check
  if (buf[0] !== 0x52 || buf[1] !== 0x49 || buf[2] !== 0x46 || buf[3] !== 0x46) {
    throw new Error("Not a valid WAV file (missing RIFF header)");
  }

  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const numChannels = view.getUint16(22, true);
  const sampleRate = view.getUint32(24, true);
  const bitsPerSample = view.getUint16(34, true);

  if (bitsPerSample !== 16 && bitsPerSample !== 32) {
    throw new Error(
      `Unsupported bitsPerSample: ${bitsPerSample}. Use 16 or 32.`
    );
  }

  // Walk chunks to find "data"
  let offset = 12;
  while (offset < buf.length - 8) {
    const id =
      String.fromCharCode(buf[offset]) +
      String.fromCharCode(buf[offset + 1]) +
      String.fromCharCode(buf[offset + 2]) +
      String.fromCharCode(buf[offset + 3]);
    const size = view.getUint32(offset + 4, true);
    if (id === "data") {
      offset += 8;
      break;
    }
    offset += 8 + size;
  }

  const bytesPerSample = bitsPerSample / 8;
  const totalSamples = Math.floor(
    (buf.length - offset) / (numChannels * bytesPerSample)
  );
  const mono = new Float32Array(totalSamples);

  for (let i = 0; i < totalSamples; i++) {
    let sum = 0;
    for (let ch = 0; ch < numChannels; ch++) {
      const pos = offset + (i * numChannels + ch) * bytesPerSample;
      sum +=
        bitsPerSample === 16
          ? view.getInt16(pos, true) / 32768
          : view.getFloat32(pos, true);
    }
    mono[i] = sum / numChannels;
  }

  return { samples: mono, sampleRate };
}

/** Linear interpolation resampler (replaces librosa.resample). */
function resample(
  samples: Float32Array,
  fromRate: number,
  toRate: number
): Float32Array {
  if (fromRate === toRate) return samples;
  const ratio = fromRate / toRate;
  const outLen = Math.floor(samples.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio;
    const lo = Math.floor(pos);
    const hi = Math.min(lo + 1, samples.length - 1);
    out[i] = samples[lo] + (samples[hi] - samples[lo]) * (pos - lo);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

function l2Normalize(vec: Float32Array): Float32Array {
  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm === 0) return vec;
  const out = new Float32Array(vec.length);
  for (let i = 0; i < vec.length; i++) out[i] = vec[i] / norm;
  return out;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export interface AnalyzeOptions {
  /** Full URL to the TF.js model.json file */
  modelUrl: string;
  /** Optional ID to embed in the result (defaults to a random string) */
  uploadId?: string;
}

/**
 * Analyse a WAV audio buffer with YAMNet.
 *
 * @param audioBuffer  WAV file as Uint8Array or Buffer
 * @param options      Model URL + optional upload ID
 * @returns            Structured classification JSON
 */
export async function analyzeAudio(
  audioBuffer: Uint8Array,
  options: AnalyzeOptions
): Promise<YAMNetResult> {
  const startTotal = Date.now();

  // -------------------------------------------------------------------------
  // 1. Preprocess
  // -------------------------------------------------------------------------
  const startPre = Date.now();

  let waveform: Float32Array;
  let duration: number;

  try {
    const { samples, sampleRate } = parseWav(audioBuffer);
    waveform = resample(samples, sampleRate, TARGET_SAMPLE_RATE);
    duration = waveform.length / TARGET_SAMPLE_RATE;
  } catch (err) {
    throw new Error(
      `Failed to process audio: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Pad to at least one YAMNet frame
  if (waveform.length < MIN_WAVEFORM_SAMPLES) {
    const padded = new Float32Array(TARGET_SAMPLE_RATE);
    padded.set(waveform);
    waveform = padded;
  }

  // Silence check — mirrors Python's peak amplitude threshold
  let maxAmp = 0;
  for (let i = 0; i < waveform.length; i++) {
    const abs = Math.abs(waveform[i]);
    if (abs > maxAmp) maxAmp = abs;
  }
  const isSilent = maxAmp < 0.001;

  const latencyPre = Date.now() - startPre;

  // -------------------------------------------------------------------------
  // 2. Inference (load model + class names in parallel)
  // -------------------------------------------------------------------------
  const startInf = Date.now();

  const [model, classNames] = await Promise.all([
    loadModel(options.modelUrl),
    loadClassNames(),
  ]);

  const waveformTensor = tf.tensor1d(waveform);

  // GraphModel.predict returns Tensor | Tensor[] — normalise to array.
  // Detect tensors by trailing dimension: scores=521, embeddings=1024.
  const rawOutputs = model.predict(waveformTensor);
  const allTensors = (
    Array.isArray(rawOutputs) ? rawOutputs : [rawOutputs]
  ) as tf.Tensor[];

  const scoresTensor = allTensors.find(
    (t) => t.shape[t.shape.length - 1] === 521
  );
  const embeddingsTensor = allTensors.find(
    (t) => t.shape[t.shape.length - 1] === 1024
  );

  if (!scoresTensor || !embeddingsTensor) {
    const shapes = allTensors.map((t) => t.shape).join("; ");
    throw new Error(
      `Unexpected YAMNet output shapes (need 521 + 1024): ${shapes}`
    );
  }

  const [scoresArr, embeddingsArr] = await Promise.all([
    scoresTensor.array() as Promise<number[][] | number[]>,
    embeddingsTensor.array() as Promise<number[][] | number[]>,
  ]);

  // Cleanup tensors
  waveformTensor.dispose();
  for (let i = 0; i < allTensors.length; i++) allTensors[i].dispose();

  // Handle both 2D (frames×classes) and 1D (single frame) outputs
  const scores2d = (
    Array.isArray(scoresArr[0]) ? scoresArr : [scoresArr]
  ) as number[][];
  const embeddings2d = (
    Array.isArray(embeddingsArr[0]) ? embeddingsArr : [embeddingsArr]
  ) as number[][];

  const nFrames = scores2d.length;
  const nClasses = scores2d[0].length;

  // Mean pooling across time frames (mirrors np.mean(scores, axis=0))
  const meanScores = new Float32Array(nClasses);
  for (const frame of scores2d) {
    for (let i = 0; i < nClasses; i++) meanScores[i] += frame[i];
  }
  for (let i = 0; i < nClasses; i++) meanScores[i] /= nFrames;

  // Mean embedding, then L2-normalise (mirrors Python implementation)
  const embDim = embeddings2d[0].length;
  const meanEmb = new Float32Array(embDim);
  for (const frame of embeddings2d) {
    for (let i = 0; i < embDim; i++) meanEmb[i] += frame[i];
  }
  for (let i = 0; i < embDim; i++) meanEmb[i] /= embeddings2d.length;
  const normalizedEmbedding = l2Normalize(meanEmb);

  // Top-5 classes by mean score
  const top5 = Array.from(meanScores)
    .map((s, i) => ({ s, i }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 5);

  const latencyInf = Date.now() - startInf;

  // -------------------------------------------------------------------------
  // 3. Format output
  // -------------------------------------------------------------------------
  const topLabels: YAMNetTopLabel[] = top5.map(({ s, i }) => ({
    label: classNames[i] ?? `class_${i}`,
    score: Math.round(s * 10_000) / 10_000,
  }));

  const primaryLabel = topLabels[0].label;
  const primaryScore = topLabels[0].score;
  const needsReview = isSilent || primaryScore < 0.15;

  return {
    upload_id:
      options.uploadId ??
      `demo-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`,
    duration_s: Math.round(duration * 10) / 10,
    n_frames: nFrames,
    primary_label: isSilent ? "Silence" : primaryLabel,
    primary_confidence: isSilent ? 0 : primaryScore,
    needs_review: needsReview,
    top_labels: topLabels,
    embedding: Array.from(normalizedEmbedding),
    latency_ms: {
      preprocess: latencyPre,
      inference: latencyInf,
      total: Date.now() - startTotal,
    },
  };
}
