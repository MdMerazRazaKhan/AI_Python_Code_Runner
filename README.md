# AI-Powered Python Code Runner

A modern full-stack web application that allows users to interact with an AI agent to generate Python code, view and edit it in a professional Monaco-based editor, and execute it securely in a sandboxed environment.

## 🚀 Key Features

- **AI Code Generation**: Prompt a Gemini model directly to generate fully functional Python scripts along with explanations.
- **Professional Code Editor**: High-fidelity editor powered by Monaco Editor (the core engine of VS Code), featuring autocomplete, search, line numbers, syntax highlighting, and themes.
- **Secure Sandboxed Execution**:
  - **Docker Engine (Primary)**: Spawns a networkless, memory-limited (`128MB`), and CPU-limited (`0.5 cores`) `python:3.13-slim` container to run code safely in isolation.
  - **Subprocess Engine (Fallback)**: Spawns a local python child process restricted via standard input feeding, strict execution timeouts (`5 seconds`), and process watchdog termination if Docker is unavailable.
- **Interactive Output Console**: Retro terminal style with colorized standard output (`stdout`), standard error (`stderr`), performance logs (execution time in milliseconds), and state badges.
- **Run History**: Local database file logging previous runs. Users can reload previous scripts, view outputs, delete specific records, or clear all history.
- **Vibrant Modern UI**: Features responsive flex grid panels, glassmorphism card controls, smooth animations, and a seamless dark/light theme toggler.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 19 + Vite
- **Code Editor**: `@monaco-editor/react`
- **Iconography**: `lucide-react`
- **Styling**: Vanilla CSS (CSS Variables, theme configurations, keyframe animations)

### Backend
- **Framework**: Node.js + Express
- **AI Integration**: `@google/generative-ai` (Gemini 2.5 Flash)
- **Environment Management**: `dotenv`
- **Database**: Local JSON file storage (`backend/data/history.json`) with asynchronous atomic operations

---

## ⚙️ Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [Python 3](https://www.python.org/) (for local fallback execution)
- [Docker](https://www.docker.com/) (optional, but recommended for complete execution sandboxing)

### 1. Setup Backend
1. Navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `backend/` directory:
   ```env
   PORT=5000
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
   *Note: You can get a free API key from [Google AI Studio](https://aistudio.google.com/).*

4. Start the server:
   ```bash
   npm run dev
   ```
   The backend will run on `http://localhost:5000`.

### 2. Setup Frontend
1. In a new terminal window, navigate to the frontend folder:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

---

## 🔒 Security Sandboxing Architecture

To protect the server from infinite loops, memory exhaustion, and system-level exploits, code execution utilizes multiple defensive layers:

```
User Code ──> Express API ──> Validation Check (size & type)
                                     │
                    ┌────────────────┴────────────────┐
                    ▼ (Docker Available?)             ▼ (No Docker Fallback)
           [ Docker Container ]             [ Subprocess Guard ]
         - Network disabled (--network none) - stdin piping
         - Memory capped (--memory 128m)     - 5s Watchdog process.kill()
         - CPU restricted (--cpus 0.5)       - Local runtime env warnings
         - Auto-cleanup (--rm)
```

1. **Size Limits**: Payloads exceeding `64KB` are rejected during validation.
2. **Resource Throttling**: Docker containers are started without network access and with hard-capped memory limits.
3. **Execution Guard**: A background thread timer watchdog kills any hanging scripts after 5 seconds, ensuring the host server remains responsive.
