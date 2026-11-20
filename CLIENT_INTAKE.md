# New Client Intake — Lead Qualification CRM

Fill this in (or send it to the client) and hand it to Claude with:
**"Set up the CRM for a new client"** + the answers below.
Anything marked *(optional)* can be left blank and a sensible default is used.

---

## 1. Business basics
1. **Business name** — exactly as it should appear (e.g. "Maya Patel Coaching").
2. **One-line tagline** — shown under the name (e.g. "Career coaching for mid-career women in tech").
3. **What the business does** — 2–4 sentences: what they offer, who they help, what a great client looks like. *(The AI uses this to sort leads.)*
4. **Website** *(optional)*.
5. **Who owns new leads and signs emails** — a name or role (e.g. "Maya Patel" or "Client Success Team").

## 2. Branding
6. **Main brand colour** — a hex code like `#1B4332`. It must be dark enough for white text on buttons; if it's too light, Claude will pick a darker shade of the same colour.

## 3. Links
7. **Booking link** — Calendly / Cal.com / TidyCal link for discovery calls.
8. **Privacy policy URL** *(optional, recommended)*.

## 4. Services (up to 4)
For each service they sell:
- **Name** (short, e.g. "1:1 Coaching")
- **How it should read on the form** (e.g. "Private 1:1 coaching")
- **What it is** (one sentence)
- **Who it's for** (one sentence)
- **Kind of offer** — pick one per slot: individual/1:1 · group/course/cohort · company/team (B2B) · speaking/events/workshops

## 5. Inquiry form wording
9. **Form heading** (e.g. "Work With Maya").
10. **Intro under the heading** (1–2 sentences).
11. **Main question** visitors answer (e.g. "What's your biggest career challenge right now?").
12. **Example answer** shown faintly in that box.
13. **"Your role" options** *(optional)* — 3 labels (default: Manager · Founder / Executive · HR / L&D) plus "Other".
14. **Organization / team-size wording** *(optional)* — e.g. "Company" and "employees", or keep defaults.
15. **Thank-you message** after submitting *(optional)*.

## 6. Inside the CRM
16. **What to call the lead's main need** (e.g. "Career Challenge", "Project Goal"). If not given, Claude derives it from the main form question.
17. **Pipeline name** *(optional, default "Pipeline")*.

## 7. Emails *(optional)*
18. **Follow-up email per service** — subject + body. If skipped, a polite follow-up with the booking link is generated for each service. You can use: `{{lead_name}}`, `{{organization}}`, `{{business_name}}`, `{{owner_label}}`, `{{booking_url}}`, `{{route_label}}`.

## 8. Accounts & deployment (needed to go live)
19. **Operator login email(s)** — who will log in to the CRM (passwords are typed by them, never sent).
20. **Email sending domain** — e.g. `hello@mayapatel.com`, plus access to add DNS records in Resend.
21. **Reply-to address** for lead replies.
22. **Database** — a Supabase project (Claude will tell you what to copy).
23. **Hosting** — Vercel project name / custom domain (e.g. `inquire.mayapatel.com`).
24. **AI qualification** *(optional)* — OpenRouter key, or use the built-in rule-based qualifier.
