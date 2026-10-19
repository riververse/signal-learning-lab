# Evidence-aware learning recommendations

The learning page uses reviewed learning evidence, explicit browser-local self-reports,
and the selected direction to choose one small next task. It is a deterministic rule
engine. It does not read private chats at runtime, grade answers, infer mastery from
page visits, or send progress to a server.

## Files and commands

- `learning-profile.json`: editable, reviewed evidence, priority and current frontiers.
- `learning-progress.js`: the original 17 base lessons, validation, recommendation and
  browser-local progress UI. The bounded generated section embeds the JSON profile.
- `next-learning.template.html` and `preview-next-learning.template.html`: formal and
  isolated-preview layouts. Both use the same profile and model.
- `build-next-learning.py`: validates the profile with the actual JavaScript model,
  embeds it, and generates both pages with matching static fallback content.
- `test-learning-progress.cjs`: dependency-free offline regression tests.

Run from this directory with Python 3 and Node.js:

```sh
python build-next-learning.py
python build-next-learning.py --check
node test-learning-progress.cjs
node test-question-helper.cjs
```

There is no network access, package installation or build-time service dependency.
`--check` never writes. Generation is deterministic and validates all inputs before
writing any output. `--directory /path/to/copy` supports isolated build fixtures.
At least one supported template must exist; present templates are all regenerated.
Never edit the generated profile marker or generated HTML directly.

## Updating the reviewed profile

1. Review the relevant learning evidence. Identify what was explained, what the
   learner independently answered correctly, and what remains unanswered or unclear.
   A correct answer in teaching material is not a correct learner response.
2. Update `reviewedAt` (the review date), `reviewLabel` and `version`.
   `latestLearningAt` is the latest substantive study date and can be older than the
   review date. Rechecking an unchanged conversation does not imply new learning.
3. Update `evidence` and `topicSummaries` with concise paraphrases. Do not add personal
   names, raw conversation quotes, private conversation URLs, credentials or API keys.
4. Adjust `preferredPriority`, additions and overrides to reflect the current
   questions. Keep all published lesson IDs stable. Append new IDs rather than
   renaming or deleting old ones, since backups and local progress refer to them.
5. Use only necessary prerequisites. A targeted catch-up check can start at the
   current frontier without forcing all older exercises to be repeated first.
6. Rebuild and run the checks above. Inspect the formal and preview pages at desktop
   and phone widths before any separately authorized publication.

### Profile schema

| Field | Purpose |
| --- | --- |
| `schemaVersion` | `1`, the curated-profile format (separate from progress v1). |
| `version` | Human-controlled content revision used for asset cache keys. |
| `reviewedAt` | Valid ISO date, `YYYY-MM-DD`, of the evidence review. |
| `latestLearningAt` | Optional valid ISO date of substantive learning. |
| `reviewLabel`, `evidenceNote` | Short, non-sensitive display/context text. |
| `preferredPriority` | Ordered unique lesson IDs. Omitted lessons follow in base order. |
| `lessonAdditions` | New stable-ID lesson objects. Reserved/prototype keys are rejected. |
| `lessonOverrides` | Existing ID → editable lesson fields. Cannot rename an ID. |
| `evidence` | Lesson ID → `{status, summary, observedAt?}`. |
| `topicSummaries` | Unique topic cards with `title`, `status`, `frontier`, `summary`, `check`, `href`. |

Lesson fields are `id`, `topic`, `title`, `prerequisites`, `goal`, `check`, `why`,
`href`, `experiment`, `material`, and optional `outline`, `frontier`,
`prerequisiteText`, `estimatedMinutes`. Existing base lessons remain readable in
`learning-progress.js`; the profile contains only changes and additions.

Evidence statuses have deliberately distinct meanings:

- `explained`: the concept or example has been taught. It is still recommended for
  independent verification unless the learner explicitly self-reports completion.
- `pending`: the question or exercise remains unconfirmed. A remembered observation
  or an expressed question alone does not satisfy it.
- `independent-correct`: reviewed evidence supports an independent correct response
  to this specific lesson check. This can satisfy a prerequisite without writing,
  importing or manufacturing a local completion timestamp.

The current 2026-10-19 review adds no new `independent-correct` entries. This is not
an assertion that the learner has never independently understood any earlier topic.
A status change must be supported by actual reviewed evidence, not by an opened
page, a generated answer, or the existence of a lesson.

## Recommendation rules

1. Take `preferredPriority`, then any remaining base lessons in original order.
2. If the learner selects a direction, consider targets only in that direction.
3. For each target, resolve only its explicit prerequisites. Missing prerequisites
   can come from another topic and appear with an explanation.
4. A specifically verified lesson satisfies itself and its use as a prerequisite.
   Explanation/pending statuses never do. Otherwise a local self-report satisfies
   the lesson only when its own required prerequisites are satisfied.
