# LLM Psychometrics

A research web application studying whether AI chatbots can accurately estimate psychological traits through natural conversation. Participants are assigned to one of two versioned studies:

- **Artificial and Natural Intelligence (LTAT.02.024) Project** — 20 guided chat sessions + IPIP-50 self-report. Results shown on a 5-axis radar comparing LLM-inferred vs self-reported scores.
- **Natural Language Processing (LTAT.01.001) Project** — a single open-ended relationship interview, repeated LLM attachment-pattern classification, profile display, and usability/plausibility survey.

Each participant is assigned to exactly one active study version via `participant_study_assignments -> study_versions -> studies`. Admins manage study assignment from the admin UI.

Built as part of research at the University of Tartu.

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui (Radix UI)
- **Backend:** Supabase (PostgreSQL, Auth, Edge Functions)
- **LLM:** Configurable Anthropic Claude or OpenAI backend via Supabase Edge Functions
- **State:** React Context (participant session), TanStack React Query (server state)
- **Forms:** React Hook Form + Zod validation
- **Charts:** Recharts (radar/bar comparison visualizations)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (React SPA)                                       │
│                                                             │
│  src/pages/         13 route pages (experiment flow + admin)│
│  src/components/    Custom components + shadcn/ui library   │
│  src/contexts/      ParticipantContext (session state)       │
│  src/data/          Big5 question constants & trait configs  │
│  src/lib/           Score calculation utilities              │
│  src/integrations/  Supabase client & generated types       │
└──────────────┬──────────────────────────────────────────────┘
               │ Supabase JS Client
┌──────────────▼──────────────────────────────────────────────┐
│  Supabase Backend                                           │
│                                                             │
│  PostgreSQL         9 tables, RLS policies, helper functions│
│  Auth               Anonymous sessions (participants),      │
│                     email/password (admins)                  │
│  Edge Functions     chat-conversation (Big Five dialogue)    │
│                     score-personality-unified (Big Five)     │
│                     relationship-chat (relationship dialogue) │
│                     run-attachment-classification             │
└──────────────┬──────────────────────────────────────────────┘
               │ Anthropic Messages API or OpenAI Chat Completions API
┌──────────────▼──────────────┐
│  Claude / OpenAI model      │
└─────────────────────────────┘
```

## Experiment Flow

```
 ┌───────────┐    ┌─────────┐    ┌───────┐    ┌──────────┐
 │  Entry    │───▶│ Consent │───▶│ Start │───▶│ Chat x20 │
 │ /         │    │/consent │    │/start │    │ /chat    │
 └───────────┘    └─────────┘    └───────┘    └────┬─────┘
                                                    │
 ┌───────────┐    ┌──────────┐    ┌─────────────┐  │
 │ Results   │◀───│ Accuracy │◀───│Questionnaire│◀─┘ (via /transition)
 │ /results  │    │/accuracy │    │/questionnaire│
 └───────────┘    └──────────┘    └─────────────┘
