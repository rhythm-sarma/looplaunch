# Crawl4AI Service for Render

Standalone Crawl4AI web crawler API, deployed as a Docker service on Render.

## Local Development

```bash
# Build and run locally
docker build -t crawl4ai-service .
docker run -p 11235:11235 crawl4ai-service

# Test health
curl http://localhost:11235/health

# Test crawl
curl -X POST http://localhost:11235/crawl \
  -H "Content-Type: application/json" \
  -d '{"urls": ["https://example.com"]}'
```

## Render Deployment Steps

### Step 1: Push to GitHub
Make sure the `crawl4ai-service/` directory is committed and pushed to your GitHub repo.

### Step 2: Create a New Web Service on Render
1. Go to [https://dashboard.render.com](https://dashboard.render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repo (`Looplaunch`)
4. Configure the service:
   - **Name**: `crawl4ai-service`
   - **Region**: Pick the closest to your users (e.g., Oregon)
   - **Runtime**: **Docker**
   - **Dockerfile Path**: `crawl4ai-service/Dockerfile`
   - **Instance Type**: **Starter** ($7/mo) or **Standard** ($25/mo) — needs at least 1GB RAM for Chromium
   - **Health Check Path**: `/health`

### Step 3: Deploy
1. Click **"Create Web Service"**
2. Wait for the build to complete (first build takes ~5-10 minutes)
3. Once deployed, Render gives you a URL like:
   ```
   https://crawl4ai-service-xxxx.onrender.com
   ```

### Step 4: Connect to Loop Launch
1. Copy the Render URL
2. In your Loop Launch app, update the environment variable:
   ```
   CRAWL4AI_URL=https://crawl4ai-service-xxxx.onrender.com
   ```
3. If deploying Loop Launch on Render too, add this as an Environment Variable in the Render dashboard.

### Important Notes
- **Cold starts**: On the Starter plan, the service spins down after 15 min of inactivity. First request after spin-down takes ~30-60s.
- **Memory**: Chromium needs at least 512MB RAM. The Starter plan (512MB) works but Standard (1GB+) is recommended for reliability.
- **No authentication**: This MVP doesn't add auth to the Crawl4AI endpoint. For production, add an API key check.
