<p align="center">
  <a href="https://github.com/bitesinbyte/leben-in-deutschland">
    <img src="https://raw.githubusercontent.com/bitesinbyte/leben-in-deutschland/refs/heads/main/src/web/public/android-chrome-512x512.png" width="256px" />
  </a>
</p>
<h1 align="center">Leben In Deutschland</h1>

<a href="https://play.google.com/store/apps/details?id=org.lebenindeutschland.app" target="_blank" rel="noopener noreferrer" style="border:none;text-decoration:none"><img src="https://www.niftybuttons.com/googleplay/googleplay-button8.png"></a>
<a href="https://www.lebenindeutschland.org/dashboard" 
  style="background-color: #152023; title: Continue on Web; color: #ffffff; font-family: Arial; font-size: 16px; letter-spacing: 2px; font-weight: normal; padding: 10px; border-radius: 5px; text-decoration: none; border: 1px solid #ffffff; background: linear-gradient(to right, #152023 5%, #d42b2b); box-shadow: 3px 3px 3px #000000;"
  onmouseover="this.style.backgroundColor='#559aaf';"
  onmouseout="this.style.backgroundColor='#152023';">Continue on Web</a>

About

We provide resources and tools to help individuals prepare for the Einbürgerungstest (Naturalization Test) and "Leben in Deutschland" exam. Our platform includes practice questions, study materials, and mock tests to improve success rates.

Non-Affiliation Disclaimer: We are not endorsed by, directly affiliated with, maintained, authorized, or sponsored by Bundesamt für Migration und Flüchtlinge (https://www.bamf.de). Our purpose is to give the community alternative ways to study and to be successful in the exam.

## Features

- Interactive mock tests
- Preparation materials
- Dashboard with statistics
- Find the location of the exam center
- Access to all 300 questions and state-related questions
- BAMF evaluation date tracking with historical timeseries

## Data Pipelines

### Sync Questions & Prüfstellen (every 15 days)

Scrapes all 300+ questions (with AI-powered translations to 7 languages), test center locations, and the current BAMF evaluation date. Runs via `npm run prod`.

### Check BAMF Evaluation Date (daily)

A lightweight daily pipeline that only checks which exam date BAMF is currently evaluating. When the date changes, it appends a new record to the timeseries in `data/current-evaluation.json`. This tracks how far behind BAMF's evaluation processing is over time. Runs via `npm run check-evaluation`.

## Data Files

| File | Description |
|---|---|
| `data/question.json` | All questions with translations, categories, and AI-generated context |
| `data/prüfstellen.json` | Test center locations for all 16 German states |
| `data/current-evaluation.json` | Current BAMF evaluation date + historical timeseries |
