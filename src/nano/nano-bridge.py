#!/usr/bin/env python3
"""nano-bridge.py - voyage-4-nano NDJSON bridge for voyageai-cli

Reads NDJSON requests from stdin, processes embeddings using the
voyage-4-nano model via sentence-transformers, and writes NDJSON
responses to stdout. Stderr is reserved for fatal errors only.
"""

import json
import sys

BRIDGE_VERSION = "1.31.0"
MODEL_NAME = "voyageai/voyage-4-nano"

# Lazy-loaded on first embed request
_model = None
_device = None


def detect_device():
    """Auto-detect the best available compute device: CUDA > MPS > CPU."""
    import torch

    if torch.cuda.is_available():
        return "cuda"
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def load_model(device):
    """Load the voyage-4-nano model onto the specified device.

    Returns the SentenceTransformer model on success, or a dict with
    error code and message on failure.
    """
    try:
        from sentence_transformers import SentenceTransformer

        model = SentenceTransformer(
            MODEL_NAME,
            trust_remote_code=True,
            device=device,
        )
        return model
    except OSError as exc:
        return {
            "code": "MODEL_NOT_FOUND",
            "message": f"Model '{MODEL_NAME}' not found locally: {exc}",
        }
    except Exception as exc:
        return {
            "code": "MODEL_NOT_FOUND",
            "message": f"Failed to load model '{MODEL_NAME}': {exc}",
        }


def handle_embed(model, request):
    """Process an embed request and return a result envelope.

    Args:
        model: A loaded SentenceTransformer model.
        request: Parsed request dict with at least 'id' and 'texts'.

    Returns:
        dict: Response envelope with embeddings.
    """
    texts = request.get("texts", [])
    input_type = request.get("input_type", "document")
    truncate_dim = request.get("truncate_dim", 2048)
    precision = request.get("precision", "float32")

    # Wrap single string in a list
    if isinstance(texts, str):
        texts = [texts]

    # Select encode method based on input_type
    if input_type == "query":
        embeddings = model.encode_queries(
            texts,
            truncate_dim=truncate_dim,
            precision=precision,
        )
    else:
        embeddings = model.encode(
            texts,
            truncate_dim=truncate_dim,
            precision=precision,
        )

    # Rough token count estimation
    total_tokens = sum(len(t.split()) for t in texts)

    return {
        "id": request["id"],
        "type": "result",
        "embeddings": embeddings.tolist(),
        "dimensions": truncate_dim,
        "usage": {"total_tokens": total_tokens},
    }


def send(msg):
    """Write a single NDJSON line to stdout and flush immediately."""
    sys.stdout.write(json.dumps(msg) + "\n")
    sys.stdout.flush()


def main():
    """Main NDJSON bridge loop.

    1. Send a ready signal with bridge metadata.
    2. Read requests line-by-line from stdin.
    3. Lazy-load the model on first embed request.
    4. Return result or error envelopes for each request.
    """
    global _model, _device

    _device = detect_device()

    # Ready signal -- sent before model loading (lazy)
    send({
        "type": "ready",
        "bridge_version": BRIDGE_VERSION,
        "device": _device,
        "model": MODEL_NAME,
    })

    while True:
        line = sys.stdin.readline()
        if not line:
            # stdin closed -- parent process exited
            break

        line = line.strip()
        if not line:
            continue

        request_id = None
        try:
            request = json.loads(line)
            request_id = request.get("id")

            if request.get("type") == "embed":
                # Lazy model loading on first embed request
                if _model is None:
                    result = load_model(_device)
                    if isinstance(result, dict):
                        # Model loading failed
                        send({
                            "id": request_id,
                            "type": "error",
                            "code": result["code"],
                            "message": result["message"],
                        })
                        continue
                    _model = result

                response = handle_embed(_model, request)
                send(response)
            else:
                send({
                    "id": request_id,
                    "type": "error",
                    "code": "UNKNOWN_REQUEST_TYPE",
                    "message": f"Unknown request type: {request.get('type')}",
                })

        except json.JSONDecodeError as exc:
            send({
                "id": request_id,
                "type": "error",
                "code": "JSON_PARSE_ERROR",
                "message": f"Malformed JSON: {exc}",
            })
        except Exception as exc:
            send({
                "id": request_id,
                "type": "error",
                "code": "BRIDGE_ERROR",
                "message": str(exc),
            })


if __name__ == "__main__":
    main()