```

### Step-by-step

| Step | Route | Component | What happens |
|------|-------|-----------|--------------|
| 1. Entry | `/` | `Index.tsx` | Participant enters respondent ID; anonymous auth session created; progress-based redirect to next incomplete step |
| 2. Consent | `/consent` | `Consent.tsx` | Expandable accordion consent form covering study purpose, data collection, privacy, and participant rights; dual checkbox confirmation; saved to `consent_responses` |
| 3. Introduction | `/start` | `Start.tsx` | Brief overview of chat format, question types, and time estimate |
| 4. Chat sessions | `/chat` | `Chat.tsx` | 20 conversations (4 per Big Five trait), each probing a specific aspect; LLM opens with a trait-specific question, follows up once, then signals `[CONVERSATION_COMPLETE]`; skip available after 2 responses; confetti + milestone messages at 5/10/15; messages stored in `chat_messages` |
| 5. Transition | `/transition` | `Transition.tsx` | Success message; triggers `score-personality-unified` edge function in the background to generate LLM-inferred personality scores |
| 6. Questionnaire | `/questionnaire` | `Questionnaire.tsx` | IPIP-50 inventory (50 Likert items, 4 per page); responses saved to `ipip_responses`; scores normalized to 0-100 scale |
| 7. Feedback intro | `/feedback-intro` | `FeedbackIntro.tsx` | Explains what the accuracy rating involves |
| 8. Accuracy rating | `/accuracy` | `Accuracy.tsx` | Side-by-side LLM vs IPIP comparison; per-trait accuracy rating (1-5); overall preference scale; optional narrative feedback; saved to `survey_results` |
| 9. Results | `/results` | `Results.tsx` | Radar/bar chart visualization comparing LLM-inferred and self-reported scores; Big Five trait descriptions |

### Chat Session Structure (20 sessions)

| Sessions | Trait | Aspects |
|----------|-------|---------|
| 1-4 | Agreeableness | Helping others, conflict handling, empathy, self-interest |
| 5-8 | Conscientiousness | Task completion, organization, preparation, prioritization |
| 9-12 | Extraversion | Evening preferences, recharging, social approach, attention |
| 13-16 | Neuroticism | Stress response, handling mistakes, uncertainty, end-of-day reflection |
| 17-20 | Openness | Conversation preferences, travel style, novelty seeking, approaching challenges |

## Database Schema

```
┌──────────────┐       ┌──────────────────┐       ┌───────────────┐
│   profiles   │       │   participants   │       │  user_roles   │
├──────────────┤       ├──────────────────┤       ├───────────────┤
│ id (PK, FK)  │◀──┐   │ id (PK)          │   ┌──▶│ id (PK)       │
│ email        │   │   │ respondent_id    │   │   │ user_id (FK)  │
│ created_at   │   │   │ name             │   │   │ role (enum)   │
│ updated_at   │   ├───│ user_id (FK)     │───┘   │ created_at    │
└──────────────┘   │   │ disabled         │       └───────────────┘
                   │   │ created_at       │
    auth.users ────┘   └───────┬──────────┘
                               │ participant_id
              ┌────────────────┼────────────────┬──────────────────┐
              │                │                │                  │
              ▼                ▼                ▼                  ▼
┌──────────────────┐ ┌──────────────┐ ┌─────────────────┐ ┌──────────────┐
│consent_responses │ │chat_sessions │ │ ipip_responses  │ │survey_results│
├──────────────────┤ ├──────────────┤ ├─────────────────┤ ├──────────────┤
│ id (PK)          │ │ id (PK)      │ │ id (PK)         │ │ id (PK)      │
│ participant_id   │ │participant_id│ │ participant_id  │ │participant_id│
│ consented        │ │session_number│ │ item_number     │ │ *_chat scores│
│ consent_text     │ │ big5_aspect  │ │ item_text       │ │ *_ipip scores│
│ consented_at     │ │initial_question│ │ is_positive_key│ │ chat_rating  │
└──────────────────┘ │ is_complete  │ │ response_value  │ │ ipip_rating  │
                     │ started_at   │ │ responded_at    │ │ submitted    │
                     │ completed_at │ └─────────────────┘ │ submitted_at │
                     └──────┬───────┘                     └──────────────┘
                            │ session_id
                            ▼
                     ┌──────────────┐     ┌───────────────────┐
                     │chat_messages │     │personality_scores │
                     ├──────────────┤     ├───────────────────┤
                     │ id (PK)      │     │ id (PK)           │
                     │ session_id   │     │ participant_id     │
                     │ role         │     │ method (llm/ipip)  │
                     │ content      │     │ openness (JSONB)   │
                     │ created_at   │     │ conscientiousness  │
                     └──────────────┘     │ extraversion       │
                                          │ agreeableness      │
                                          │ neuroticism        │
                                          │ overall_assessment │
                                          └───────────────────┘
