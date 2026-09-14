# ── Stage 1: Build ─────────────────────────────────────────────────────────────
# Full Node image: the build needs devDependencies (TypeScript, the Nest CLI)
# that the runtime image must not carry.
FROM node:22-alpine AS build

WORKDIR /app

# Copy manifests before source. Docker caches each layer separately, so as long
# as package-lock.json is unchanged the dependency install below is served from
# cache even when source files change. Same layer-caching win the backend
# Dockerfile gets by copying pom.xml first.
COPY package.json package-lock.json ./
RUN npm ci

# Source and TypeScript config. This layer re-runs only when they change.
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src/ src/
RUN npm run build

# ── Stage 2: Runtime ───────────────────────────────────────────────────────────
# Fresh base image. The devDependencies, TypeScript sources and build cache from
# Stage 1 are NOT copied here — they never exist in the final image, which is
# why the multi-stage result is significantly smaller.
FROM node:22-alpine

WORKDIR /app

# Create a non-root group and user. Running as root inside a container is
# unnecessary and widens the blast radius if the container is compromised.
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Production dependencies only. bcrypt is a native addon, so its build scripts
# must be allowed to run here — npm 11 blocks lifecycle scripts by default.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --foreground-scripts && npm cache clean --force

# Copy only the compiled output from the build stage. Nothing else.
COPY --from=build /app/dist ./dist

# Everything above runs as root so npm can write to /app. Hand ownership over
# and drop privileges here, before the process starts.
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 3001
CMD ["node", "dist/main.js"]
