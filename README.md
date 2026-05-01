# RoomSync – Roommate Expense Manager

> Real-time expense splitting and settlement tracker for shared living spaces.  
> **No npm required** — runs entirely on CDN imports + a plain Node.js server.  
> Backend: Firebase Auth + Firestore (free tier). Hosting: Netlify/Vercel free.

---

## Features

- 🔐 **Auth** – Email/password & Google Sign-In
- 🏠 **House** – Create a house, get a 6-char join code
- 🔗 **Invite** – Share `?join=CODE` URL; roommates auto-join on sign-in
- 💰 **Expenses** – Category, payer, equal/unequal split, recurring flag, receipt image ≤ 200 KB
- 💳 **Payments** – Direct settlements; creator-only edit/delete
- 📊 **Dashboard** – Net balances, Chart.js pie chart, suggested settlements, Settle All
- 📋 **Activity Feed** – Timestamped log of all events
- 📤 **Export / Import** – Full JSON backup and restore
- 🌐 **Offline** – Firestore offline persistence via IndexedDB
- 🌙 **Dark / Light Mode** – Persisted to localStorage
- 📱 **PWA** – Installable, offline-capable

---

## Setup (No npm needed)

### Prerequisites

- **Node.js** installed (`node --version` should print a version number)  
- A **Firebase project** (free — see below)  
- Internet connection (CDN loads Firebase + Chart.js automatically)

---

### 1. Create a Firebase Project

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com) → **Add project**
2. Enable **Authentication** → Sign-in methods → Enable **Email/Password** and **Google**
3. Enable **Firestore Database** → Start in **production mode** → choose a region

### 2. Add Firestore Security Rules

Copy the contents of `firestore.rules` and paste into:  
**Firebase Console → Firestore → Rules tab → Edit → Publish**

### 3. Get Your Firebase Config

**Firebase Console → Project Settings → Your apps → Add web app → copy the config object.**

### 4. Paste Config into the App

Open `src/firebase.js` and replace the placeholder values:

```js
const firebaseConfig = {
  apiKey:            "AIza...",
  authDomain:        "your-project.firebaseapp.com",
  projectId:         "your-project-id",
  storageBucket:     "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123:web:abc"
};
```

---

## Run Locally

### Option A – Double-click (Windows)

Double-click **`start.bat`** in the project folder.  
The browser opens automatically at `http://localhost:5173`.

### Option B – Terminal

```bash
node serve.cjs
```

Then open `http://localhost:5173` in your browser.

### Option C – Python (if you have it)

```bash
python -m http.server 5173
```

### Option D – VS Code Live Server

Right-click `index.html` → **Open with Live Server**.

---

## Deploy (Free Hosting)

### Netlify Drop (easiest)

1. Just drag the entire project folder to [https://app.netlify.com/drop](https://app.netlify.com/drop)
2. Done — your app is live!

### Vercel

1. Push the folder to GitHub
2. Import at [https://vercel.com/new](https://vercel.com/new)
3. No build command needed. Output directory: `.` (root)

### Netlify CLI

```bash
# If you have npm working on another machine:
npm install -g netlify-cli
netlify deploy --prod --dir=.
```

---

## Unit Tests (Optional)

If you have a working `npm` on any machine:

```bash
npm install
npm test
```

The pure logic tests in `tests/` have **no Firebase dependency** and run in Node.js.

---

## Firestore Data Model

```
houses/{houseId}
  name, joinCode, creatorUid, memberUids[], createdAt

  roommates/{roommateId}
    name, email, uid, isOwner, joinedAt

  expenses/{expenseId}
    description, amount, paidBy, date, category,
    splitType, participants[], splits{}, recurring,
    receiptBase64 (≤200 KB base64), creatorUid, createdAt

  payments/{paymentId}
    from, to, amount, date, note, creatorUid, createdAt

users/{uid}
  displayName, email, houseId, createdAt
```

---

## Free Tier Limits

| Service | Free Limit | This App Uses |
|---|---|---|
| Firebase Auth | 10,000 MAU | ✅ Minimal |
| Firestore reads | 50,000/day | ✅ Low |
| Firestore writes | 20,000/day | ✅ Low |
| Netlify/Vercel | 100 GB bandwidth | ✅ Static only |

No Firebase Storage. No Firebase Functions. No paid APIs.
