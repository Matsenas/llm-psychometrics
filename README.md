# LLM Psychometrics

A web application for researching LLM-based personality assessment. Participants engage in a conversational chat with an LLM, which infers Big Five personality traits from the dialogue. These LLM-derived scores are then compared against a traditional self-report questionnaire (BFI) to evaluate accuracy.

Built as part of research at the University of Tartu.

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend:** Supabase (database, auth, edge functions)
- **LLM Integration:** Supabase Edge Functions for chat and personality scoring

## Participant Flow

1. **Consent** - Informed consent and demographic details
2. **Chat** - Conversational session with an LLM
3. **Questionnaire** - Standard Big Five Inventory (BFI) self-report
4. **Results** - Side-by-side comparison of LLM-inferred vs. self-reported personality traits
5. **Accuracy Rating** - Participant feedback on how accurate the LLM assessment felt

## Getting Started

```sh
# Install dependencies
pnpm install

# Copy environment variables and fill in your Supabase credentials
cp .env.example .env

# Start the dev server
pnpm dev
```

## Environment Variables

See [.env.example](.env.example) for required variables:

| Variable | Description |
|---|---|
| `VITE_SUPABASE_PROJECT_ID` | Supabase project ID |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/public key |
| `VITE_SUPABASE_URL` | Supabase project URL |
