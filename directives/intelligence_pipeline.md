# Intelligence Pipeline Backend

## Overview
Loop Launch's backend is a strategic marketing intelligence system that:
1. **Gathers** — crawls company/competitor websites + market research
2. **Structures** — uses Gemini to organize raw data into intelligence profiles
3. **Diagnoses** — generates SWOT, positioning, competitive analysis
4. **Answers** — responds to user questions using stored intelligence

## Architecture
```
Frontend (Onboarding) → POST /api/intelligence/gather
                            ├── Crawl4AI (company + competitor websites)
                            ├── Tavily (market research)
                            └── Gemini (structure + diagnose)
                        → IntelligenceStore (in-memory, keyed by session)

Frontend (Q&A)        → POST /api/intelligence/ask
                            ├── Retrieve stored intelligence
                            └── Gemini (reason + answer)
```

## API Endpoints
- `POST /api/intelligence/gather` — Start intelligence pipeline (async)
- `GET /api/intelligence/status?sessionId=xxx` — Poll pipeline progress
- `POST /api/intelligence/ask` — Ask strategic questions

## Services
| Service | File | Status |
|---------|------|--------|
| Gemini AI | `lib/ai/gemini.ts` | ✅ Active |
| Prompt Templates | `lib/ai/prompts.ts` | ✅ Active |
| Website Crawler | `lib/crawler/website-crawler.ts` | ✅ Active (Crawl4AI + fetch fallback) |
| Tavily Search | `lib/research/tavily.ts` | ⏳ Stubbed (needs API key) |
| Intelligence Store | `lib/intelligence/store.ts` | ✅ In-memory (MongoDB later) |

## Environment Variables
Required in `looplaunch-app/.env.local`:
- `GEMINI_API_KEY` — Google Gemini API key ✅
- `CRAWL4AI_URL` — Crawl4AI service URL (never hardcoded)
- `TAVILY_API_KEY` — Tavily API key (optional for now)
- `MONGODB_URI` — MongoDB connection string (optional for now)

## Key Principle
**"Research Once, Answer Many Times"**
Intelligence is gathered once per session and stored. The Q&A endpoint
reuses stored intelligence without re-crawling or re-researching.

## Crawl4AI Deployment
See `crawl4ai-service/README.md` for Docker and Render deployment steps.

## Edge Cases & Learnings
- Crawl4AI has cold-start delays on Render Starter plan (~30-60s)
- Gemini sometimes returns markdown-fenced JSON — parser strips fences
- Fallback fetch crawler can't render JavaScript-heavy sites
- In-memory store survives Next.js hot reloads via globalThis
