FROM node:24.8.0-alpine AS build

WORKDIR /app

# The same single-project pattern as apps/client-ui/Dockerfile.
COPY package.json package-lock.json .npmrc ./
# The BuildKit cache mount keeps npm downloads between builds without storing
# them in the image.
RUN --mount=type=cache,target=/root/.npm npm ci

COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/reporting-ui/browser /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --retries=10 \
    CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
