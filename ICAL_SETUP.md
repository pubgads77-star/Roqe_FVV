# iCal Feed Setup for Booking.com Sync (100% Free)

## 🎯 What this does
Generates `.ics` calendar files from your Firestore bookings every hour and hosts them on **Firebase Hosting (Spark Plan - Free)** for Booking.com to import.

## 📁 Files Created
- `scripts/generate-ical.ts` - Node.js script that reads Firestore and generates `.ics`
- `.github/workflows/generate-ical.yml` - GitHub Action runs hourly
- `public/ical/apt-01.ics` & `apt-02.ics` - Served via Firebase Hosting

## 🔗 Your iCal URLs (after deploy)
```
https://roqi-apartments.web.app/ical/apt-01.ics
https://roqi-apartments.web.app/ical/apt-02.ics
```

## ⚙️ Setup Steps (One-time)

### 1. Create Firebase Service Account Key
1. Go to [Firebase Console](https://console.firebase.google.com/project/roqi-apartments/settings/serviceaccounts/adminsdk)
2. Click **"Generate new private key"**
3. Save as `serviceAccountKey.json` in project root (gitignored)

### 2. Add GitHub Secrets
Go to your GitHub repo → Settings → Secrets and variables → Actions → New repository secret:

| Secret Name | Value |
|-------------|-------|
| `FIREBASE_SERVICE_ACCOUNT` | **Entire JSON content** of `serviceAccountKey.json` (copy-paste the whole file) |

### 3. Enable Firebase Hosting Target
```bash
firebase target:apply hosting iCal roqi-apartments
```

### 4. Deploy Once Manually (to create the hosting target)
```bash
npm install
firebase deploy --only hosting:iCal
```

### 5. Test the URLs
Visit:
- `https://roqi-apartments.web.app/ical/apt-01.ics`
- `https://roqi-apartments.web.app/ical/apt-02.ics`

Should download `.ics` files with your bookings.

### 6. Add to Booking.com
1. Booking.com Extranet → **Calendar** → **Calendar Sync**
2. **Import Calendar** → Paste URL: `https://roqi-apartments.web.app/ical/apt-01.ics`
3. Name it "Roqii Apt 1" → Save
4. Repeat for `apt-02.ics`

## 🔄 How it Works
```
GitHub Action (hourly, free)
    ↓
Reads Firestore bookings (confirmed + pending)
    ↓
Generates .ics files in public/ical/
    ↓
Deploys to Firebase Hosting (free Spark plan)
    ↓
Booking.com fetches every few hours
```

## 💰 Cost: $0/month
- GitHub Actions: 2,000 min/month free
- Firebase Hosting: 10 GB/month free
- Firestore Reads: ~50k/day free (this uses ~50/day)

## 🛠 Local Testing
```bash
# Install deps
npm install

# Put your serviceAccountKey.json in root
# Then run:
npx tsx scripts/generate-ical.ts

# Check generated files
cat public/ical/apt-01.ics
```

## 📝 Notes
- Only **confirmed** and **pending** bookings are exported
- Updates hourly (GitHub Actions schedule: `0 * * * *`)
- Cache-Control: 1 hour (Booking.com respects this)
- CORS enabled for cross-origin fetching
- No Cloud Functions needed (avoids Blaze plan requirement)