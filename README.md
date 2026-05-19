# CV Keyword Optimizer

An n8n workflow that automatically optimizes your CV/resume for ATS (Applicant Tracking Systems) by extracting keywords from a job posting and injecting them naturally into a copy of your Google Docs resume.

## How It Works

```
Form Input → Read CV → Scrape Job Page → Extract Keywords (Ollama) → Generate Replacements (Groq) → Apply to Doc Copy → Redirect to New Doc
```

1. You submit your Google Docs CV link + a job posting URL (or paste the JD manually)
2. **Ollama** (local LLM) extracts must-have keywords from the job description
3. **Groq** (Llama 3.3 70B) generates find-and-replace pairs to weave keywords into your bullet points
4. A copy of your CV is created and all replacements are applied via Google Docs API
5. You're redirected to the optimized document

## Prerequisites

| Requirement | Details |
|---|---|
| **n8n** | Self-hosted (Docker) |
| **Ollama** | Running in Docker with `llama3.1:8b` pulled |
| **Groq API Key** | Free at [console.groq.com](https://console.groq.com/home) |
| **Google Cloud** | OAuth2 credentials with Docs + Drive APIs enabled |

### Docker Setup for Ollama

```bash
docker run -d \
  --name ollama \
  -p 11434:11434 \
  -v ollama_data:/root/.ollama \
  --restart unless-stopped \
  ollama/ollama

docker exec ollama ollama pull llama3.1:8b
```

> **Note:** If n8n and Ollama are in separate Docker containers, the workflow uses `host.docker.internal:11434`. If they share a Docker network, change it to `http://ollama:11434` in the Ollama Chat Model node.

## Setup

1. **Import** `cv-keyword-optimizer.json` into n8n
2. **Configure credentials** in n8n (Settings → Credentials):
   - **Ollama API** — set base URL (`http://host.docker.internal:11434`)
   - **Groq API** — paste your API key
   - **Google Docs OAuth2** — enter Client ID + Secret, authorize
   - **Google Drive OAuth2** — same Client ID + Secret, authorize
3. **Activate** the workflow

## Usage

1. Open the form trigger URL (shown in n8n after activating)
2. Paste your **Google Docs CV link**
3. Provide either a **Job Posting URL** or paste the **Job Description**
4. Click **Generate CV**
5. Wait ~30-60s — you'll be redirected to the optimized doc

## Workflow Nodes

| Stage | Node | Type |
|---|---|---|
| Input | CV Input Form | Form Trigger |
| Parse | Extract Doc ID & Job URL | Code |
| Read | Read CV from Google Docs | Google Docs |
| Parse | Extract CV Text | Code |
| Scrape | Scrape Job Page | HTTP Request |
| Parse | Extract Job Text from HTML | Code |
| AI | Keyword Extraction Chain | Basic LLM Chain + Ollama |
| Parse | Parse Keywords | Code |
| Prep | Prepare Replacement Input | Code |
| AI | Replacement Generation Chain | Basic LLM Chain + Groq |
| Parse | Parse AI Response | Code |
| Check | Check for Errors | If |
| Copy | Copy Original CV | Google Drive |
| Build | Build Replace Requests | Code |
| Apply | Apply Replacements to Copy | HTTP Request (Google Docs OAuth) |
| Output | Changes Summary | Code |
| Output | Redirect to CV | Respond to Webhook |

## Notes

- The workflow **never modifies your original CV** — it always creates a copy
- No API keys are hardcoded — all credentials use n8n's secure credential system
- The Groq model (`llama-3.3-70b-versatile`) is free-tier eligible
- Keywords are ranked by ATS impact and only injected where they fit naturally
