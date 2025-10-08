# How to Check Browser Console (Developer Tools)

## On Chrome/Edge:

### Method 1: Keyboard Shortcut
- **Mac:** Press `Command + Option + J`
- **Windows/Linux:** Press `Ctrl + Shift + J`

### Method 2: Menu
1. Click the three dots (⋮) in top right corner
2. Click "More Tools"
3. Click "Developer Tools"
4. Click the "Console" tab

## On Firefox:

### Method 1: Keyboard Shortcut
- **Mac:** Press `Command + Option + K`
- **Windows/Linux:** Press `Ctrl + Shift + K`

### Method 2: Menu
1. Click the hamburger menu (≡) in top right
2. Click "More Tools"
3. Click "Web Developer Tools"
4. Click the "Console" tab

## What You'll See:

The console will show messages like:
```
🎯 Engine selected: RULES
🤖 LLM ready? false
📊 LLM status: {useWebLLM: false, useBrowserAI: false, useClaudeAPI: false, ready: false}
📝 Using Rules Engine to generate quiz
```

Or if AI is working:
```
🎯 Engine selected: LLM
🤖 LLM ready? true
📊 LLM status: {useWebLLM: true, useBrowserAI: false, useClaudeAPI: false, ready: true}
✨ Using LLM to generate quiz!
```

---

# But First - You Need to Enable AI!

Before the AI will work, you need to:

## Step 1: Go to Profile Page
- Navigate to http://localhost:5173/profile.html

## Step 2: Scroll to "AI Quiz Settings"
- You'll see three options:
  1. Browser Built-in AI
  2. **Web LLM (RECOMMENDED ⭐)** ← Use this one
  3. Claude API Key

## Step 3: Enable Web LLM
- Click the toggle next to "Use Web LLM"
- The toggle should turn blue/green

## Step 4: Download the Model
- After enabling, you'll see model options
- Keep "Phi-3 Mini (2.4GB) - Recommended" selected
- Click the big "Download Model" button
- Wait 2-5 minutes for the download (you'll see a progress bar)
- When done, you'll see "✓ Web LLM Ready - AI quizzes enabled!"

## Step 5: Generate a Quiz
- Now go to http://localhost:5173/quizzes.html
- Paste your photosynthesis notes
- Set topic and options
- Click "Generate Quiz"
- The quiz metadata will now say "Source: web-llm" instead of "Source: rules"

---

## Quick Test (Without Opening Console)

Look at the quiz metadata when it's generated. At the bottom of the quiz, it should show:

**Without AI:**
```
Source: rules
```

**With AI:**
```
Source: web-llm
```

You'll also notice the questions are WAY more intelligent and have detailed explanations when AI is enabled!
