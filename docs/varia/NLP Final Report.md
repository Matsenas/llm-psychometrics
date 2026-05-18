# **Classification agreement and participant experience of LLM-conducted conversational interviews**

Authors: Andrius Matšenas, Gustav Nikopensius, Danni Zhang

## Abstract

\<\!-- \~200 words. Write last. Summarize problem → approach → key results. \--\>

(Large language models (LLMs) can conduct open-ended conversations, raising the question of whether they can serve as scalable interview tools for psychological constructs such as attachment style…)

## 1\. Introduction

(Attachment theory (Bowlby, 1969\) describes how early relational experiences shape patterns of emotional bonding throughout life. The Experiences in Close Relationships–Revised questionnaire (ECR-R; Fraley et al., 2000\) is the most widely used self-report measure of adult attachment, yielding two continuous dimensions — Anxiety (fear of rejection and abandonment) and Avoidance (discomfort with closeness and dependency) — that together define four attachment prototypes: secure (low on both), preoccupied (high anxiety, low avoidance), dismissive (low anxiety, high avoidance), and fearful (high on both).

While questionnaires like the ECR-R are efficient, they constrain respondents to pre-defined statements that may not capture how people naturally reason about their relationships. Clinical and research interviews offer richer signals but are expensive to administer and analyze at scale. LLMs present an opportunity to bridge this gap: a conversational AI could conduct semi-structured interviews about relationship patterns and subsequently analyze the transcripts for attachment-relevant signals.

However, deploying such a system raises two distinct questions. From an NLP perspective: can a zero-shot LLM classification pipeline reliably extract attachment dimensions from unstructured conversation — producing consistent outputs across repeated runs and differentiating meaningfully between distinct attachment profiles? From an HCI perspective: how do users experience being interviewed by an LLM about a personal topic like relationship patterns, and do they find the system's output plausible?

We address these through a two-part evaluation:

**RQ1 (NLP Pipeline):** How consistently does a zero-shot LLM classifier infer attachment dimensions (Anxiety and Avoidance) from conversational interview transcripts, and can it differentiate between distinct attachment personas?

**RQ2 (Usability):** How do participants rate the usability of an LLM-conducted attachment style interview, as measured by the Chatbot Usability Questionnaire (CUQ) and the System Usability Scale (SUS), and do they perceive the system's attachment profile output as plausible?

\[PLACEHOLDER: 1–2 sentences previewing main findings once results are available.\])

## 2\. Methods

### 2.1 Overview

Participants engage in a 10–15 minute conversation with an interviewer LLM about relationship patterns, then view the system's output — an inferred attachment profile with a narrative explanation — and complete a usability questionnaire. Participants are explicitly instructed that they may fabricate their responses, as the study evaluates the system rather than the participant.

The resulting transcripts serve as input for the NLP pipeline evaluation (RQ1), while the usability questionnaire responses address RQ2.

### 2.2 Participants

\[N\] participants were recruited from \[the University of Tartu NLP course\]. All participants were \[age range\] with \[language proficiency note\]. No compensation was provided.

### 2.3 Interviewer LLM

The interviewer uses \[model name and version\] with a system prompt designed to explore the participant's approach to close relationships through open-ended questions — how they handle conflict, what closeness means to them, how they respond when a partner is unavailable — while following up on emotionally relevant statements. The prompt instructs the LLM to avoid clinical terminology or direct references to attachment theory, maintain a warm and non-judgmental tone, and conclude naturally within 10–15 minutes. The full system prompt is available in the code repository.

The interview was conducted via \[platform\].

### 2.4 Classifier

After each interview, the transcript is processed by a zero-shot classifier LLM (\[model name and version\]). The system prompt defines the Anxiety and Avoidance dimensions with descriptions drawn from attachment theory (Brennan et al., 1998\) and instructs the LLM to rate each dimension on a 1–7 scale, assign an attachment prototype (secure, preoccupied, dismissive, or fearful), and produce a narrative justification (\~100–200 words) explaining which parts of the conversation informed the classification. Temperature was set to \[X\]. Each transcript was processed \[N\] times to measure output stability.

### 2.5 Usability Instruments

After viewing the classifier output, participants complete:

**Chatbot Usability Questionnaire (CUQ)** (Holmes et al., 2019): 16 items on a 5-point Likert scale, producing a normalized 0–100 score covering conversational quality, error handling, and overall experience.

**System Usability Scale (SUS)** (Brooke, 1996): 10 items on a 5-point Likert scale, producing a 0–100 score with established benchmarks (68 \= average usability).