5. Return the first remaining task, with its reason, current frontier, minimum
   prerequisite, independent check, evidence status, time estimate and next step.

For this review, default priority is frequency cancellation/delay, the relationship
between filter structures and design families, the latest Fourier bin check, and
Kalman lesson 14. The Fourier direction starts at the 12 Hz, 24 → 48 real-sample
check rather than gating it on an older complex-coefficient exercise. The older
exercise is still available. The filter-family material explicitly notes that the
elliptic extension needs further explanation.

## Progress compatibility and privacy

The key remains `river.learning.progress.v1`, with exactly this exported structure:

```json
{"version":1,"preferredTopic":"auto","completed":{"fourier-amplitude":"2026-10-07T10:12:13.456Z"}}
```

All 17 legacy IDs remain accepted. All valid stored timestamps are preserved as
provided. Reading the page, loading a new profile and switching recommendations do
not write completion records. Repeated marking is idempotent. Undo removes only the
selected self-report; descendant timestamps remain in history, while prerequisites
are rechecked before further progress. Verified evidence stays separate from undo.

Imports merge completion timestamps, keeping the later timestamp per ID, and adopt
the imported direction. Files over 64 KB, wrong versions, unknown IDs, invalid dates
and unsafe/prototype fields are rejected without changing the current state. A new
import, a local action, or a valid cross-tab update invalidates an older in-flight
import. Export contains only local state, never the reviewed evidence profile.

Other-tab updates refresh the card without echo writes. Invalid events leave the
current state intact. Storage failures preserve session-local progress and expose a
warning plus export. Unreadable original storage is not overwritten at startup.
Reset requires the existing browser confirmation and only clears local progress.

## Public JavaScript contract

The existing `window.RiverLearning` / CommonJS API is preserved:

- `key`, `topics`, `lessons`, `emptyState()`, `validateState(raw)`
- `recommend(state, preference?)`, `prerequisitesDone(lesson, state)`
- `init(window)`, then `getState()`, `getRecommendation()`,
  `setCompleted(id, boolean)`, `getCurrentTopic()`
- Existing `river:progress` events still contain a defensive state copy.

Additional inspection/build APIs are `profile`, `orderedLessons`, `evidenceLabels`,
`getEvidence(id)`, `createModel(profile)`, `validateProfile(profile)` and `safeLink(url)`.
Profiles and lesson metadata are immutable. `createModel` makes an isolated model;
it does not mutate the default model or the learner's storage.

`recommend` retains `lesson`, `target`, `isPrerequisite`, `preferredTopic`, and adds
`reason`, `prerequisiteText`, `frontier`, `verificationQuestion`, `evidenceStatus`,
`evidenceLabel`, `evidenceSummary`, `estimatedMinutes`, `reviewedAt`, `afterCheck`.
When no task remains it returns `null`; the UI avoids claiming universal mastery.

The generator fills escaped `PROFILE_DATE`, `PROFILE_REVIEW_LABEL`,
`PROFILE_VERSION`, `PRIMARY_TITLE`, `PRIMARY_GOAL`, `PRIMARY_CHECK`, `PRIMARY_WHY`,
`PRIMARY_PREREQUISITE`, `PRIMARY_FRONTIER`, `PRIMARY_TOPIC`, `PRIMARY_HREF`,
`PRIMARY_EXPERIMENT`, `PRIMARY_MATERIAL`, `PRIMARY_EVIDENCE_STATUS`,
`PRIMARY_AFTER_CHECK` and `PRIMARY_META` tokens. `PROFILE_EVIDENCE` is generated
card markup whose individual data fields are escaped. Unknown tokens fail the build.
Only same-directory relative HTML links are accepted in profile lesson/evidence
links. No executable URL schemes, external hosts, root paths or traversal are allowed.

## Test coverage and remaining QA

The offline suite checks all legacy IDs/timestamps, preference and dependency
selection, undo, verified versus explained evidence, safe links/anchors, malformed
and malicious imports, cross-tab changes, blocked storage, backup/reset, repeated
clicks, in-flight import races, profile isolation, generated fallback consistency,
escaping and deterministic regeneration. DOM tests use a minimal contract harness;
they do not replace browser rendering, accessibility, responsive layout or real
multi-tab/storage testing. Those visual/browser checks remain a separate release step.

## Presentation contract

The formal page uses the approved cool mathematical theme: retain `math-studio` on
its body and the final `signal-studio.css` include when editing the template.
Profile updates must rebuild both formal and preview outputs without changing the
local progress storage key or marking explanations as independently mastered.
The formal homepage and navigation always link to `next-learning.html`; preview
routes remain isolated design references. See `DESIGN.md` for full-site conventions.
