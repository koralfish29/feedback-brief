# Feedback Brief

**Feedback Brief** is a lightweight prototype that demonstrates how product managers can aggregate and analyze scattered customer feedback to surface clear, actionable insights.

The project focuses on turning noisy, unstructured feedback into structured signals (sentiment, category, urgency) that help PMs quickly understand what issues matter most.

## What This Project Does

- Collects feedback from multiple sources (e.g., GitHub, Support, Discord)
- Stores feedback in a serverless SQL database
- Analyzes feedback for:
  - Sentiment (positive / neutral / negative)
  - Category (bug, feature request, docs, UI/UX, etc.)
  - Urgency (normal / high / urgent)
- Displays aggregated insights in a simple web dashboard
- Exposes API endpoints for submitting feedback and retrieving analytics

## Built With

- **Workers** — serverless runtime for API logic and dashboard rendering  
- **D1 Database** — persistent SQL storage for feedback and analytics  
- **Wrangler CLI** — local development, database management, and deployment  

The entire application is fully serverless and runs on Cloudflare’s global edge network.
