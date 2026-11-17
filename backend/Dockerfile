FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends build-essential libpq-dev curl && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Install CPU-only torch first to prevent downloading 2.5GB CUDA binaries
RUN pip install --no-cache-dir --default-timeout=120 --extra-index-url https://download.pytorch.org/whl/cpu torch

# Install application dependencies with generous timeout
RUN pip install --no-cache-dir --default-timeout=120 -r requirements.txt

# Pre-cache Cross-Encoder weights for zero cold-start latency
RUN python -c "from sentence_transformers import CrossEncoder; CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')" || true

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
