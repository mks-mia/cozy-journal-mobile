# Lamplit

**A personal space to organize, reflect, and grow.**

Lamplit is a personal journaling and productivity web application designed to help users organize their daily lives, reflect on their experiences, build meaningful habits, and stay connected with their personal goals.

The application brings together journaling, task management, habit tracking, AI-powered conversations, and reminders in one place.

Rather than being just another productivity tool, Lamplit aims to create a calm and personal digital space where productivity and self-reflection can coexist.

**Live Demo:** https://cozy-journal-mobile.vercel.app/

---

## Project Vision

The idea behind Lamplit is to create an application that supports both productivity and personal well-being.

Users should be able to:
- Record their daily thoughts, experiences, and memories.
- Organize tasks and manage everyday responsibilities.
- Track habits and monitor personal progress.
- Reflect on their activities and review their progress over time.
- Have conversations with an AI companion.
- Receive gentle reminders to stay on track.
- Access their personal information across multiple devices.

The long-term goal is to evolve Lamplit into a reliable, cross-device personal companion with a simple, intuitive, and comfortable user experience.

---

## Features & Current Progress

### 1. Authentication & User Accounts
**Status: Completed**

- User registration and login.
- Email and password authentication.
- Supabase authentication and session management.
- Protected application access for authenticated users.
- User-specific account information.
- Persistent authentication sessions.

### 2. Diary Pages
**Status: Cloud synchronization implemented**

- Create and manage personal diary entries.
- Store personal thoughts and daily experiences.
- Retrieve diary entries from Supabase.
- Synchronize diary information across browsers and devices.

### 3. Daily Logs
**Status: Cloud synchronization implemented**

- Record daily activities and experiences.
- Maintain personal daily records.
- Synchronize information through Supabase.

### 4. Tasks
**Status: Cloud synchronization completed and tested**

- Create new tasks.
- Mark tasks as completed.
- Delete existing tasks.
- Set task deadlines.
- Synchronize task changes across browsers using Supabase Realtime.

### 5. Tracked Actions
**Status: Cloud synchronization completed and tested**

- Create personal tracked actions.
- Track daily progress.
- Increase or decrease daily progress.
- Review weekly progress history.
- Delete tracked actions.
- Synchronize tracker information and progress across browsers.
- Migrate existing local tracker data to Supabase.

### 6. Friend Chat — AI Companion
**Status: Implemented with cloud persistence**

- AI-powered conversational interface.
- Create new chat sessions.
- Switch between conversations.
- Delete chat sessions.
- Save and retrieve conversation history through Supabase.
- Synchronize mindfulness message timestamps.
- Prevent repeated mindfulness messages within the two-week interval.

### 7. Reminders & Notifications
**Status: Partially implemented**

- Enable or disable reminders through Settings.
- Reminder preferences are stored locally on each device.
- Existing reminder banner functionality.
- Task deadline reminders.
- Mindfulness reminders on a separate schedule.

Further development is needed to improve notification reliability and support different browsing environments, including Safari and installed iPhone experiences.

### 8. Statistics Dashboard
**Status: Existing feature**

Provides a place to review personal activity and progress.

Further development can expand the dashboard with more meaningful insights from diary entries, tasks, and tracked actions.

### 9. Settings
**Status: Implemented**

- Manage reminder preferences.
- Account-related settings.
- Application configuration and user preferences.

---

## Technology Stack

| Technology | Purpose |
|---|---|
| React | Frontend application |
| TypeScript | Type safety and application logic |
| Vite | Development environment and build tool |
| Tailwind CSS | Interface styling |
| Supabase | Authentication, database, and real-time synchronization |
| Groq API | AI-powered conversational functionality |
| Vercel | Application deployment |
| Git & GitHub | Version control and source code management |

---

## Architecture

Lamplit uses a frontend application connected to Supabase for authentication, persistent data storage, and real-time updates.

**Application structure:**

- Frontend: React + TypeScript
- Authentication: Supabase Auth
- Database: Supabase PostgreSQL
- Real-time updates: Supabase Realtime
- AI integration: Groq API
- Hosting: Vercel

User-specific information is associated with authenticated accounts. Row Level Security (RLS) policies help ensure that users can access only their own protected data.

The application also retains selected local storage functionality for device-specific preferences and compatibility with existing user data.

