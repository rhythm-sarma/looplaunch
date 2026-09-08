# ─────────────────────────────────────────────────────────
# Crawl4AI Service — Docker image for Render deployment
# ─────────────────────────────────────────────────────────
# Uses the official Crawl4AI image with a lightweight config.
# Render will build and deploy this as a Web Service.
# ─────────────────────────────────────────────────────────

FROM python:3.11-slim

# Install system dependencies for Playwright/Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Install Crawl4AI
RUN pip install --no-cache-dir crawl4ai[all]

# Install Playwright browsers
RUN playwright install chromium
RUN playwright install-deps chromium

# Expose the default Crawl4AI API port
EXPOSE 11235

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:11235/health || exit 1

# Start the Crawl4AI API server
# PORT env var is set by Render automatically
CMD crawl4ai-server --host 0.0.0.0 --port ${PORT:-11235}
