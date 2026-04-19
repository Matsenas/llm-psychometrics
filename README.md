# LLM Psychometrics

A research web application studying whether AI chatbots can accurately estimate personality traits through natural conversation. Participants complete 20 guided chat sessions with an LLM, then a standard IPIP-50 self-report questionnaire. The system compares LLM-inferred Big Five scores against self-reported scores and collects participant accuracy ratings.

Built as part of research at the University of Tartu.

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui (Radix UI)
- **Backend:** Supabase (PostgreSQL, Auth, Edge Functions)
- **LLM:** Anthropic Claude Sonnet via Messages API
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
│  Edge Functions     chat-conversation (LLM dialogue)        │
│                     score-personality-unified (trait scoring)│
└──────────────┬──────────────────────────────────────────────┘
               │ Anthropic Messages API
┌──────────────▼──────────────┐
│  Claude Sonnet 4            │
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

### `chat-conversation`

Handles real-time LLM dialogue during chat sessions.

1. Validates JWT and verifies session ownership
2. Retrieves conversation history from `chat_messages`
3. Builds system prompt with trait-specific guidance (aspect, probing strategy, exit criteria)
4. Calls Gemini 2.5 Flash via Lovable AI Gateway
5. Detects `[CONVERSATION_COMPLETE]` tag to signal session end
6. Returns cleaned response + `shouldEnd` flag

### `score-personality-unified`

Analyzes all 20 conversation transcripts to generate Big Five personality scores.

1. Retrieves all `chat_messages` for a participant
2. Concatenates transcripts with expert system prompt (Big Five framework, 6 facets per trait, behavioral indicators)
3. Calls LLM to generate scores on a 0-120 scale
4. Normalizes to 0-100 and stores in `personality_scores` (method=`llm`)

## Admin Dashboard

| Route | Component | Capabilities |
|-------|-----------|-------------|
| `/auth` | `Auth.tsx` | Admin email/password login with role verification |
| `/admin` | `Admin.tsx` | Participant table with search/filter, CSV import/export, bulk enable/disable, admin account management, LLM prompt and question overviews |
| `/admin/participant/:id` | `ParticipantDetails.tsx` | Individual participant data: consent status, chat transcripts, IPIP responses, personality scores, accuracy ratings |

## Scoring

### IPIP-50 (self-report)

Each Big Five trait is measured by 10 items (5 positive-keyed, 5 reverse-keyed). Raw scores range 10-50, normalized to 0-100:

```
score = ((rawScore - 10) / 40) * 100
```

### LLM-inferred

The `score-personality-unified` function prompts the LLM with all 20 conversation transcripts and a structured rubric (6 facets per trait, behavioral indicators). Scores are generated on a 0-120 scale and normalized to 0-100.

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

Server-side (edge functions):

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | API key for the Anthropic Messages API |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for elevated database access |