---

## Development Roadmap

The following roadmap represents the intended direction of future development. Some items are improvements to existing functionality, while others are longer-term goals.

### Phase 1 — Complete Existing Functionality

- [x] Implement Supabase authentication.
- [x] Implement persistent AI chat sessions.
- [x] Synchronize diary pages.
- [x] Synchronize daily logs.
- [x] Synchronize tracked actions and daily progress.
- [x] Synchronize tasks.
- [x] Implement mindfulness timestamp synchronization.
- [x] Add reminder controls in Settings.
- [ ] Fix the desktop Safari task deadline picker.
- [ ] Improve reminder behavior across different browsers and devices.
- [ ] Test reminder functionality on the installed iPhone experience.

### Phase 2 — Improve Reminders & Notifications

- Improve task deadline notifications.
- Make reminder preferences consistent with the user's intended settings.
- Improve notification reliability when the application is not actively open.
- Investigate browser push notifications and service worker support.
- Improve compatibility with Safari and iOS home-screen installations.
- Allow users to customize their reminder preferences and schedules.

### Phase 3 — Improve the AI Companion

- Improve the AI conversational experience.
- Make the AI companion more context-aware.
- Explore connecting conversations with daily reflections and personal activities.
- Improve mindfulness messages and their scheduling.
- Explore personalized reflection prompts.

### Phase 4 — Enhance Personal Insights

- Expand the statistics dashboard.
- Provide more meaningful weekly and monthly progress summaries.
- Explore visual representations of habit consistency.
- Connect task completion and tracked actions with personal progress insights.
- Explore journaling trends and reflection summaries.

### Phase 5 — User Experience & Accessibility

- Refine the interface across desktop, tablet, and mobile.
- Improve the installed iPhone experience.
- Improve application performance and loading behavior.
- Review accessibility and responsive design.
- Refine onboarding and account management.

### Phase 6 — Long-Term Vision

Explore additional capabilities that support Lamplit's goal of becoming a personal digital companion:

- Personalized daily planning.
- Intelligent task and habit suggestions.
- AI-assisted journaling and reflection.
- More comprehensive personal progress insights.
- A more integrated experience between journaling, productivity, and mindfulness.

These are longer-term possibilities rather than currently implemented features.

---

## Development & Setup

### Prerequisites

- Node.js
- npm
- A Supabase project
- Required API credentials for enabled integrations

### Installation

1. Clone the repository:

   ```bash
   git clone <YOUR_REPOSITORY_URL>
   ```

2. Navigate to the project directory:

   ```bash
   cd cozy-journal-mobile
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Configure the required environment variables for Supabase and other integrations.

5. Start the development server:

   ```bash
   npm run dev
   ```

6. Open the local development URL provided by Vite.

**Note:** Keep API keys and other sensitive credentials in environment variables. Never commit private API keys to GitHub.

---

## Deployment

Lamplit is deployed through Vercel and connected to its GitHub repository.

The application can be updated through the existing Git workflow, with changes developed on feature branches and merged into the main branch after review.

**Production:** https://cozy-journal-mobile.vercel.app/

---

### Progressive Web Application (PWA)

**Status: PWA experience in development**

Lamplit is designed as a Progressive Web Application (PWA), allowing users to access the application through a web browser and install it on supported devices.

The goal is to provide an app-like experience without requiring users to download Lamplit from a traditional app store.

Planned and ongoing improvements include:
- Installable experience on desktop and mobile devices.
- Support for adding Lamplit to the iPhone Home Screen.
- Responsive layouts across different screen sizes.
- Improved application accessibility and loading performance.
- Exploration of service workers and offline capabilities.
- Reliable notifications and reminders, including when the application is not actively open, where supported by the platform.

---

## Project Status

**Current development stage: Feature integration and refinement**

As of November 20, 2026, Lamplit has progressed from a local application into an authenticated application with Supabase-backed data persistence and cross-browser synchronization for its main productivity features.

The primary focus is now improving the reliability of existing features, especially reminders and browser compatibility, before expanding the application's functionality.

---

## About

Lamplit is an independently developed project focused on combining personal journaling, productivity, mindfulness, and AI-assisted experiences into one application.

The project is continuously evolving through hands-on development, testing, and improvements to its architecture and user experience.

**Built with React, TypeScript, and Supabase.**
