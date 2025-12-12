# Render Deployment Guide

## Free Tier Limits (Render)
- **750 hours/month** of web service runtime
- **Free SSL certificates**
- **Custom domains**
- **Automatic deployments from GitHub**
- **PostgreSQL database** (optional)

## Step 1: Deploy Backend to Render

1. **Go to https://render.com/** and sign up
2. **Connect your GitHub account**
3. **Create "New Web Service"**:
   - Connect your GitHub repository
   - Name: `grade9-ai-tutor-api`
   - Environment: `Python 3`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - Add Environment Variable: `GROQ_API_KEY` = your actual API key

4. **Your API URL will be**: `https://grade9-ai-tutor-api.onrender.com`

## Step 2: Deploy Frontend to Render

1. **Create another "New Web Service"**:
   - Name: `grade9-ai-tutor-frontend`
   - Environment: `Static`
   - Root Directory: `.`
   - Publish Directory: `.`
   - Add Routes:
     - `/*` → `./index.html`
     - `/login.html` → `./login.html`
     - `/signup.html` → `./signup.html`

## Step 3: Update Frontend API URL

Update script.js line 29-31:
```javascript
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? `${window.location.protocol}//${window.location.hostname}:8000`
  : 'https://grade9-ai-tutor-api.onrender.com';
```

## 100% Free Alternatives (No Credit Card Required)

### 1. Railway (Free Tier)
- **500 hours/month** free
- **GitHub integration**
- **Custom domains**
- URL: `https://railway.app`

### 2. Vercel (Frontend Only - Free)
- **Unlimited static sites**
- **GitHub integration**
- **Custom domains**
- URL: `https://vercel.com`
- **Note**: You'd still need a backend service

### 3. Glitch (Full Stack - Free)
- **100% free** (no time limits)
- **Live editing**
- **Custom domains** (paid)
- URL: `https://glitch.com`
- **Note**: Projects sleep after 5 minutes inactivity

### 4. Replit (Full Stack - Free)
- **Always-on Repls** (requires subscription)
- **Free Repls** sleep after inactivity
- URL: `https://replit.com`

### 5. Firebase Hosting (Frontend) + Cloud Functions (Backend)
- **Free tier**: 10GB storage, 60GB bandwidth/month
- **Cloud Functions**: 2M invocations/month free
- URL: `https://firebase.google.com`

## My Recommendation: **Glitch**

Glitch is 100% free and perfect for your use case:

1. **Go to https://glitch.com/**
2. **"New Project" → "Import from GitHub"**
3. **Paste your GitHub repository URL**
4. **Add environment variable**: `GROQ_API_KEY`
5. **Your app will be live at**: `https://your-project-name.glitch.me`

## Quick Glitch Deployment

Would you like me to help you deploy to Glitch right now? It's the simplest and truly 100% free option.

Just:
1. Create a Glitch account
2. Import your project from GitHub
3. Add your Groq API key as environment variable
4. Your app is live!

Which option would you prefer to try first?
