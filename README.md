# AetherStudy — Premium Study Planner & Focus Dashboard

AetherStudy is a high-end, responsive, single-page dashboard application designed to help students organize daily schedules, maximize focus, and optimize memory retention through active recall.

Featuring a **glassmorphic dark/light UI**, interactive animations, and a gamified experience system, it transforms studying from a chore into a rewarding habit.

---

## 🌟 Key Features

### 📅 1. Study Planner & Task Manager
- **Full Task Lifecycle (CRUD)**: Add, edit, prioritize, categorize, and complete tasks.
- **Daily Hourly Blocks**: Pin and schedule your tasks into 1-hour slots from 8:00 AM to 8:00 PM.
- **Category Tags**: Sort tasks by categories like *Study, Coding, Reading, Language, and Others*.
- **Priority Weights**: Color-coded badges for High, Medium, and Low priorities.

### ⏱️ 2. Pomodoro Focus Timer
- **Cycle Modes**: Toggle between Work (25m), Short Break (5m), and Long Break (15m).
- **SVG Radial Progress Ring**: Smoothly draining radial border matching countdown progression.
- **Task Linkage**: Link any active task from your planner to work on, with a quick-completion checkbox on the timer interface.
- **Focus Analytics**: Tracks daily completed focus cycles and total focus time.

### 🎴 3. Spaced-Repetition Flashcards
- **Decks Library**: Organize card decks by topics.
- **3D Card Flip**: Highly fluid 3D flip card animations to test questions and answers.
- **Self-Grading Progression**: Rate cards as *Easy (Mastered)* or *Hard (Study Again)* to track overall deck mastery percentages.

### 🧠 4. Quiz Hub & Active Recall Reminders
- **Custom Quiz Creator**: Add MCQ (Multiple Choice) or short text questions.
- **Test Mode**: Take practice tests with shuffle support and complete score breakdown boards.
- **Active Recall Alerts**: Set a periodic background timer (e.g. every 15 minutes) that prompts you with a random quiz or flashcard question to build stronger memory pathways.

### 🔔 5. Audio Synthesizer & Notifications
- **Web Audio API**: Programmatically synthesizes bell chimes and chime notifications (offline friendly, no file hosting required).
- **Desktop Alerts**: Prompts for HTML5 Browser Notifications to deliver alerts even if the app tab is running in the background.

---

## 🎮 Gamification Mechanics

AetherStudy incentivizes consistent study habits by rewarding users with XP and levels:
- **Task Completion**: `+20 XP`
- **Focus Cycle Finished**: `+15 XP`
- **Active Recall Popups**: Answer correctly to earn `+15 XP`
- **Quiz Performance**: `+3 XP` per correct answer, with a `+20 XP` bonus for passing with a score above 80%.
- **Daily Streak Tracker**: Tracks consecutive days studied.

---

## 🛠️ Technology Stack
- **Structure**: Semantic HTML5
- **Styling**: Vanilla CSS3 (Custom properties, CSS grid, 3D card flips, glassmorphic filters)
- **Logic**: Modular Vanilla JavaScript (Namespace patterns for zero CORS security restrictions)
- **Iconography**: [Lucide Icons](https://lucide.dev/) (CDN)
- **Assets**: 100% programmatically synthesized Web Audio alerts (zero asset dependencies)

---

## 🚀 Quick Start

### Option A: Local File System (Offline)
Since AetherStudy uses a robust modular namespace architecture instead of ES Modules, you can run it **without running a server**:
1. Clone or download the files.
2. Double-click [index.html](file:///e:/Capstone%20project/index.html) to open the dashboard immediately in any modern web browser.

### Option B: Local HTTP Server (Recommended)
If you want to run it over a local server:
```bash
# Using Node.js http-server
npx http-server -p 8080

# Or run with Python
python -m http.server 8080
```
Then visit `http://localhost:8080` in your web browser.
