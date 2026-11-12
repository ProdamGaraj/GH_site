# syntax=docker/dockerfile:1
# =============================================================================
# Production "web" image: nginx that serves
#   - the published site (bind-mounted ./public-site, written by the backend),
#   - the Visual CMS admin as static files under /visual_cms/ (built here),
#   - reverse proxies to backend / estate-service / news-service / MinIO.
# Build context = visual-cms/ (see deploy/web/Dockerfile.dockerignore).
# =============================================================================

# ---------- CMS (React SPA) ----------
FROM node:20-alpine AS cms
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
# `tsc && vite build`: a type error fails the image build instead of shipping.
# vite base = /visual_cms/ (vite.config.ts) → assets resolve under that prefix.
RUN npm run build

# ---------- nginx ----------
FROM nginx:1.28-alpine
RUN rm -f /etc/nginx/conf.d/default.conf
COPY deploy/web/nginx.conf /etc/nginx/nginx.conf
# *.template are rendered by the image entrypoint (envsubst) into conf.d/ at
# container start; only variables matching NGINX_ENVSUBST_FILTER are replaced.
COPY deploy/web/templates/ /etc/nginx/templates/
COPY deploy/web/snippets/ /etc/nginx/snippets/
COPY --from=cms /app/dist /usr/share/nginx/cms/visual_cms
