# CPD Update 1 — Feature Plan

**Status: APPROVED 2026-08-09 — designs signed off, development started (build order below)**

Design revision log (all in Figma, section "CPD Update 1 — Proposal" + "CPD Update 1 — Flows"):
- R1: 8 proposal screens built (U1-AU3/EM1/FM5/FM6/PS1/PS2/PF1/NT) + amber behavior annotations.
- R2: framework §3 revised to the draft→committee-approval→locked lifecycle; U1-FM5 added.
- R3: alignment pass — banners/cards inserted into auto-layout flows (not overlaid), PS1 data/pills fixed, PF1 photo card into page flow.
- R4: table action buttons unclipped (20px clipping cells held 38px buttons) — PS1 View, FM5 Edit.
- R5: 6 end-to-end flows (F1–F6) with START/END pills + step-labelled arrows.
- R6: FM5 gains cycle-selector dropdown + "Total credits required this cycle" strip; F3 starts at FM2 cycles list; F6 gains the locked rate book as its second screen; FM5 per-row Edit replaced by a single header "Edit rate book" button.
- Build defaults where open questions are unanswered: designation = specialty; Q5 = cloned previous-year rates stand if unapproved; org users admin-first; overrides notify the practitioner only.
Figma: page `v1 Flow Map` → section **"CPD Update 1 — Proposal"** (frames prefixed `U1-`) + section **"CPD Update 1 — Flows"** (F1–F5 end-to-end journeys: registration+approval, event+org creation, framework lifecycle, eligibility adjustment, profile completion, active-cycle threshold edit (F6: FM2 → U1-FM6 → FM7 confirm → notify) — START/END pills, step-labelled arrows, 0.4× screen clones).
No development starts until the designs are approved.

---

## 1 · Calendar-year cycle (1 Jan → 31 Dec)

**Now:** seeded 2026–2027 cycle with placeholder dates.
**Change:** cycles run 1 January 00:00 → 31 December 23:59 of one year, named by year (e.g. "2027 cycle").

- Migration: update `cpd_cycles` seed/current row; cycle create form defaults to calendar year.
- **Year-end sequence (see §3):** framework edits lock **31 Dec 21:00**; final score calculation + cycle-certificate eligibility snapshot runs **after 23:59** (scheduled job), so certificates render against frozen rules.
- Affected: dashboard cycle picker labels, certificate payloads, `aggregateCycle` windows (`per_year` caps already window on dates — unchanged logic, new bounds).

## 2 · Event ↔ Organization (select-or-create)

**Now:** events have an organizer field but no enforced link to `institutions`.
**Change:** creating an event REQUIRES an organization.

- **Super admin** (EM1 create form): searchable combobox over `institutions`; typing a name with no match shows **Create "«name»"** → inserts the org inline (minimal row: name, type=organizer default) and selects it. Full org detail can be completed later in OG.
- **Organization user** (institution_memberships row): org field is **locked to their organization** (pre-filled, disabled). They can never create events for other orgs.
- Data: `events.organizer_institution_id` FK → institutions (not null going forward); backfill n/a (events table currently empty post-wipe).
- RLS: org users' event insert policy checks membership on the institution.

## 3 · Cycle framework lifecycle: draft rates → committee approval → locked + adjustable floors

**Now:** `/admin/framework` is read-only (FM1/FM5/FM6 designed; FM7 warning dialog designed but unbuilt).
**Change (revised 2026-08-09):** the framework becomes a per-cycle lifecycle with two permission tiers — **both super admins and committee members** operate it.

**Cycle lifecycle:**

1. **Auto-create** — the new cycle is created automatically for the calendar year (1 Jan → 31 Dec, named by year), cloning the previous cycle's rate book + floors as a **DRAFT**.
2. **DRAFT (rates configurable)** — from year start until the rate book is approved, the **credit scores per entry type** (activity-type rates / framework_rules) are editable. Window hard-closes at the **first submission or first approval** landing in the cycle — whichever comes first — so no entry is ever priced against unapproved rates.
3. **Committee approval** — the committee reviews and **approves the rate book** (approval recorded: who/when, audit-logged). On approval the rates **lock permanently** for that cycle.
4. **ACTIVE (rates locked)** — after approval, only **category floors** and the **final cycle total** (certification eligibility bar) remain adjustable. These adjustments are **global**: they apply to all practitioners and all future scoring in that cycle. Editable until **31 Dec 21:00**, then everything locks.
5. **Year-end job (23:59+):** freeze → recompute all practitioner aggregates → issue/queue cycle certificates. Vercel cron hitting a protected route (doubles as the keep-alive).

**Rules:**

- Rate edits blocked the moment `cpd_entries` has any row for the cycle (server-enforced), even before committee approval — UI explains why.
- If 1 Jan arrives with the rate book unapproved, submissions are held? **No** — v1 keeps it simple: entries are allowed and the draft window simply closes with the previous cycle's (cloned) rates standing as final unless approved earlier. → flagged as **open question Q5**.
- Floors/total edits and rate-book approval each write `audit_log` + **notify all practitioners** (`framework_changed`).
- Permissions: rate editing = admin + committee; **approval = committee only**; floors/total = admin + committee.
- Data: `cpd_cycles.rate_book_status` (draft/approved) + `rate_book_approved_by/at`; framework tables already versioned per cycle.

