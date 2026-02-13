# ── Stage 1: Install vai from npm ──
FROM node:22-slim AS builder
ARG VAI_VERSION=latest
RUN npm install -g "voyageai-cli@${VAI_VERSION}" && npm cache clean --force

# ── Stage 2: Slim runtime ──
FROM node:22-slim
LABEL org.opencontainers.image.source="https://github.com/mrlynn/voyageai-cli"
LABEL org.opencontainers.image.description="vai - Voyage AI CLI toolkit for RAG pipelines"

COPY --from=builder /usr/local/lib/node_modules /usr/local/lib/node_modules
COPY --from=builder /usr/local/bin/vai /usr/local/bin/vai

# Playground (3333) and MCP server (3100)
EXPOSE 3333 3100

WORKDIR /data

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD vai ping --json 2>/dev/null | grep -q '"ok": true' || exit 1

ENTRYPOINT ["vai"]
CMD ["--help"]
