# BenSpace campus implementation protocol

This is the proposed production design for Bennett IT and the wellness team. The React demo ships with local sample flows. Institution access, infrastructure, policies and service commitments require Bennett's confirmation.

## 1. Registration and sign-in

**Preferred route with university SSO**

1. The student selects **Sign up**, enters their college ID and selects **Continue**. Use the format and canonicalisation rules supplied by Bennett. The UI can show the normalized value for review.
2. Your backend starts an OpenID Connect authorization-code flow with PKCE using Bennett's approved provider. Store a short-lived transaction with the requested college ID, state, nonce and PKCE verifier on the server. Redirect the student to the university's own sign-in page.
3. The server handles the callback, validates state and token signature, issuer, audience, expiry and nonce, and resolves the authenticated identity to an active student in Bennett's directory. Match that authoritative college ID against the entered one. Bind the account to the immutable identity pair `(issuer, subject)`. Do not merge accounts based on an ID typed into a form or a mutable email address.
4. Show the privacy notice and required acknowledgements, then create the student profile idempotently. Issue a rotated opaque session cookie over HTTPS with `HttpOnly`, `Secure` and an appropriate `SameSite` setting. Sign-in uses the same verified identity and requires an existing active profile. Use the university's account recovery process.
5. On logout invalidate the server session and clear UI state. Apply campus-approved session expiry and recheck active student status under the agreed policy, including loss of eligibility.

**Alternative when Bennett approves institutional-email verification**

1. Resolve the submitted ID against an approved directory server-side and send a one-time code only to the institutional address already linked to an eligible ID. Show a neutral response regardless of eligibility to avoid revealing who is enrolled.
2. Generate codes using a cryptographically secure random generator. Store a keyed digest and expiration against a random challenge ID. Bind the challenge to the browser transaction and purpose. For an initial policy use 10 minutes, at most five failed attempts, a 60-second resend cooldown, and limits by account, browser and network. A resend invalidates the previous code. Do not store or log raw codes or email content.
3. Consume the challenge atomically on success, then create the account for sign-up or open the existing account for sign-in. Return generic wrong/expired-code messages and give the student a support route. Review thresholds and recovery with campus IT before launch.

### API contract

Use same-origin HTTPS and JSON under `/api/v1`. Browser requests use the session cookie. Validate the CSRF token and origin for mutations, validate payloads on the server, use `Cache-Control: no-store` for private data, and never trust a student or provider identity supplied by the client. The paths below are the proposed integration contract.

| Method and path | Request | Success |
| --- | --- | --- |
| POST /auth/start | collegeId, purpose (`signup` or `signin`) | 202 with challengeId and next step. For SSO, return the approved redirect URL. |
| GET /auth/callback | OIDC callback parameters | Validate transaction and redirect to onboarding or Home. |
| POST /auth/verify | challengeId, code, for approved email route | 200 with next step, or generic 400/429. |
| POST /auth/activate | noticeVersion and required acknowledgements, bound to verified onboarding session | 201 on initial activation, 200 on a replay. |
| GET /me | Active session | 200 with own role and minimal display information. |
| POST /auth/logout | CSRF token | 204 after server session invalidation. |
| GET /providers?role=counsellor | Optional approved role | 200 with published profiles. |
| GET /providers/{id}/slots | Provider ID | 200 with available slots and supported modes. |
| POST /bookings | slotId, mode and optional note | 201 with confirmed booking or 409 if unavailable. |
| GET /bookings | Active session | 200 with the student's own bookings. |
| PATCH /bookings/{id} | newSlotId, mode, expected version | 200 on reschedule or 409 on conflict. |
| DELETE /bookings/{id} | Expected version | 204 after cancellation. |
| GET /articles?topic=Sleep | Optional topic | 200 with published content. |
| GET /support-contacts | Public | 200 with approved numbers, hours and last verified date. |

For booking requests, use an `Idempotency-Key` header generated once per intended action. The server associates it with the authenticated student, operation and request digest. Replays of the same action return the original result. Reuse with a different payload returns a conflict. Use 401 for expired sessions, 403 for disallowed roles, 404 for inaccessible records where existence should remain private, 422 for invalid field values and 429 for rate limits. Error bodies can use `{"code":"SLOT_UNAVAILABLE","message":"That time is no longer available."}`.

Example production React adapter, after the endpoints exist:

```js
export async function confirmBooking({ slotId, mode, note, csrf, requestId }) {
  const response = await fetch('/api/v1/bookings', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrf,
      'Idempotency-Key': requestId,
    },
    body: JSON.stringify({ slotId, mode, ...(note?.trim() ? { note: note.trim() } : {}) }),
  })
  if (response.status === 409) return { conflict: true }
  if (!response.ok) throw new Error('Unable to confirm the session. Please try again.')
  return response.json()
}
```

