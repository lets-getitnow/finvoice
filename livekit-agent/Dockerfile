# LiveKit worker image: hash-pinned Python dependencies and non-root runtime.
# Keep secrets in the runtime environment, never in image layers or the build context.
FROM python:3.12-slim-bookworm
ENV PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir --require-hashes -r requirements.txt
# Ship only runtime modules; tests/probes are excluded from this image.
COPY --chown=10001:10001 voice_worker.py address_agent.py ./
# Drop privileges before launching the registered LiveKit worker.
USER 10001:10001
CMD ["python", "voice_worker.py", "start"]
