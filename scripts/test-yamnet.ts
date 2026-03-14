/**
 * CLI test script for the YAMNet analyzer (production config).
 *
 * Usage:
 *   bun scripts/test-yamnet.ts <wav-file> [model-url]
 *
 * model-url defaults to loading from public/yamnet-model/ via file:// protocol.
 * For non-WAV files, convert first: ffmpeg -i input.mp3 -ar 16000 -ac 1 output.wav
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { analyzeAudio } from "../lib/yamnet-analyzer";

const filePath = process.argv[2];
const modelUrl =
  process.argv[3] ??
  `file://${path.resolve("public/yamnet-model")}/model.json`;

if (!filePath) {
  console.error("Usage: bun scripts/test-yamnet.ts <wav-file> [model-url]");
  process.exit(1);
}

const abs = path.resolve(filePath);
console.error(`Analyzing: ${abs}`);
console.error(`Model:     ${modelUrl}\n`);

const audioBuffer = new Uint8Array(fs.readFileSync(abs));

analyzeAudio(audioBuffer, { modelUrl })
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
  });
