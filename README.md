---
title: CV Keyword Optimizer Backend
emoji: 📑
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# CV Keyword Optimizer Backend

An automated n8n workflow designed to tailor CVs to target job descriptions using Groq AI.

## Hugging Face Spaces Deployment

1. Create a new Space on Hugging Face (choose **Docker** SDK).
2. Set Space Hardware to **Free (2 vCPU, 16GB RAM)**.
3. Push this repository or upload `Dockerfile` and `cv-keyword-optimizer.json`.
4. In Space Settings -> **Variables and Secrets**:
   - Add Secret: `GROQ_API_KEY` = your Groq API key (`gsk_...`)
   - (Optional) Secret: `N8N_BASIC_AUTH_ACTIVE` = `true`
   - (Optional) Secret: `N8N_BASIC_AUTH_USER` = your username
   - (Optional) Secret: `N8N_BASIC_AUTH_PASSWORD` = your password
5. Once built, access your n8n interface at:
   `https://<your-username>-<your-space-name>.hf.space`
6. Import `cv-keyword-optimizer.json` and activate the workflow.
7. Your webhook endpoint will be:
   `https://<your-username>-<your-space-name>.hf.space/webhook/optimize-cv`

## Local Development (Docker Compose)

```bash
docker compose up -d
```

Access at `http://localhost:5678`.
