FROM python:3.12-slim-bookworm
ENV PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir --require-hashes -r requirements.txt
COPY --chown=10001:10001 voice_worker.py address_agent.py ./
USER 10001:10001
CMD ["python", "voice_worker.py", "start"]