**Output plausibility item**: "The output (attachment profile and narrative) seemed plausible given what I said during the conversation" (5-point Likert).

\[PLACEHOLDER: Confirm whether additional custom items or an open-ended question will be included.\]

### 2.6 Procedure

1. Participant is briefed and informed they may fabricate responses.
2. Participant completes the LLM interview (\~10–15 min).
3. Participant views the inferred attachment profile and narrative.
4. Participant completes CUQ, SUS, and plausibility item (\~5 min).

Total session duration: approximately 20–25 minutes.

### 2.7 Evaluation

**RQ1 (NLP Pipeline):**

* **Inter-run consistency:** Standard deviation of Anxiety and Avoidance scores across \[N\] repeated classifier runs per transcript.
* **Persona sensitivity:** \[2–3\] team members conduct scripted interviews adopting clearly distinct attachment personas (highly anxious, highly avoidant, secure). The classifier should assign meaningfully different profiles to different personas, measured as the mean absolute difference in dimension scores between contrasting personas.
* **Qualitative cue analysis:** Examination of the classifier's narrative justifications — what conversational cues does it rely on, does it miss important signals, and are its reasoning chains plausible?

**RQ2 (Usability):**

* Descriptive statistics for CUQ and SUS scores (mean, SD, range), with SUS benchmarked against published norms (Bangor et al., 2009).
* Distribution of the plausibility item.
* \[PLACEHOLDER: Thematic analysis of open-ended responses, if included.\]

## 3\. Results

## 4\. Discussion

### RQ1 — NLP Pipeline Behavior

