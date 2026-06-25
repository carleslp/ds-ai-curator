# DS AI Curator

Generate a curated newsletter about AI applied to Design Systems.

The curator does not use the LLM as a web search engine. It first collects candidate resources from predefined tiered sources, filters them with Design System keyword rules, scores them editorially, then uses an LLM only to rank and summarize the collected candidates. If no LLM key is configured, it returns a candidate-based fallback instead of invented resources.

## Setup

```bash
npm install
cp .env.example .env
```

Add one or both provider keys to `.env`:

```bash
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-5.5
GEMINI_API_KEY=your_gemini_api_key_here
```

## Run Locally

```bash
npm run dev:server
```

Available endpoints:

- `GET /api/daily-digest`
- `GET /api/debug-digest`
- `GET /health`

## Preview Email

```bash
npm run test:email
```

This generates `output.html` locally so you can preview the Gmail-compatible email.

## Build

```bash
npm run build
npm start
```

## Daily Digest Contract

`GET /api/daily-digest` returns:

```json
{
  "subject": "DS × AI Curator — 2026-06-25",
  "html": "<!DOCTYPE html>...",
  "digest": {
    "date": "2026-06-25",
    "trend_summary": "...",
    "resources": []
  }
}
```

Each resource includes:

- `title`
- `source`
- `url`
- `type`
- `published_date`
- `summary`
- `design_system_angle`
- `why_it_matters_to_our_team`
- `directDesignSystemEvidence`
- `relevance_score`
- `worth_your_time_score`
- `is_real_source`

## Debug Contract

`GET /api/debug-digest` returns pipeline state without rendering HTML:

```json
{
  "mode": "liveOpenAI",
  "hasOpenAIKey": true,
  "hasGeminiKey": false,
  "candidateCount": 30,
  "filteredCandidateCount": 12,
  "selectedResourceCount": 5,
  "resourceCount": 5,
  "fallbackReason": "",
  "sourceResults": [
    {
      "source": "Figma Blog",
      "success": true,
      "candidatesFound": 12,
      "error": null
    }
  ],
  "rejectedCandidates": [
    {
      "title": "",
      "source": "",
      "url": "",
      "rejectionReason": "",
      "directDesignSystemEvidence": "",
      "relevance_score": 0,
      "worth_your_time_score": 0
    }
  ],
  "candidatesPreview": [
    {
      "title": "",
      "source": "",
      "url": "",
      "published_date": "",
      "sourceScore": 5,
      "directDesignSystemEvidence": ""
    }
  ],
  "selectedPreview": [
    {
      "title": "",
      "source": "",
      "url": "",
      "relevance_score": 5,
      "worth_your_time_score": 5,
      "directDesignSystemEvidence": ""
    }
  ]
}
```

Modes:

- `liveOpenAI`
- `liveGemini`
- `candidateFallback`
- `cachedDigest`
- `emergencyFallback`

## Email

The HTML uses inline styles and table-based layout for Gmail compatibility, including:

- dark purple rounded header
- date
- trend summary bar
- up to 5 resource cards
- practical `Why it matters` notes when available
- footer text: `Curated by DS × AI Curator`
