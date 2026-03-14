#!/usr/bin/env python3
"""
One-time setup: download the YAMNet SavedModel from TFHub and save it locally.

Usage:
  pip install tensorflow tensorflow_hub
  python3 scripts/download-yamnet.py
"""
import sys

try:
    import tensorflow as tf
    import tensorflow_hub as hub
except ImportError:
    print("Install deps first:  pip install tensorflow tensorflow_hub", file=sys.stderr)
    sys.exit(1)

import os

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "models", "yamnet")
OUT_DIR = os.path.abspath(OUT_DIR)

print("Downloading YAMNet from TFHub...")
model = hub.load("https://tfhub.dev/google/yamnet/1")

# Create a concrete function — freezes variables, removes DisableCopyOnRead ops
# that are incompatible with the TF C library bundled with @tensorflow/tfjs-node.
@tf.function(input_signature=[tf.TensorSpec(shape=[None], dtype=tf.float32)])
def serving_fn(waveform):
    scores, embeddings, spectrogram = model(waveform)
    return {"scores": scores, "embeddings": embeddings, "spectrogram": spectrogram}

# Freeze the concrete function so no resource variable ops remain
from tensorflow.python.framework.convert_to_constants import (
    convert_variables_to_constants_v2,
)
cf = serving_fn.get_concrete_function()
frozen = convert_variables_to_constants_v2(cf)
frozen.graph.as_default()

import shutil, os
if os.path.exists(OUT_DIR):
    shutil.rmtree(OUT_DIR)
os.makedirs(OUT_DIR, exist_ok=True)

# Wrap the frozen function back into a module with serving_default signature
module = tf.Module()
module.f = frozen

# Save using the frozen graph as serving_default
class FrozenModule(tf.Module):
    def __init__(self, frozen_func):
        super().__init__()
        self._fn = frozen_func

    @tf.function(input_signature=[tf.TensorSpec(shape=[None], dtype=tf.float32)])
    def __call__(self, waveform):
        results = self._fn(waveform)
        return results

frozen_module = FrozenModule(frozen)

print(f"Saving SavedModel to {OUT_DIR} ...")
tf.saved_model.save(
    frozen_module,
    OUT_DIR,
    signatures={"serving_default": frozen_module.__call__},
)

print("Done. Model saved at:", OUT_DIR)