**Notification system (new, first consumer):**

- Table `notifications` (id, user_id, kind, title, body, href, read_at, created_at) + RLS (owner read/update).
- Navbar bell (top-right) opens the designed dropdown (D-NT1, Enhancements page): unread badge, list, "Mark all read".
- Kinds in this update: `framework_changed`, `eligibility_adjusted` (§4), room to grow (entry reviewed, event approved… later).

## 4 · Practitioner scores tab (super admin) + per-practitioner eligibility overrides

New admin section **"Practitioner scores"** (sidebar item under Administration).

**U1-PS1 — list:** every practitioner with cycle credits (earned/pending), per-category totals, completion state.
- Filters: **designation/specialty** (dropdown), **credit score** (range/threshold chips e.g. "< floor", "on track", "complete"), search by **name or PMR/TMR number**.

**U1-PS2 — practitioner detail:** category breakdown vs floors, total vs target, entries summary + **Eligibility overrides** panel:
- Adjust per-category floor and/or overall cycle total **for that practitioner only** (e.g. joined mid-year, medical leave).
- Adjustment dialog REQUIRES: new value(s), **reason (text)**, **evidence attachment** (image/PDF → private bucket `cpd-adjustments`).
- Every adjustment: `practitioner_cycle_overrides` row (practitioner, cycle, field, old→new, reason, attachment path, adjusted_by, at) + audit_log + notification to that practitioner (`eligibility_adjusted`).
- Adjustment history list visible in the panel (who/when/why/evidence link).
- Credit engine: `aggregateCycle` reads overrides (floor/total) for the practitioner before computing completion — pricing/caps math unchanged.

## 5 · Practitioner profile page (PF built + extended)

Build PF1 (view) / PF2 (edit) — currently designed but not developed — **plus new fields:**

- **Primary workplace** (required to "complete" profile): combobox over institutions with the same **select-or-create** behavior (§2). Also added to **signup (AU3)** — new field after specialty; org created on submit if new.
- **Other workplaces**: repeatable list (clinics etc.), same combobox, add/remove.
- **Profile photo**: upload (crop-to-square), stored in new public-read bucket `cpd-avatars`; navbar avatar shows the photo (falls back to initials).
- Data: `profiles.primary_institution_id` FK, `practitioner_workplaces` join table, `profiles.avatar_path`.
- Registration approval view (RA2) shows the stated primary workplace.

---

## Build order (after approval)

1. **Migrations** (cycle dates, organizer FK, notifications, overrides, workplaces/avatar) + RLS
2. **Notifications plumbing** (bell + dropdown + unread badge) — needed by §3 and §4
3. **Event↔Org combobox** (shared OrgCombobox component: EM1 + AU3 + PF reuse it)
4. **Framework editing** + lock window + notification fan-out
5. **Practitioner scores tab** + overrides + evidence upload + engine override support
6. **Profile pages** + signup field + avatar
7. **Year-end job** (cron: freeze/recompute/certify + keep-alive)

Each step: e2e coverage per test-gate rule, dev-log + memory + push per completion protocol.

## Open questions

1. Cycle total stays 50.0 until MMA confirms (C1) — adjustability (§3) makes this less blocking.
2. Org user portal (creating events themselves) is v1-deferred except the locked-org create path — confirm scope: do org users exist as login users in this update, or admin-on-behalf only? (Design assumes membership-based lock is wired but UI ships admin-first.)
3. "Designation" filter = specialty, or a new designation field? (Design uses specialty.)
4. Should per-practitioner overrides also notify the committee, or practitioner only?
5. If the committee hasn't approved the rate book when the first entry arrives, do we (a) let the cloned previous-cycle rates stand (current plan), or (b) block submissions until approval?

## Design deliverables (for review in Figma)

| Frame | Base | Shows |
|---|---|---|
| U1-AU3 — Sign up + workplace | AU3 | Primary workplace combobox w/ create-inline |
| U1-EM1 — Create event + organizer | EM1 | Organizer combobox open, **Create "…"** row; org-user locked variant note |
| U1-FM5 — Rate book, draft + approval | FM5 | Editable rates (draft), committee "Approve rate book" bar, lock-on-first-entry note, cycle-selector dropdown (view past cycles' rate books), cycle-total strip |
| U1-FM6 — Cycle settings, editable | FM6 | Editable floors/total, calendar-year dates, 21:00 lock notice |
| U1-NT — Notifications dropdown | D-NT1 | `framework_changed` + `eligibility_adjusted` items |
| U1-PS1 — Practitioner scores list | UM1 | Columns, filters, search |
| U1-PS2 — Scores detail + adjust | UM2 | Breakdown, overrides panel, adjustment dialog w/ reason + evidence upload |
| U1-PF1 — Profile | PF2 | Photo upload, primary + other workplaces |
