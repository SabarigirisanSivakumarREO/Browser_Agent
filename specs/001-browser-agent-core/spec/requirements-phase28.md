# Phase 28 Requirements: Annotation & Ref Quality Improvements

**Date**: 2026-03-04 | **Requirements**: FR-456 to FR-471

---

## 28A: Rate Limit Retry

**FR-456**: System MUST detect HTTP 429 (rate limit) responses from LLM API calls.

**FR-457**: System MUST retry failed calls using exponential backoff with delays of 15s, 30s, and 60s.

**FR-458**: System MUST limit retries to a maximum of 2 attempts per category call.

**FR-459**: System MUST respect `Retry-After` response headers when present, using the header value instead of the default backoff delay.

**FR-460**: System MUST log each retry attempt with the category name, attempt number, and wait duration.

**FR-461**: System MUST apply retry logic to both per-category analysis and batched analysis modes.

**FR-462**: System MUST continue analysis for remaining categories when a category exhausts all retries.

---

## 28B: Confidence Downgrade for Missing Refs

**FR-463**: System MUST identify evaluations where status is not "not_applicable" AND element references are empty after ref population.

**FR-464**: System MUST multiply the confidence score of ungrounded evaluations by 0.7.

**FR-465**: System MUST NOT modify confidence for evaluations with status "not_applicable".

**FR-466**: System MUST NOT modify confidence for evaluations that have at least one element reference.

**FR-467**: System MUST log a summary message with the count of downgraded evaluations.

---

## 28C: Evaluations in Evidence Output

**FR-468**: System MUST include an `evaluations` array in the evidence.json output.

**FR-469**: Each evaluation entry MUST contain: heuristicId, status, confidence, observation/reasoning, and element references.

**FR-470**: Confidence values in evidence output MUST reflect any post-processing adjustments (downgrades, cross-validation penalties).

**FR-471**: The evaluations array MUST be empty (not omitted) when no evaluations are produced.
