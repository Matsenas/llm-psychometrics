# Research question
To what extent do LLM-generated relationship formulations recover the ground-truth attachment profile of a simulated participant, and how is recovery moderated by attachment style and conversation length?

## Why this one:
- Falsifiable and measurable. Profile recovery has a clear metric (classification accuracy or correlation with assigned ECR-R dimensions).
- NLP-native. It's about generation and information extraction, not clinical validity claims you can't make with synthetic data.
- Honest about the setup. You're not claiming the formulations are clinically useful for real patients — you're asking whether the pipeline can recover signal that was deliberately injected. That's a cleaner contribution.
- Surfaces the leakage question naturally. Recovery rates are only meaningful if the interviewer side doesn't have the persona prompt. So Gustav's concern becomes a built-in design constraint, not a separate arm.

A secondary question worth keeping if therapists included:
- Do trained therapists judge the formulations as clinically coherent (independent of recovery accuracy)?
- This separates "the model recovered the right label" from "the formulation reads like something a therapist would write."

## Methodology
1. Simulated participant generation
Generate N = 60 personas stratified across the two ECR-R dimensions (anxiety, avoidance), each on a low/medium/high scale. That gives you a 3×3 grid with ~6–7 personas per cell. For each persona:
- Generate a 36-item ECR-R response vector consistent with the assigned (anxiety, avoidance) coordinates. Add per-item noise so responses aren't perfectly clean.
- Generate a backstory (relationship context, recent conflict, communication patterns) consistent with the profile.

Use a strong model (Claude Opus or GPT-5) for persona generation. Keep persona prompts separate from everything downstream.


2. Conversations generated separately
Two-agent setup with isolation:
- Participant agent has the persona prompt and backstory.
- Interviewer agent has only the existing chat system prompt. It sees only what a real interviewer would see: the participant's messages.

Run conversations to a fixed length (say 8–12 participant turns) so length is controlled. Optionally vary length as a secondary factor to answer the moderator question.


3. Formulation generation
Feed each transcript to your existing formulation pipeline. Output the structured formulation across the three rubric dimensions (conflict cycle, attachment pattern, emotional triggers).


4. Evaluation
Automated track (the main quantitative result):
- Have a third, "judge" LLM read each formulation, blind to ground truth, and output predicted (anxiety, avoidance) scores on the same scale.
- Compare predictions against ground-truth labels: classification accuracy for discrete style, Pearson/Spearman correlation for the continuous dimensions, confusion matrix across the 3×3 grid.
- Result is a recovery metric across all 60 personas.

Therapist track (the qualitative-but-rubricked result):
- Sample 15–20 transcripts (stratified across the grid) for therapist rating.
- Therapists rate on your existing three rubric dimensions, blind to ground truth.
- Compute ICC across the two raters; report with confidence intervals given small n.
- Optionally have therapists also guess the attachment profile (to compare therapist accuracy vs LLM-judge accuracy.)


5. Analysis
- Recovery accuracy overall and per cell of the 3×3 grid (does the pipeline do worse on disorganized-style profiles, for instance?).
- Therapist coherence ratings overall and by cell.
- Cross-tab: are high-coherence formulations also high-accuracy formulations, or do they come apart?
- If you ran the length manipulation: does longer conversation improve recovery, plateau, or degrade?