\[PLACEHOLDER: Interpret the inter-run consistency results. Key questions to address: How large were the standard deviations relative to the 1–7 scale? For example, an SD of 0.3 on a 7-point scale suggests high stability, while an SD above 1.0 would indicate the classifier's outputs are not meaningfully reproducible. Were Anxiety and Avoidance scores equally stable, or was one dimension more volatile — and if so, what might explain that asymmetry?\]

\[PLACEHOLDER: Interpret the persona sensitivity results. Did the classifier assign meaningfully different profiles to the anxious, avoidant, and secure personas? If so, this suggests the zero-shot pipeline can at minimum distinguish polar cases from unstructured conversation. If the personas received similar scores despite clearly different conversational content, this points to a ceiling on what zero-shot prompting can extract without more structured reasoning or examples.\]

\[PLACEHOLDER: Interpret the qualitative cue analysis. What types of statements did the classifier's narrative justifications rely on? Did it pick up on theoretically meaningful cues (e.g., avoidance of emotional disclosure, reassurance-seeking language), or did it latch onto surface-level signals (e.g., the word "close" appearing frequently)? Were there cases where the reasoning was plausible but the scores seemed miscalibrated, or vice versa?\]

### RQ2 — Usability

\[PLACEHOLDER: Report and interpret the CUQ and SUS scores. A SUS score above 68 indicates above-average usability (Bangor et al., 2009); scores above 80 are considered "good." How does the system compare? If the CUQ and SUS scores diverge, discuss why — the CUQ captures chatbot-specific qualities (personality, conversational flow) that the general-purpose SUS may miss.\]

\[PLACEHOLDER: Discuss the output plausibility item. Did participants find the attachment profile and narrative convincing given what they said — even when fabricating? A high plausibility rating despite fabricated input would suggest the classifier produces outputs that feel coherent regardless of input authenticity. A low rating might indicate that the narrative justifications were generic or disconnected from the actual conversation content.\]

\[PLACEHOLDER: If open-ended feedback was collected, summarize the main themes. What did participants find most and least effective about the conversational experience?\]

### Connecting the Two Tracks

\[PLACEHOLDER: Discuss how the NLP and usability findings relate to each other. Several patterns are worth watching for:

* If the pipeline produces consistent scores *and* participants rate the output as plausible, the system is both stable and perceived as credible — a prerequisite for any applied deployment.
* If the pipeline is consistent but participants find the output implausible, the classifier is confidently producing outputs that don't resonate with the conversational experience — a calibration problem.
* If participants enjoy the conversation (high CUQ/SUS) but the pipeline shows high inter-run variance, the front-end experience outpaces the back-end reliability — the system feels good to use but its outputs are not trustworthy.
* If both metrics are poor, the system needs fundamental redesign before further evaluation.

Frame whichever pattern emerges in terms of what it implies for the feasibility of LLM-based conversational assessment.\]

### Limitations

* Participants fabricated their responses, so classification accuracy against true attachment styles cannot be assessed. The NLP evaluation measures pipeline behavior — consistency and sensitivity — not construct validity.
* The small sample size (N \= \[N\]) limits the generalizability of usability findings. Results should be interpreted as indicative patterns rather than definitive conclusions.
* The interviewer LLM's behavior is not fully deterministic. Different participants may experience qualitatively different conversations depending on their input, introducing uncontrolled variation in both the interview quality and the resulting transcripts.
* Scripted persona transcripts used for the sensitivity analysis were produced by team members rather than independent actors, which may introduce bias in how distinctly the attachment profiles were portrayed.
* The usability evaluation captures a single session. Perceptions of conversational AI may shift with repeated use, and a one-time assessment cannot capture learning effects or novelty bias.
* \[PLACEHOLDER: Any additional issues encountered during data collection, e.g., technical failures, participants finishing very quickly, language barriers.\]

### Future Work

\[PLACEHOLDER: Outline 2–3 concrete directions. For example:

* A follow-up study with ethical approval could validate the classifier against real ECR-R self-report scores, enabling accuracy evaluation alongside the behavioral metrics reported here.
* The zero-shot classifier could be compared against few-shot and structured extraction variants to determine whether additional prompting complexity improves consistency or sensitivity.
* A larger participant pool would allow statistical testing of usability differences across demographic groups and enable correlation analysis between pipeline consistency and perceived plausibility.
* Longitudinal usability assessment could reveal whether the novelty of LLM interaction inflates initial usability ratings.\]

## 5\. Conclusion

We evaluated an LLM-based conversational attachment style assessment system along two axes: NLP pipeline reliability and user-perceived usability. \[PLACEHOLDER: Summarize RQ1 findings, e.g., "The zero-shot classifier produced \[stable/variable\] outputs across repeated runs (mean SD \= \[X\] on a 7-point scale) and \[successfully/partially\] differentiated between scripted attachment personas, though qualitative analysis revealed \[key observation about the classifier's reasoning\]."\] \[PLACEHOLDER: Summarize RQ2 findings, e.g., "Participants rated the system at \[score\] on the SUS, indicating \[above-average/average/below-average\] usability, and \[N out of N\] found the output plausible given their conversational input."\] \[PLACEHOLDER: Connecting sentence, e.g., "Together, these findings suggest that while the conversational interface provides a \[usable/engaging\] experience, the classification pipeline's \[consistency/sensitivity/reasoning quality\] remains a bottleneck for applied deployment."\] Further work validating the system against established self-report measures with consenting participants would clarify whether the patterns observed here translate to genuine assessment accuracy.

## Contributions

| Member | Contribution |
| :---- | :---- |
| Andrius Matsenas | \[e.g., Interviewer LLM prompt design, chat interface implementation, pilot testing\] |
| Danni Zhang | \[e.g., Classifier pipeline, consistency and sensitivity analysis\] |
| Gustav Nikopensius | \[e.g., Usability instruments (CUQ, SUS), participant sessions, qualitative analysis, report writing\] |

All members contributed to the study design, interpretation of results, and report editing.

## References

\<\!-- Use (Author, Year) format. →

Bangor, A., Kortum, P., & Miller, J. (2009). Determining what individual SUS scores mean: Adding an adjective rating scale. *Journal of Usability Studies*, 4(3), 114–123.

Bowlby, J. (1969). *Attachment and Loss: Vol. 1\. Attachment*. Basic Books.

Brennan, K. A., Clark, C. L., & Shaver, P. R. (1998). Self-report measurement of adult attachment: An integrative overview. In J. A. Simpson & W. S. Rholes (Eds.), *Attachment theory and close relationships* (pp. 46–76). Guilford Press.

Brooke, J. (1996). SUS: A "quick and dirty" usability scale. In P. W. Jordan, B. Thomas, I. L. McClelland, & B. Weerdmeester (Eds.), *Usability Evaluation in Industry* (pp. 189–194). Taylor & Francis.

Fraley, R. C., Waller, N. G., & Brennan, K. A. (2000). An item response theory analysis of self-report measures of adult attachment. *Journal of Personality and Social Psychology*, 78(2), 350–365.

Holmes, S., Moorhead, A., Bond, R., Zheng, H., Coyle, L., & Mulvenna, M. (2019). Usability testing of a healthcare chatbot: Can we use conventional methods to assess conversational user interfaces? *Proceedings of the 31st European Conference on Cognitive Ergonomics*, 207–214.

\[PLACEHOLDER: Add citations for the LLM models used, e.g., OpenAI (2024), Anthropic (2025).\]

\[PLACEHOLDER: Any additional references.\]

---

Code repository: \[PLACEHOLDER: GitHub/GitLab link\]