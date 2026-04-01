# 🚀 Quick Start Guide

## Start Both Apps in 2 Minutes

### Step 1: Start Backend (Terminal 1)

```bash
cd attendance-app
npm run dev
```

✅ Backend running at: http://localhost:3000

### Step 2: Start Mobile App (Terminal 2)

```bash
cd scanmark
npm start
```

Then press:
- `i` for iOS Simulator
- `a` for Android Emulator
- Scan QR code for physical device

### Step 3: Login

**Option A: Login with credentials**
- Email: `admin@example.com`
- Password: `admin123`

**Option B: Skip login**
- Tap "Skip & Use Offline"
- Use local storage only

### Step 4: Import Students

1. Tap "Import Excel" on dashboard
2. Select your Excel file with columns: Name, Roll Number, Barcode
3. Students will sync to backend (if logged in)

### Step 5: Start Scanning

1. Tap "Scan Barcode"
2. Grant camera permission
3. Scan student ID cards
4. Attendance marked instantly!

## 📱 Features You Can Use Now

✅ **Barcode Scanning** - Mark attendance in seconds
✅ **Date Filtering** - View any date's attendance
✅ **Real-time Sync** - Data shared across devices
✅ **Offline Mode** - Works without internet
✅ **Excel Export** - Download attendance reports
✅ **Statistics** - Track attendance trends

## 🔧 Configuration

### For Physical Device Testing

1. Find your computer's IP:
   ```bash
   # macOS/Linux
   ifconfig | grep "inet "
   
   # Windows
   ipconfig
   ```

2. Update `scanmark/utils/api.ts`:
   ```typescript
   const API_BASE_URL = 'http://YOUR_IP:3000/api';
   // Example: 'http://192.168.1.100:3000/api'
   ```

## ⚡ Quick Commands

```bash
# Backend
cd attendance-app
npm run dev          # Start server
npm run build        # Build for production

# Mobile App
cd scanmark
npm start            # Start Expo
npm run android      # Run on Android
npm run ios          # Run on iOS
```

## 🎯 What's Working

✅ JWT Authentication with 7-day token expiry
✅ Backend API with all CRUD operations
✅ Mobile app with barcode scanner
✅ Date-based attendance filtering
✅ Real-time statistics dashboard
✅ Excel import/export
✅ Offline mode with local storage
✅ Settings with connection status
✅ User profile and logout

## 📊 Test Data

The system comes with 46 pre-loaded students. You can:
- Scan their barcodes
- Mark attendance manually
- View reports by date
- Export to Excel

## 🐛 Common Issues

**"Cannot connect to backend"**
→ Make sure backend is running on port 3000

**"Camera not working"**
→ Grant camera permissions in device settings

**"Student not found"**
→ Import students first or check barcode format

**"Login failed"**
→ Use: admin@example.com / admin123
→ Or skip login for offline mode

## 📖 Full Documentation

See `INTEGRATION_GUIDE.md` for complete documentation including:
- API endpoints
- Database schema
- Deployment guide
- Customization options
- Troubleshooting

## ✨ You're Ready!

Everything is set up and working. Just start both servers and begin scanning!

Need help? Check the error console or refer to INTEGRATION_GUIDE.md
