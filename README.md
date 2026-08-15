# 🔍 MoneyLens

> **Smart Personal Finance Tracker, Intelligent Budgeting & AI-Powered Wealth Advisor**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Render-16a34a?style=for-the-badge&logo=render)](https://moneylens-6fgt.onrender.com)

🌐 **Live Demo**: [https://moneylens-6fgt.onrender.com](https://moneylens-6fgt.onrender.com)

MoneyLens is a modern, full-stack personal finance application built to help you track spending, set smart budgets, analyze financial health, and receive personalized advice from an AI Financial Advisor. It features an immutable **Blockchain Audit Trail**, **Automated Email Alerts**, **Bank Statement Importing (CSV & PDF)**, and **Multi-Currency Support**.

---

## ✨ Features & Highlights

### 📊 Dashboard & Visual Analytics
- **Live Summary**: Real-time stats for Monthly Income, Monthly Expenditures, Net Balance, and Compiled Savings.
- **Interactive Charts**: Powered by Chart.js — overview bar charts and category spending breakdown doughnuts.
- **Budget Progress**: Real-time spending progress bars with automatic **⚠️ Budget Exceeded** alert badges.

### 🤖 AI Financial Advisor (FinanceGuru)
- **Context-Aware AI**: Powered by **Google Gemini** (or Groq / xAI). The AI reads your live transactions, monthly category totals, and budget limits to answer complex financial questions.
- **Personalized Insights**: Ask questions like *"Am I over budget on Food?"*, *"How much did I spend this month?"*, or *"Where can I cut expenses?"*.

### 📄 Bank Statement Importer (CSV & PDF)
- **Multi-Format Extraction**: Upload bank statements in CSV or PDF formats.
- **Smart Parsing Engine**: Uses a 3-tier Regex Cascade + AI extraction to accurately extract dates, descriptions, amounts, and transaction types from bank statements worldwide.
- **Auto-Categorization**: Automatically tags imported transactions based on standard keywords (e.g. Zomato → Food, Uber → Transport, Netflix → Entertainment).
- **Duplicate Prevention**: Automatically detects and flags duplicate transactions before saving.

### ⛓️ Immutable Blockchain Audit Trail
- **Proof-of-Work (PoW) Chain**: Every transaction is mined into a cryptographic SHA-256 block.
- **Full Audit History**:
  - **Transaction Blocks**: Mined upon transaction creation.
  - **Amendment Blocks**: Mined when a transaction is edited (stores before/after snapshot).
  - **Deletion Blocks**: Mined when a transaction is removed (stores permanent deleted snapshot).
- **Blockchain Explorer**: Integrated block explorer UI with 1-click chain integrity verification.

### 🔔 Automated Email Alerts (EmailJS)
- **Instant Budget Notifications**: Automatically emails you when your spending exceeds a category budget limit.
- **Transaction Receipt Notifications**: Detailed summary sent whenever new transactions are logged.
- **OTP Password Reset**: Secure 6-digit OTP verification delivered directly to your inbox.

### 🐖 Savings Goals & Deficit Offsets
- Set custom savings goals (Primary & Secondary).
- Automatically subtracts monthly budget deficits from your primary savings goal to keep your total net worth accurate.

### 🌍 Multi-Currency Support
- Switch between **USD ($)**, **INR (₹)**, **EUR (€)**, **GBP (£)**, and **JPY (¥)** at any time.
- Real-time exchange rates auto-convert transaction amounts and budget limits on the fly.

### 🔐 Authentication & Security
- Local Email/Password authentication with `bcryptjs` hashing.
- **Google OAuth 2.0**: 1-click login with Google accounts.
- Protected session management via `express-session` & `passport.js`.

---

## 🛠️ Tech Stack

- **Backend**: Node.js (Native ES Modules), Express.js (v5)
- **Database**: MongoDB & Mongoose ORM
- **Frontend**: EJS Templating, Vanilla CSS (Stripe/Linear-inspired Design System), Chart.js, Lucide Icons
- **AI Integration**: Google Gemini API (`gemini-2.5-flash`), Groq (`llama-3.3-70b-versatile`), xAI (`grok-beta`)
- **Email Service**: EmailJS REST API
- **Cryptography**: SHA-256 Mining Engine (`crypto`)

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [MongoDB](https://www.mongodb.com/) (Local or MongoDB Atlas Cluster)

### 2. Installation

Clone the repository and install dependencies:
```bash
git clone https://github.com/your-username/MoneyLens.git
cd MoneyLens
npm install
```

### 3. Environment Configuration

Create a `.env` file in the root directory:
```env
PORT=3000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/moneylens
SESSION_SECRET=your_secret_key_here

# Google OAuth (Optional for Google Sign-In)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# AI Advisor (Google Gemini API - Free Key from https://aistudio.google.com/)
GEMINI_API_KEY=AIzaSyYourGeminiApiKeyHere

# Email Notifications (EmailJS Configuration)
EMAILJS_PUBLIC_KEY=your_emailjs_public_key
EMAILJS_SERVICE_ID=your_emailjs_service_id
EMAILJS_TEMPLATE_ID=your_emailjs_template_id
EMAILJS_PRIVATE_KEY=your_emailjs_private_key

BASE_URL=http://localhost:3000
```

### 4. Run the Server

Start the development server with Nodemon:
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser!

---

## 🌐 Deploying to Render.com

1. Push your code to your GitHub repository.
2. Sign in to **[Render.com](https://render.com/)** and click **New + → Web Service**.
3. Connect your GitHub repository.
4. Set the build settings:
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Add all variables from your `.env` under **Environment Variables**.
6. Click **Create Web Service**!

---

## 📜 License

This project is licensed under the ISC License. Created with ❤️ by MoneyLens.
