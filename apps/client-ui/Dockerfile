FROM node:24.8.0-alpine AS build

WORKDIR /app

# shared-ui-components is local source inside this directory (see its
# README), so this is otherwise the same single-project pattern as
# apps/auth-service/Dockerfile.
COPY package.json package-lock.json .npmrc ./
# The BuildKit cache mount keeps npm downloads between builds without storing
# them in the image.
RUN --mount=type=cache,target=/root/.npm npm ci

COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/client-ui/browser /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --retries=10 \
    CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
