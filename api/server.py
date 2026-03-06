import os
from pathlib import Path
from fastapi import FastAPI, Depends
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi_clerk_auth import ClerkConfig, ClerkHTTPBearer, HTTPAuthorizationCredentials
from openai import OpenAI

app = FastAPI()

# Add CORS middleware (allows frontend to call backend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Clerk authentication setup
clerk_config = ClerkConfig(jwks_url=os.getenv("CLERK_JWKS_URL"))
clerk_guard = ClerkHTTPBearer(clerk_config)

class UserRequirement(BaseModel):
    product_owner: str
    date_of_request: str
    notes: str

system_prompt = """
You are provided with notes written by a product owner or product manager from a business user requirement.
Your job is to summarize these notes and build a legible and non-tech user story for stakeholders and tech user story for the IT team.
The user story should be in the following format:
As a <role>, I want to <goal> so that <benefit>. the  <benefit> should consider top three edge case.
Finally suggest the estimated time to complete the user story. based on the complexity of the user story.
"""

def user_prompt_for(req: UserRequirement) -> str:
    return f"""Create the summary, next steps and draft:
Product Owner: {req.product_owner}
Date of Request: {req.date_of_request}
Notes:
{req.notes}"""

PLAN_MAP = {
    "user:free_user": "free",
    "user:basic_plan": "basic",
    "user:premium_plan": "premium",
    # If you store already-plain plans in JWT, keep them too:
    "free": "free",
    "basic": "basic",
    "premium": "premium",
}

def get_plain_plan_from_claims(claims: dict) -> str:
    """
    Reads a plan from JWT claims and normalizes it to 'free'|'basic'|'premium'.

    IMPORTANT: Adjust the claim lookup to wherever you actually store plan.
    """
    raw = (
        claims.get("plan")
        or claims.get("subscription")
        or (claims.get("public_metadata") or {}).get("plan")
        or (claims.get("metadata") or {}).get("plan")
        or "free"
    )
    return PLAN_MAP.get(raw, "free")


@app.post("/api/DeliveryNotes")
def story_request_summary(
    req: UserRequirement,
    creds: HTTPAuthorizationCredentials = Depends(clerk_guard),
):
    claims = creds.decoded
    user_id = claims["sub"]  # available for logging/auditing
    plan = get_plain_plan_from_claims(claims)

    # ✅ Vanilla per-plan overrides
    # Choose model / output behavior based on plan.
    if plan == "premium":
        model = "gpt-5-nano"
        max_tokens = 2000
        extra_instruction = "\nAlso include acceptance criteria and a short risk list."
    elif plan == "basic":
        model = "gpt-5-nano"
        max_tokens = 1500
        extra_instruction = "\nKeep it concise. Include acceptance criteria."
    else:
        # free
        # Either allow with reduced output OR block entirely
        model = "gpt-5-nano"
        max_tokens = 1000
        extra_instruction = "\nKeep it very short (bullet points). Do not include a draft email."

        # If you want to block free users instead, do:
        # raise HTTPException(status_code=403, detail="Upgrade required")

    client = OpenAI()

    user_prompt = user_prompt_for(req)

    prompt = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    stream = client.chat.completions.create(
        model="gpt-5-nano",
        messages=prompt,
        stream=True,
    )

    def event_stream():
        for chunk in stream:
            text = chunk.choices[0].delta.content
            if text:
                lines = text.split("\n")
                for line in lines[:-1]:
                    yield f"data: {line}\n\n"
                    yield "data:  \n"
                yield f"data: {lines[-1]}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")

@app.get("/health")
def health_check():
    """Health check endpoint for AWS App Runner"""
    return {"status": "healthy"}

# Serve static files (our Next.js export) - MUST BE LAST!
static_path = Path("static")
if static_path.exists():
    # Serve index.html for the root path
    @app.get("/")
    async def serve_root():
        return FileResponse(static_path / "index.html")
    
    # Mount static files for all other routes
    app.mount("/", StaticFiles(directory="static", html=True), name="static")