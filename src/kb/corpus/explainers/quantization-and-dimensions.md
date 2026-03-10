---
title: "Quantization and Flexible Dimensions"
type: explainer
section: models
difficulty: advanced
---

## What Is Quantization?

Quantization reduces embedding precision from 32-bit floats to smaller representations, dramatically cutting storage and search costs with minimal quality loss. Combined with Matryoshka dimensions, you can shrink vectors by up to 128x (32x from binary quantization times 4x from fewer dimensions). The Voyage AI API supports several output data types: `float` (32 bits/dim, baseline), `int8` and `uint8` (8 bits/dim, 4x smaller), and `binary` and `ubinary` (1 bit/dim, 32x smaller). For a million documents at 1024 dimensions, float storage is 4.0 GB, int8 is 1.0 GB, and binary is just 128 MB.

## How It Works

For int8 and uint8, each float value is linearly mapped to an 8-bit integer range. For binary quantization, each float value is converted to a single bit: positive values become 1, zero or negative become 0. Eight bits are packed into one byte. The `binary` type uses offset binary (subtract 128) for signed int8 output, while `ubinary` stores the raw unsigned uint8 value. Voyage AI models are trained with quantization awareness, so the quality degradation is minimal: int8 typically loses less than 1% retrieval quality versus float, while binary loses roughly 2-5% and works best when paired with a reranker.

## Matryoshka Dimensions

Voyage 4 models produce nested embeddings via Matryoshka representation learning. The first 256 entries of a 1024-dim vector are themselves a valid 256-dim embedding. You can embed once at full dimension and truncate later without re-embedding. Supported values are 256, 512, 1024 (default), and 2048.

```bash
vai embed "hello world" --output-dtype int8
vai embed "hello world" --output-dtype binary --dimensions 256
vai benchmark quantization --model voyage-4-large --dtypes float,int8,ubinary
```

## Tips and Gotchas

Start with float at default dimensions to establish a quality baseline. Try int8 next -- if quality holds, you get 4x storage savings for free. If storage is critical, try binary plus a reranker for 32x savings. Combining lower dimensions and quantization compounds quality loss, so measure the tradeoff on your data with `vai benchmark quantization`. MongoDB Atlas Vector Search supports float and int8 storage; binary support varies by vector database. Not all index types support quantized vectors, so check your database documentation before switching.
