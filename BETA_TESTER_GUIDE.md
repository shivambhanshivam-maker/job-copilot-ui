# Job Co-Pilot — Beta Tester Guide

Thank you for testing Job Co-Pilot! This document gives you a full overview of the app, what it does, how to use it, and what to look out for as a tester.

---

## What is Job Co-Pilot?

Job hunting is exhausting. Between tailoring your CV for each role, tracking dozens of applications, decoding recruiter emails, and trying to figure out why you're not getting callbacks — it's a full-time job in itself.

**Job Co-Pilot** is an AI-powered job search assistant that helps you:

- **Understand how well your CV matches a job** before you apply, so you can fix gaps proactively
- **Track all your job applications** in one place — status, documents, and AI-powered fit scores
- **Automatically capture job updates from your Gmail** — interview invites, rejections, offers — without any manual logging
- **Analyse your job search performance** through a visual analytics dashboard

The goal is simple: fewer wasted applications, more informed decisions, and less anxiety about the job hunt.

---

## Getting Started

1. Sign up for an account at the app URL
2. Connect your Gmail account when prompted (see Gmail Integration below)
3. Upload your CV
4. Start tracking applications or run a CV fit analysis

---

## Feature Walkthrough

---

### Feature 1 — CV / JD Fit Analysis

**Where:** Home page (the first screen after login)

**What it does:**

This is the core intelligence of the app. You provide your CV and a job description, and the AI returns a detailed breakdown of how well you match the role — before you even apply.

**How to use it:**

1. **Select your CV** from the dropdown at the top left. If you haven't uploaded one yet, click "Upload new CV" from the dropdown and select a PDF, Word, or text file.
2. **Enter the Job Title and Company Name** in the two fields on the right panel.
3. **Paste the full job description** into the text area below those fields.
4. Click **Analyse**.

Results stream in progressively — you'll start seeing data within a few seconds.

**What you get:**

| Section | What it tells you |
|---|---|
| **Overall Fit Score** | A 0–100 score. ≥80 = Strong Fit, ≥70 = Good Fit, ≥60 = Moderate Fit, <60 = Weak Fit |
| **Recommendation** | Apply / Optimize & Apply / Skip — based on your score and gaps |
| **Score Breakdown** | Sub-scores across Skills, Experience, Domain, Impact, and CV Presentation — each weighted by the AI based on what matters for that role |
| **Core Strengths** | Specific things in your CV that align well with this JD |
| **Skill Gaps** | What the JD requires that your CV is missing, ranked by severity (High / Medium / Low) |
| **What Makes You Stand Out** | Differentiators the AI identified that could set you apart from other applicants |
| **Strategic Positioning** | How you should frame yourself when applying for this role |
| **CV Adjustments** | Concrete edits recommended for your CV to improve your fit, prioritised by impact |

**Things to test:**
- Try with a JD that's a strong match and one that's a weak match — does the score feel accurate?
- Does the streaming feel smooth, or does it stall?
- Are the CV Adjustments and Skill Gaps actionable and relevant?
- Try uploading different CV formats (PDF, DOCX, TXT)

---

### Feature 2 — Job Application Dashboard

**Where:** "Applications" in the sidebar

**What it does:**

A live tracker for every job you've applied to (or plan to apply to). Think of it as a smart spreadsheet that knows about your documents and your fit scores.

**How to use it:**

- Click **+ Add Application** to log a new job manually
- Each row in the table represents one application. You can:
  - **Click the status pill** to update the application status (e.g. Applied → Interview Scheduled → Offer)
  - **Click the category badge** to assign a role category (e.g. Engineering, Product, Design)
  - **Set a CV and JD** on each application via the Documents column — these are used for per-application fit analysis
  - **Click the fit score badge** to view a detailed AI fit analysis specific to that application (same depth as Feature 1)
  - **Click "Run"** to generate or re-run a fit analysis for that application

**Status types:**
- Bookmarked → Applied → CV Screening → Interview Scheduled → Final Round → Offer Received → Accepted / Rejected / Withdrawn

**Fit Score on the Dashboard:**
- Once a CV and JD are set on an application, a fit score can be generated
- The score is marked **stale** (re-run prompted) only when the CV or JD changes — not when you update the status or other fields
- Clicking the score opens a full insight modal with the same breakdown as Feature 1

**Things to test:**
- Add a few applications and move them through different statuses
- Set a CV and JD on an application and run the fit analysis — does the modal open and stream correctly?
- After the analysis is done, change the status — does the fit score correctly stay (not go stale)?
- After the analysis is done, change the JD — does it correctly prompt a re-run?
- Does the table sort correctly by Company, Category, and Status?

---

### Feature 2b — Gmail Integration

**Where:** Prompted on the Home page; also works automatically in the background once connected

**What it does:**

Job Co-Pilot connects to your Gmail (read-only) and automatically scans incoming emails to detect job-related updates. When it finds one, it:

- Identifies the company and role from the email
- Classifies the email type (application confirmation, interview invite, rejection, offer, etc.)
- Automatically creates or updates the matching application in your dashboard

This means your dashboard stays up to date without you manually logging every recruiter email.

**How to connect:**

1. On the Home page, if Gmail is not connected, you'll see a "Connect Gmail" prompt in the centre panel
2. Click **Connect Gmail** — you'll be redirected to Google's OAuth consent screen
3. Grant read-only access
4. You'll be redirected back to the app — Gmail is now active

**What gets detected:**
- Application confirmation emails
- Interview invitations (including date and time extraction)
- Rejection emails
- Offer letters
- Follow-up and referral signals

**Things to test:**
- Connect Gmail and check if existing job emails are picked up
- Send yourself a mock "interview invite" email and see if the app detects and logs it
- Does the status update on the dashboard match what the email actually said?
- Does it pick up emails from different recruiter formats (LinkedIn, Greenhouse, Workday, direct recruiter)?

---

### Feature 3 — Analytics

**Where:** "Analytics" in the sidebar

**What it does:**

A high-level view of how your job search is performing — across your entire history and over the last 30 days.

**What's on the page:**

**Funnel Conversion**
- Tracks how many of your applications convert at each stage:
  - Applied → Interview rate
  - Interview → Offer rate
- Shows both **Last 30 days** and **All-time** rates side by side
- Filter by job category (e.g. only see Engineering roles) if you have multiple categories tracked

**Response Rate**
- What percentage of applications you've submitted have received any response
- Shown as Last 30 days vs. All-time

**Things to test:**
- Do the numbers feel accurate compared to your actual applications?
- Does the category filter change the funnel correctly?
- If you have very few applications, does the page handle it gracefully (no divide-by-zero errors, no broken UI)?

---

## Known Limitations (as of this beta)

- Gmail integration scans new incoming emails — it does not retroactively import your full email history on first connect
- CV fit analysis works best with clearly structured job descriptions; very short or vague JDs may produce lower-confidence results
- The app currently supports English-language CVs and JDs only
- Mobile layout is not optimised — please test on desktop

---

## How to Report Bugs & Suggestions

Please note down the following for any bug you find:

1. **What you were doing** (which feature, what action you took)
2. **What you expected to happen**
3. **What actually happened** (screenshot if possible)
4. **Your browser** (Chrome / Firefox / Safari / Edge)

For suggestions, just describe the problem you felt — you don't need to propose a solution.

You can share feedback directly with [your name/contact here].

---

*Thank you for helping make Job Co-Pilot better.*