```

### Key tables

| Table | Purpose | Key constraints |
|-------|---------|-----------------|
| `participants` | Study participants linked to anonymous auth sessions | Unique `respondent_id`; `disabled` flag for access control |
| `consent_responses` | Records informed consent with full consent text | FK to participant |
| `chat_sessions` | 20 conversation sessions per participant, one per trait aspect | `session_number` 1-20 (CHECK); unique per participant+session |
| `chat_messages` | Full conversation transcripts (user, assistant, system roles) | FK to session |
| `ipip_responses` | IPIP-50 questionnaire answers (Likert 1-5) | `item_number` 1-50 (CHECK); unique per participant+item |
| `personality_scores` | Computed Big Five scores per method | `method` distinguishes LLM-inferred vs IPIP-calculated; unique per participant+method |
| `survey_results` | Participant accuracy ratings and feedback | Per-trait scores for both methods; overall rating; unique per participant |
| `user_roles` | Admin role assignments | Enum: `admin`, `user` |
| `profiles` | Auth user profiles | Mirrors `auth.users` |

### Row-Level Security

- Participants access only their own data via `get_participant_id_for_user()` helper function
- Admins have full read access across all tables
- Edge functions use the service role key for elevated access

## Edge Functions

### `chat-conversation` (Artificial and Natural Intelligence project)

Handles LLM dialogue for one of the 20 Big Five chat sessions.

1. Validates JWT and verifies session ownership
2. Retrieves conversation history from `chat_messages`
3. Builds system prompt with trait-specific guidance (aspect, probing strategy, exit criteria)
4. Calls the configured LLM provider
5. Detects `[CONVERSATION_COMPLETE]` tag to signal session end
6. Returns cleaned response + `shouldEnd` flag

### `score-personality-unified` (Artificial and Natural Intelligence project)

Analyzes all 20 conversation transcripts to generate Big Five personality scores.

1. Retrieves all `chat_messages` for a participant
2. Concatenates transcripts with an expert rubric (Big Five framework, 6 facets per trait, behavioral indicators)
3. Calls the configured LLM provider to generate scores on a 0–120 scale
4. Normalizes to 0–100 and stores in `personality_scores` (method=`llm`)

### `relationship-chat` (Natural Language Processing project)

Single-session LLM dialogue eliciting attachment-relevant behaviour.

1. Validates JWT and verifies session ownership
2. Builds a prompt around a relationship-difficulty opener and probing for anxiety/avoidance cues
3. Calls the configured LLM provider; returns cleaned response + `shouldEnd` flag

### `run-attachment-classification` (Natural Language Processing project)

Runs repeated attachment-pattern classification on the completed relationship interview.

1. Validates JWT and verifies participant ownership/admin authorization
2. Reads the completed relationship interview transcript
3. Calls the configured LLM provider multiple times with a strict attachment-classification schema
4. Stores individual runs and a summary in `attachment_classification_runs` and `attachment_classification_summaries`

## Admin Dashboard

| Route | Component | Capabilities |
|-------|-----------|-------------|
| `/auth` | `Auth.tsx` | Admin email/password login with role verification |
| `/admin` | `Admin.tsx` | Admin shell with two surfaces: Participants/User Management and Assessment/Study Overview |
| `/admin/participants` | `Admin.tsx` | Participant table with search/filter, CSV import/export, bulk enable/disable, study assignment, and admin role management |
| `/admin/studies` | `Admin.tsx` | Study/version overview for the Artificial and Natural Intelligence and Natural Language Processing projects with clickable study blocks and draft editing |
| `/admin/participant/:id` | `ParticipantDetails.tsx` | Individual participant data: consent status, chat transcripts, IPIP responses, personality scores, accuracy ratings |

## Scoring

### IPIP-50 (Big Five self-report)

Each Big Five trait is measured by 10 items (5 positive-keyed, 5 reverse-keyed). Raw scores range 10–50, normalized to 0–100:

```
score = ((rawScore - 10) / 40) * 100
```

Attachment style is derived from (anxiety, avoidance) using the scale midpoint (4) as a cutoff:

- Low anxiety, low avoidance → Secure
- High anxiety, low avoidance → Anxious-Preoccupied
- Low anxiety, high avoidance → Dismissive-Avoidant
- High anxiety, high avoidance → Fearful-Avoidant

Midpoint cutoff is a conservative MVP default; sample-median cutoffs are a future enhancement once enough pilot data is collected.

### LLM-inferred — Big Five

The `score-personality-unified` function prompts the LLM with all 20 conversation transcripts and a structured rubric (6 facets per trait, behavioral indicators). Scores are generated on a 0–120 scale and normalized to 0–100 for display.

### LLM-inferred — Attachment

The `run-attachment-classification` function prompts the LLM with the single relationship interview transcript and a rubric with anchors at 1/4/7 for anxiety and avoidance. Output is native 1–7 (no scale conversion). Confidence levels reflect transcript depth; thin or early-exit transcripts are scored with lower confidence.

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
| `VITE_APP_BASE_URL` | Public app origin used for copied participant links and auth redirects; falls back to the current browser origin in local development |

When deploying, set the same production origin in `VITE_APP_BASE_URL` and in the Supabase Auth site/additional redirect URL settings so sign-up callbacks and copied participant links point to the active domain.

Server-side (edge functions):

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | API key for the OpenAI API used by the edge-function LLM adapter |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for elevated database access |

The selected LLM backend and model are set in code in `supabase/functions/_shared/llm.ts`.
