FROM node:24.8.0-alpine AS build

WORKDIR /workspace

COPY package.json package-lock.json ./
COPY apps/client-ui/package.json apps/client-ui/package.json
COPY packages/shared-ui-components/package.json packages/shared-ui-components/package.json
RUN npm ci

COPY apps/client-ui/ apps/client-ui/
COPY packages/shared-ui-components/ packages/shared-ui-components/
RUN npm --workspace business-logic-ui run build

FROM nginxinc/nginx-unprivileged:1.27-alpine

COPY apps/client-ui/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/client-ui/dist/business-logic-ui/browser /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --retries=10 \
    CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
