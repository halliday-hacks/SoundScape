#!/usr/bin/env bun
/**
 * Setup script: verify the YAMNet TF.js model files are present.
 *
 * The model files are committed to git under public/yamnet-model/ so a
 * normal `git clone` is all that's needed. This script just confirms
 * everything is in place and prints the model path for the API route.
 *
 * Usage:
 *   bun scripts/setup-yamnet.ts
 */

import fs from "node:fs";
import path from "node:path";

const MODEL_DIR = path.resolve("public/yamnet-model");

const REQUIRED_FILES = [
  "model.json",
  "group1-shard1of4.bin",
  "group1-shard2of4.bin",
  "group1-shard3of4.bin",
  "group1-shard4of4.bin",
];

console.log("Checking YAMNet model files...\n");

let allPresent = true;

for (const file of REQUIRED_FILES) {
  const filePath = path.join(MODEL_DIR, file);
  if (fs.existsSync(filePath)) {
    const size = fs.statSync(filePath).size;
    console.log(`  ✓  ${file} (${(size / 1024 / 1024).toFixed(1)} MB)`);
  } else {
    console.error(`  ✗  ${file} — MISSING`);
    allPresent = false;
  }
}

console.log();

if (!allPresent) {
  console.error("Some model files are missing.");
  console.error("The YAMNet TF.js model is committed to git.");
  console.error("Make sure you cloned the full repo (not a shallow clone):\n");
  console.error("  git clone --depth=1 <repo-url>   ← may skip large files");
  console.error("  git clone <repo-url>              ← use this instead\n");
  console.error("Or fetch the missing files explicitly:");
  console.error("  git fetch --unshallow\n");
  process.exit(1);
}

const modelUrl = `file://${MODEL_DIR}/model.json`;
console.log("All model files present.\n");
console.log("Model URL (used by the API route in local dev):");
console.log(`  ${modelUrl}\n`);
console.log("To verify the model works, run:");
console.log("  bun scripts/test-yamnet.ts <path-to-audio.wav>\n");
