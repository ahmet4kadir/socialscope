# SocialScope — web dashboard + tracker in one container.
#
# Login can NOT happen inside a container (it needs a visible browser):
# log in on your own machine, then upload the session file through the
# dashboard (Oturum → Yükle) or copy it into the mounted .sessions volume.
#
# Persistent volumes to mount:
#   /app/data       SQLite database
#   /app/.sessions  logged-in platform sessions

FROM node:22-bookworm-slim

WORKDIR /app

# Install dependencies first for layer caching.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/collector/package.json packages/collector/
COPY packages/web/package.json packages/web/
RUN npm ci

# Chromium + the OS libraries it needs (Playwright manages both).
RUN npx playwright install chromium --no-shell --with-deps

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
VOLUME ["/app/data", "/app/.sessions"]

# Migrate, then run the tracker alongside the web server.
CMD ["sh", "-c", "npm run migrate && (npm run tracker & exec npm run start)"]
