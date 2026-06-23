# DS AI Curator

Generate a daily curated newsletter about AI applied to Design Systems.

The app uses the OpenAI API with web search, returns exactly 5 resources as structured JSON, and generates Gmail-compatible table-based HTML. It does not send email.

## Setup

```bash
npm install
cp .env.example .env
```

Add your API key to `.env`:

```bash
OPENAI_API_KEY=your_openai_api_key_here
```

## Run

```bash
npm run dev
```

The app writes:

- `outputs/newsletter.json`
- `outputs/newsletter.html`

## Build And Run

```bash
npm run build
npm start
```

## Output Contract

The generated JSON contains:

- `date`
- `topic`
- `trendSummary`
- exactly 5 `resources`
- `html`

Each resource includes:

- `title`
- `source`
- `url`
- `publishedDate`
- `whyItMatters`
- `designSystemsAngle`
- `tags`

The HTML uses inline styles and table-based layout for Gmail compatibility, including:

- dark purple header
- date
- trend summary bar
- 5 resource cards
- footer text: `Curated by DS × AI Curator`
