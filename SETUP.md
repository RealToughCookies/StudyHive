# StudyHive - Desktop App Setup Guide

StudyHive is now a native desktop app using **Tauri** with local AI support via **Ollama**!

## Prerequisites

### 1. Install Rust (Required for building)
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

### 2. Install Node.js (if not installed)
```bash
# Download from https://nodejs.org/
# Or use Homebrew on macOS:
brew install node
```

### 3. Install Ollama (For FREE Local AI)
```bash
# macOS
curl -fsSL https://ollama.com/install.sh | sh

# Or download from https://ollama.com/download
```

## Building the App

### Step 1: Install Dependencies
```bash
cd /Users/nathanieleades/Dev/Pomodoro
npm install
```

### Step 2: Build the App
```bash
npm run build
```

The app will be built to:
- **macOS**: `src-tauri/target/release/bundle/macos/StudyHive.app`
- **Windows**: `src-tauri/target/release/bundle/msi/StudyHive_1.0.0_x64.msi`
- **Linux**: `src-tauri/target/release/bundle/appimage/StudyHive_1.0.0_amd64.AppImage`

### Step 3: Run in Development Mode (Optional)
```bash
npm run dev
```

## Setting Up AI (After First Launch)

### Option 1: Local AI with Ollama (Recommended - 100% Free)

1. **Start Ollama** (if not running):
   ```bash
   ollama serve
   ```

2. **Download a model** (first time only):
   ```bash
   # Recommended lightweight model (~3GB)
   ollama pull llama3

   # Or smaller model (~1.5GB)
   ollama pull phi3

   # Or best quality (~7GB)
   ollama pull mixtral
   ```

3. **In the app**:
   - Open Profile page
   - The app will auto-detect Ollama
   - Select your preferred model
   - Start generating quizzes!

### Option 2: Browser AI (Chrome/Edge only)

1. Use Chrome 127+ or Edge 127+
2. Enable in Profile settings
3. Works in the web version, not needed for desktop app

### Option 3: Claude API (Cloud-based)

1. Get API key from https://console.anthropic.com/
2. Enter in Profile settings
3. Costs ~$0.01-0.03 per quiz

## Features

### ✅ What You Get with Local AI (Ollama):
- **Zero cost** - runs entirely on your computer
- **Private** - your data never leaves your device
- **Offline** - works without internet
- **Smart quizzes** - AI generates contextual questions
- **Detailed feedback** - explains what you got wrong and why
- **Fast** - local processing

### 📊 Recommended Models:

| Model | Size | Speed | Quality | Use Case |
|-------|------|-------|---------|----------|
| `phi3` | 1.5GB | Fast | Good | Quick quizzes, older machines |
| `llama3` | 3GB | Medium | Very Good | **Recommended** for most users |
| `mixtral` | 7GB | Slower | Excellent | Best quality, powerful machines |

## Troubleshooting

### "Ollama not found"
```bash
# Check if Ollama is installed
which ollama

# If not found, install:
curl -fsSL https://ollama.com/install.sh | sh
```

### "Ollama not running"
```bash
# Start Ollama service
ollama serve

# In another terminal, test:
curl http://localhost:11434
```

### "Model not found"
```bash
# List installed models
ollama list

# Pull a model
ollama pull llama3
```

### Build fails on macOS
```bash
# Install Xcode Command Line Tools
xcode-select --install
```

## File Structure

```
StudyHive/
├── index.html              # Main app pages
├── quizzes.html
├── profile.html
├── script.js               # Frontend logic
├── quiz-engine.js
├── style.css
├── package.json            # Node dependencies
├── tauri.conf.json         # App configuration
└── src-tauri/              # Rust backend
    ├── Cargo.toml
    └── src/
        └── main.rs         # Ollama integration
```

## Usage

1. **Launch the app**
2. **Create a quiz**:
   - Go to Quizzes page
   - Enter your topic and notes
   - Click "Generate Quiz"
   - Answer questions
3. **Get AI feedback**:
   - Wrong answers get detailed explanations
   - Learn what you missed and why
   - See sample correct answers

## Benefits vs Web Version

| Feature | Desktop App | Web Version |
|---------|-------------|-------------|
| **Speed** | ⚡ Faster | Slower |
| **AI** | 🎯 Free Local AI | Limited/Paid API |
| **Privacy** | 🔒 100% Private | Depends on API |
| **Offline** | ✅ Yes | ❌ No (for AI) |
| **Size** | 📦 ~10MB | N/A |
| **Updates** | Manual | Auto |

## Next Steps

1. Build the app: `npm run build`
2. Install Ollama: `brew install ollama` or visit ollama.com
3. Pull a model: `ollama pull llama3`
4. Launch StudyHive
5. Start learning with AI-powered quizzes!

---

**Questions?** The app will guide you through setup on first launch with helpful error messages and setup instructions.
