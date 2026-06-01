# Student Resume Intelligence Platform

AI-powered resume analysis for students — upload a PDF, set a target role, and get a full career intelligence report.

## Features

- **ATS Score** — how well your resume passes applicant tracking systems
- **Job Match Score** — fit for your target role
- **Keyword Gap Analysis** — missing vs. present keywords and recommendations
- **Skill Gap Analysis** — current skills, gaps, and what to learn next
- **Resume Rewrite Suggestions** — before/after bullet improvements
- **Project Recommendations** — portfolio ideas to close skill gaps
- **Interview Question Generator** — role-specific questions with answer tips

## Setup

1. Copy `.env.example` to `.env` and set `GEMINI_API_KEY` from [Google AI Studio](https://aistudio.google.com/apikey).
2. Install and run:

```bash
npm install
npm start
```

3. Open **http://localhost:3000** in your browser.

## Usage

1. Enter your **target role** (required), e.g. `Software Engineer Intern`
2. Optionally paste a **job description** for better keyword and match analysis
3. Upload your **PDF resume**
4. Click **Generate Intelligence Report**

## API

### `POST /api/analyze`

**Form fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `resume` | Yes | PDF file |
| `targetRole` | Yes | Target job title |
| `jobDescription` | No | Job posting text |

**Response:** Full intelligence report JSON with all seven feature sections.

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | — | Required |
| `PORT` | `3000` | Server port |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Primary model; app auto-retries and falls back if busy |
| `MAX_FILE_SIZE_MB` | `5` | Max upload size |
