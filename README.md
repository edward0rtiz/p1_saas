# DeliveryNotes+

**Turn messy requirement notes into polished user stories—in seconds.**

DeliveryNotes+ is an AI-powered SaaS that helps product owners and product managers turn raw business requirement notes into professional user stories, clear action items, and edge cases. Stop wrestling with format; focus on what matters.

---

## What It Does

Paste your notes from a stakeholder call, email, or scratch doc. DeliveryNotes+ uses AI to:

- **User stories** — Structured as *"As a &lt;role&gt;, I want to &lt;goal&gt; so that &lt;benefit&gt;"* for both non-technical stakeholders and dev teams.
- **Action items** — Concrete next steps and follow-ups for every request.
- **Edge cases** — Top considerations and risks so nothing slips through.
- **Estimates** — Suggested time to complete based on complexity (on supported plans).
- **Export** — Download the result as a PDF for tickets, docs, or handoffs.

Plans (free, basic, premium) control output depth—e.g. acceptance criteria and risk lists on higher tiers.

---

## Features

| Feature | Description |
|--------|-------------|
| **Clerk auth** | Sign in and plan-gated access (basic / premium). |
| **Streaming output** | AI response streams in real time via SSE. |
| **PDF export** | One-click export of the generated user story summary. |
| **Plan-aware API** | Backend tailors length and detail from the user’s subscription. |

---

## Tech Stack

- **Frontend:** Next.js (Pages Router), React, Tailwind CSS, Clerk, React Markdown, jsPDF
- **Backend:** Python, FastAPI, OpenAI, Clerk JWT validation
- **Deploy:** Single Docker image (Next.js static export + FastAPI on port 8000)

---

## Quick Start

### Run with Docker (recommended)

The app is designed to run as one service: FastAPI serves the static Next.js app and the `/api/DeliveryNotes` endpoint.

1. **Set environment variables** (see [Environment variables](#environment-variables) below).
2. **Build and run:**

   ```bash
   docker build -t deliverynotes-plus .
   docker run -p 8000:8000 --env-file .env deliverynotes-plus
   ```

3. Open **http://localhost:8000** in your browser.

### Local development

- **Frontend:** From the project root, run `npm install` then `npm run dev`. Open http://localhost:3000.  
  For the AI feature to work, the frontend must call the same API (e.g. by running the API locally and using a proxy or `NEXT_PUBLIC_*` API URL, depending on your setup).
- **API:** From the project root, run the FastAPI server (e.g. `uvicorn api.server:app --reload --port 8000`). Ensure `.env` is set so the API can reach Clerk and OpenAI.

---

## Environment Variables

| Variable | Purpose |
|----------|--------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk public key (frontend). |
| `CLERK_SECRET_KEY` | Clerk secret (backend auth). |
| `CLERK_JWKS_URL` | Clerk JWKS URL for JWT verification. |
| `OPENAI_API_KEY` | OpenAI API key for story generation. |

Use these in `.env` for local runs and in your Docker/App Runner (or other) deployment config. Do not commit real secrets.

---

## Project Structure

```
saas/
├── pages/           # Next.js pages (index, product)
├── api/
│   └── server.py    # FastAPI app: /api/DeliveryNotes, /health, static serve
├── Dockerfile       # Builds Next static export + Python image
├── .env             # Local env (do not commit secrets)
└── README.md
```

---

## API

- **`POST /api/DeliveryNotes`** — Accepts JSON `{ product_owner, date_of_request, notes }` and an `Authorization: Bearer <Clerk JWT>`. Streams the AI-generated user story summary as Server-Sent Events (SSE). Plan is read from the JWT to adjust model behavior.
- **`GET /health`** — Returns `{ "status": "healthy" }` for load balancers and App Runner.

---

## Next Steps

### v1 — Deploy to AWS (ECR + App Runner)

Deploy the Docker image to AWS for a production-ready v1:

1. **Push the image to Amazon ECR:** Create an ECR repository, authenticate Docker to ECR, then build and push the `deliverynotes-plus` image.
2. **Create an App Runner service:** Point App Runner at your ECR image, set port 8000, and configure environment variables (Clerk keys, OpenAI key, etc.) in the service. Use the built-in health check on `/health`.
3. **Access the app** via the App Runner-assigned URL (or attach a custom domain in the next phase).

### Immediate improvements (post–v1)

| Improvement | Description |
|-------------|-------------|
| **Custom domain** | Add your own domain in App Runner settings. |
| **Auto-deployment** | Set up GitHub Actions to build, push to ECR, and update the App Runner service on push. |
| **Monitoring** | Add CloudWatch alarms for errors and latency. |

### Advanced enhancements (future versions)

| Enhancement | Description |
|-------------|-------------|
| **Database** | Add Amazon RDS for data persistence (e.g. user story history, audit logs). |
| **File storage** | Use S3 for user uploads (e.g. attached requirement documents). |
| **Caching** | Use ElastiCache for performance (e.g. session or response caching). |
| **CDN** | Use CloudFront for global distribution and faster static assets. |
| **Secrets Manager** | Store sensitive data (API keys, DB credentials) in AWS Secrets Manager instead of env vars. |

---

## Learn More

- [Next.js Docs](https://nextjs.org/docs)
- [Clerk](https://clerk.com/docs)
- [FastAPI](https://fastapi.tiangolo.com/)
