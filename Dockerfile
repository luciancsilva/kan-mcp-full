# syntax=docker/dockerfile:1

# --- dependencies (production only) ---------------------------------------
FROM oven/bun:1-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# --- runtime ----------------------------------------------------------------
FROM oven/bun:1-alpine
ARG VERSION=dev
ARG REVISION=unknown
LABEL org.opencontainers.image.title="kan-mcp-full" \
      org.opencontainers.image.description="MCP server for Kan (kan.bn) with attachments, over Streamable HTTP or stdio" \
      org.opencontainers.image.source="https://github.com/luciancsilva/kan-mcp" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${REVISION}"

WORKDIR /app
ENV NODE_ENV=production \
    MCP_TRANSPORT=http \
    MCP_HOST=0.0.0.0 \
    MCP_PORT=3333 \
    KAN_MCP_UPLOAD_ROOT=/data/uploads \
    KAN_MCP_DOWNLOAD_DIR=/data/downloads

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

# Files for attachment.add (filePath) are read from /data/uploads; attachment.download writes to /data/downloads.
RUN mkdir -p /data/uploads /data/downloads && chown -R bun:bun /data
USER bun
VOLUME ["/data/uploads", "/data/downloads"]
EXPOSE 3333

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["bun", "-e", "fetch('http://127.0.0.1:'+(process.env.MCP_PORT||3333)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

# HTTP by default. For stdio (MCP client starting the container): docker run -i --rm -e MCP_TRANSPORT=stdio ...
ENTRYPOINT ["bun", "run", "src/index.ts"]