Store production times as UTC ISO 8601 and display them in Asia/Kolkata with IST indicated. A booking response should include its opaque ID, provider display name, slot start, mode, status and version.

## 2. Data model and access

| Table | Fields | Access |
| --- | --- | --- |
| students | id, identity issuer and subject, verified college ID, eligibility, notice version | Own minimal profile. Authorized identity admin for enrollment. |
| providers | id, role, name, approved bio, supported modes, active flag | Public to authenticated students as approved. Staff manage their own schedule. |
| slots | id, provider_id, starts_at, ends_at, state | Students can read availability. Staff edit own schedule. |
| bookings | id, student_id, slot_id, mode, status, version, created_at | Student sees own bookings. Assigned staff see their appointments and minimum details. |
| booking_notes | booking_id, protected note, deletion deadline | Student and assigned staff when approved. Operational logs exclude notes. |
| reminders | booking_id, booking_version, due_at, delivery state | Worker and restricted support staff. |
| articles | id, title, topic, body, reviewer, published_at | Students see published records. Editors and wellness reviewers manage publication. |
| support_contacts | label, telephone, hours, scope, verified_at, owner | Public for urgent support, maintained by an authorized campus owner. |

Keep mood selection in memory for the pilot unless there is an approved need to retain it. If history is added, make it opt-in, private to the student and deletable. Keep therapy records outside this app unless the university separately approves a clinical system. Use least-privilege roles, encrypted storage and backups, access auditing without sensitive text, a retention schedule and a documented deletion process. Agree on what privacy wording and confidentiality exceptions students should see before booking.

## 3. Booking and reminders

- Publish non-overlapping provider slots. Lock the selected slot in a database transaction, check its availability, supported mode, future start and staff eligibility, and create the booking. Lock the student's schedule during overlap checks and use a database exclusion constraint if slots can differ in duration or start time.
- Use a database invariant as a second guard against double booking. For a PostgreSQL model with reusable slot rows and cancelled bookings retained, the active-slot constraint could be:

  ```sql
  CREATE UNIQUE INDEX one_confirmed_booking_per_slot
    ON bookings (slot_id) WHERE status = 'confirmed';
  ```

- Reschedule atomically. Validate the target and ownership, lock the old and new slots in a consistent order, and update the booking/version only if the target is still available. A failure preserves the original slot. On cancellation, release availability and suppress any pending reminder for that booking version.
- Create the reminder job in the same transaction as the booking through an outbox. A worker can send an opt-in neutral reminder at `starts_at − 1 hour`, checking current status and version before sending. For bookings made inside that hour, confirm immediately and skip the missed scheduled reminder. Use a unique delivery key per booking/version/channel to avoid duplicate notifications where the provider supports deduplication. Leave mood, notes and the reason for the session out of notifications.
- Keep the mode capability aligned with real services. An in-person booking shows an approved location. A video booking gets an authorized meeting link. A chat booking links to an approved platform with access controls, hours and response expectations.

## 4. Urgent help and campus operations

- Keep Urgent help accessible before and after sign-in. For immediate danger, give priority to India's emergency number 112. Offer Tele MANAS via the phone dialler and publish the campus desk only after verifying its number, operating hours, ownership and after-hours route.
- Treat mood choices as self-reflection. A Rough check-in can offer a path to talk, but it does not send a clinical alert. The breathing exercise should stay optional and should never delay access to emergency contacts.
- Confirm who owns the resource directory and how frequently it is reviewed. The campus counselling team owns clinical wording, triage and confidentiality exceptions. Bennett IT owns identity, hosting, access and incident response. The student team owns interface and feedback with synthetic data until approval.

Official references for contact verification include the [Ministry of Home Affairs Emergency Response Support System](https://www.mha.gov.in/emergency-response-support-system-erss) and [Tele MANAS](https://telemanas.mohfw.gov.in/home?oai_link_source=model_response_hotline).

## 5. Acceptance checklist

| Test | Expected result |
| --- | --- |
| Active student, correct ID and correct verification | Account created once. Repeat access reaches the existing account. |
| Wrong ID, mismatch, expired code and replay | Generic error or recovery path. No account or session issued. |
| Ineligible student and deprovisioning | Access denied or revoked according to campus policy. |
| Two students choose the same slot | One succeeds. The other sees refreshed availability. |
| Reschedule to a taken slot | Original booking is retained. |
| Cancel then process an old reminder | Cancelled appointment receives no new reminder. |
| Direct access to another student's booking | Server denies the request. |
| Urgent help with signed-out and expired sessions | National contact actions still open the dialler. Verify on supported phones without placing test calls. |
| Keyboard, screen reader, mobile and reduced motion | Focus and labels stay usable. Breathing instructions work without animation. |
| Privacy and operations review | Named owners, approved notices, verified contacts, recovery, deletion and incident drills are documented. |
