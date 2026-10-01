FROM node:24.8.0-alpine AS build

WORKDIR /workspace

# client-ui is a standalone npm project with its own lockfile; it depends on
# packages/shared-ui-components through a file: dependency. That package
# needs to exist before `npm ci` so npm can link it, and its postinstall
# script links shared-ui-components/node_modules back to this project's own
# node_modules -- see scripts/link-shared-ui-components.mjs for why.
COPY apps/client-ui/package.json apps/client-ui/package-lock.json apps/client-ui/.npmrc apps/client-ui/
COPY packages/shared-ui-components/package.json packages/shared-ui-components/package.json
# The BuildKit cache mount keeps npm downloads between builds without storing
# them in the image.
RUN --mount=type=cache,target=/root/.npm npm --prefix apps/client-ui ci

COPY apps/client-ui/ apps/client-ui/
COPY packages/shared-ui-components/ packages/shared-ui-components/
RUN npm --prefix apps/client-ui run build

FROM nginxinc/nginx-unprivileged:1.27-alpine

COPY apps/client-ui/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/client-ui/dist/client-ui/browser /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --retries=10 \
    CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
