# StudyHive - Browser App Setup (With FREE AI!)

🎉 **Browser-based = Better AI options!** No downloads, no API keys needed.

## **3 Ways to Get AI Quizzes (All Free!)**

### **🚀 Option 1: Web LLM (RECOMMENDED)**
Run powerful AI models **directly in your browser** using WebGPU.

**What you get:**
- ✅ 100% FREE
- ✅ Runs in browser (no installation)
- ✅ Private (data never leaves your device)
- ✅ Works offline after download
- ✅ Powerful models (Phi-3, Llama 3, Mistral)

**Requirements:**
- Modern browser with WebGPU:
  - Chrome 113+
  - Edge 113+
  - Firefox 121+ (enable in about:config)

**Setup:**
```bash
# 1. Install dependencies
npm install

# 2. Start dev server
npm run dev

# 3. Open http://localhost:5173
# 4. Go to Profile → Enable Web LLM
# 5. Click "Download Model" (one-time, ~2-5GB)
# 6. Start generating quizzes!
```

**Available Models:**

| Model | Size | Speed | Quality | Best For |
|-------|------|-------|---------|----------|
| **Phi-3 Mini** | 2.4GB | ⚡⚡⚡ | ⭐⭐⭐⭐ | **Recommended** - Great balance |
| TinyLlama | 655MB | ⚡⚡⚡⚡⚡ | ⭐⭐⭐ | Slower devices, quick quizzes |
| Llama 3 8B | 4.9GB | ⚡⚡ | ⭐⭐⭐⭐⭐ | Best quality, powerful devices |
| Mistral 7B | 4.2GB | ⚡⚡ | ⭐⭐⭐⭐⭐ | Best quality, powerful devices |

---

### **Option 2: Chrome Built-in AI**
Uses Google's Gemini Nano built into Chrome.

**Setup:**
1. Use Chrome 127+
2. Go to `chrome://flags`
3. Enable "Optimization Guide On Device Model"
4. Restart Chrome
5. Profile → Toggle "Browser AI"

**Pros:**
- Even easier than Web LLM
- Smaller model (~1GB)
- Built into Chrome

**Cons:**
- Chrome only
- Less powerful than Web LLM
- Experimental feature

---

### **Option 3: Rules Engine (No AI)**
Smart rule-based system (what you have now).

**Good for:**
- Quick setup (no download)
- Older devices
- When AI is overkill

---

## **Quick Start**

```bash
# Install
npm install

# Run dev server
npm run dev

# Build for production
npm run build
```

### **Development:**
Visit `http://localhost:5173`

### **Production:**
Deploy the `dist/` folder to:
- **Netlify** (easiest)
- **Vercel**
- **GitHub Pages**
- **Cloudflare Pages**

---

## **Why Web LLM is Amazing:**

### **Comparison:**

| Feature | Web LLM | Cloud API | Desktop App |
|---------|---------|-----------|-------------|
| **Cost** | FREE | ~$0.02/quiz | FREE (but complex) |
| **Privacy** | 100% Private | Sends to cloud | Private |
| **Setup** | One click | API key | Install Rust, Ollama |
| **Offline** | ✅ Yes | ❌ No | ✅ Yes |
| **Quality** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Speed** | Fast | Fast | Fast |
| **Cross-platform** | ✅ Any browser | ✅ Yes | ❌ OS-specific |

---

## **Deploying to Web**

### **Deploy to Netlify (Free hosting):**

```bash
# Build
npm run build

# Deploy
# Drag the `dist/` folder to netlify.com/drop
```

### **Or use CLI:**
```bash
npm install -g netlify-cli
netlify deploy --prod
```

Your app will be live at `https://your-app.netlify.app`

---

## **How It Works**

### **Web LLM Magic:**
1. Downloads AI model to browser cache (one-time)
2. Runs model using WebGPU (your graphics card)
3. Generates quizzes locally
4. Never sends data to any server

### **What students get:**
- Intelligent quiz questions from their notes
- Detailed AI explanations for wrong answers
- Constructive feedback on short answers
- Personalized learning suggestions

---

## **File Structure**

```
studyhive/
├── index.html              # Main pages
├── quizzes.html
├── profile.html
├── script.js               # Main logic
├── web-llm-bridge.js       # Web LLM integration (NEW!)
├── quiz-engine.js          # Quiz logic
├── style.css
├── package.json
├── vite.config.js          # Build config
└── dist/                   # Built files (after npm run build)
```

---

## **Troubleshooting**

### **"WebGPU not supported"**
- Update your browser to latest version
- Chrome/Edge 113+ required
- Firefox: enable in `about:config` → `dom.webgpu.enabled`

### **Model download stuck**
- Check internet connection
- Clear browser cache
- Try a smaller model (TinyLlama)

### **Slow performance**
- Use TinyLlama or Phi-3 Mini
- Close other tabs
- Check GPU is being used (browser DevTools → Performance)

### **Out of memory**
- Use smaller model
- Close other apps
- 8GB+ RAM recommended

---

## **Next Steps**

1. Run `npm install`
2. Run `npm run dev`
3. Visit `http://localhost:5173`
4. Go to Profile
5. Enable Web LLM
6. Download Phi-3 Mini (~2GB, one-time)
7. Create an AI-powered quiz!

**Enjoy free, private, powerful AI quizzes! 🎓✨**
