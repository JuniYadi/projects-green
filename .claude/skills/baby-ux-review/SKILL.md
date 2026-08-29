---
name: baby-ux-review
description: "Use when performing a first-time user, beginner, or UX teardown review on any page or UI flow"
---

# First-Time User / Baby Review ("No-Shy" Teardown)

## Overview
A brutal, first-principles UI/UX critique method that evaluates pages through the eyes of a complete beginner or first-time customer with zero domain context. Eliminates internal developer bias, jargon blindness, and structural friction.

## Review Flow

1. **Open Target Page in Browser:**
   - Use `user_browser` (or `admin_browser`/`public_browser` depending on auth state).
   - Navigate to the route.
   - Take snapshot (`take_snapshot`) and screenshot (`take_screenshot`).

2. **Evaluate Through 6 Baby Friction Filters:**
   - **First 3-Second Rule (Title & Hero):** Is it developer jargon or clear value proposition? Can a 5-year-old grasp why they are here?
   - **Cognitive Dread Check:** Does the page open with walls of failure states, red errors, compliance bans, or complex flowcharts before showing the happy path / hello world?
   - **Visual Abstraction vs Reality:** Are UI examples presented as raw monospace text metadata dumps (e.g. `Header: [...]`, `Body: [...]`) instead of realistic visual components (e.g. green chat bubbles, styled mockups)?
   - **Information Density & Scannability:** Are navigation menus, sidebars, or tables filled with 15-word run-on sentences? Can someone scan headings in 5 seconds?
   - **Unnecessary Math & Mental Load:** Is the user forced to calculate rates, token multipliers, or formula matrices before trying the feature?
   - **Time-To-Action (Click Depth):** How far down is the first interactive step or "Create" action? Is the actual guide buried beneath essays?

3. **Output Format (No-Shy Teardown):**
   - **💥 Emotional & Immediate Reaction:** Brutally honest first impression.
   - **🚩 Identified Friction Points:** Bullet points with exact element references, quoting problematic text and explaining why it confuses a newcomer.
   - **🛠️ Actionable Prescription / Fix Checklist:** Prioritized concrete changes (What to delete, what to simplify, what visual components to introduce).
