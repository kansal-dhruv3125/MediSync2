# 💊 MediSync — Medication Dosage & Interaction Scheduler

MediSync is a web-based medication management application designed to help users organize their daily medicines, manage dosage schedules, and identify potentially unsafe medication combinations based on predefined interaction rules.

The project provides a simple and user-friendly interface for adding medications, creating schedules, managing saved medicines, and checking medication interactions.

> ⚠️ **Disclaimer:** MediSync is an educational project and is not a replacement for professional medical advice. Users should consult a qualified healthcare professional before making changes to their medication schedule.

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Problem Statement](#-problem-statement)
- [Objectives](#-objectives)
- [Key Features](#-key-features)
- [Technology Stack](#-technology-stack)
- [Project Structure](#-project-structure)
- [How the Application Works](#-how-the-application-works)
- [Authentication](#-authentication)
- [Medication Management](#-medication-management)
- [Schedule Generation](#-schedule-generation)
- [Drug Interaction Detection](#-drug-interaction-detection)
- [Data Storage](#-data-storage)
- [Validation](#-validation)
- [Installation & Setup](#-installation--setup)
- [How to Run](#-how-to-run)
- [Team Members](#-team-members)
- [Future Improvements](#-future-improvements)
- [Limitations](#-limitations)
- [Disclaimer](#-disclaimer)

---

## 🔎 Overview

MediSync helps users manage their medication schedules through a web interface.

The application allows users to:

- Create an account and log in
- Add medications
- Specify dosage information
- Select medication frequency
- Select preferred medication times
- View saved medications
- Edit medication information
- Delete medications
- Generate today's medication schedule
- Detect potential medication conflicts
- View interaction messages based on predefined rules
- Persist user data using browser `localStorage`

The application is implemented using **HTML, CSS and Vanilla JavaScript** without requiring React or another frontend framework.

---

## 🎯 Problem Statement

Managing multiple medications can become difficult when users have different medicines, dosages, frequencies and timings.

Taking medications too close together can also create potential interaction or spacing problems.

MediSync attempts to solve this problem by providing a centralized interface where users can:

1. Store their medication information.
2. Organize medication timings.
3. Generate a chronological daily schedule.
4. Detect possible conflicts between scheduled medications.
5. Receive understandable interaction messages.

---

## 🎯 Objectives

The main objectives of MediSync are:

- Create an easy-to-use medication scheduling interface.
- Reduce confusion when managing multiple medications.
- Automatically generate a daily medication schedule.
- Detect potential conflicts using predefined interaction rules.
- Provide client-side validation.
- Maintain medication data between browser sessions.
- Implement a simple authentication flow.
- Build the project using fundamental web technologies.

---

# ✨ Key Features

### 👤 User Authentication

- Sign-up page
- Login page
- User-specific session handling
- Basic authentication using browser storage

### 💊 Medication Management

Users can:

- Add a medication
- Enter medicine name
- Enter dosage
- Select frequency
- Select preferred time
- Edit existing medication
- Delete medication

### 🕐 Daily Schedule

The application generates a schedule using the user's medication information.

The schedule:

- Collects preferred medication times
- Converts them into scheduled entries
- Sorts entries chronologically
- Displays medications according to their scheduled time

### ⚠️ Interaction Detection

MediSync checks scheduled medications against predefined interaction rules.

The system compares:

- Medication names
- Scheduled times
- Required spacing
- Actual spacing

If a possible conflict is detected, an appropriate warning message is displayed.

### 💾 Persistent Storage

Medication information is stored in the browser's `localStorage`.

This allows data to remain available after refreshing or reopening the webpage in the same browser.

---

# 🛠 Technology Stack

| Technology | Purpose |
|---|---|
| HTML5 | Structure of web pages |
| CSS3 | Styling and responsive UI |
| JavaScript | Application logic and DOM manipulation |
| JSON | Stores predefined medication interaction rules |
| LocalStorage | Client-side data persistence |
| Git | Version control |
| GitHub | Source code hosting and collaboration |

### Frontend Architecture

```text
HTML
 │
 ├── Forms
 ├── Navigation
 └── Page Structure
       │
       ▼
JavaScript
 │
 ├── Authentication
 ├── Validation
 ├── Medication Management
 ├── Schedule Generation
 ├── Conflict Detection
 └── DOM Updates
       │
       ▼
Browser Storage
 │
 └── localStorage
