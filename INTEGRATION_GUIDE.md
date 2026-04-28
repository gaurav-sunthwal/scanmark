# ScanMark & Attendance App Integration Guide

Complete guide for the integrated attendance management system with mobile app and web backend.

## 🎯 Overview

This system consists of:
- **attendance-app**: Next.js backend API with PostgreSQL database
- **attendance-system**: FastAPI face recognition backend with AWS integration
- **scanmark**: React Native mobile app with barcode and face scanning

Both apps share the same database and sync data in real-time.

## 📋 Prerequisites

- Node.js 18+ installed
- PostgreSQL database (Neon DB configured)
- Expo CLI for mobile development
- iOS Simulator or Android Emulator (or physical device)

## 🚀 Setup Instructions

### 1. Backend Setup (attendance-app)

```bash
cd attendance-app

# Install dependencies
npm install

# Verify environment variables
cat .env.local
# Should contain:
# DATABASE_URL=postgresql://...
# JWT_SECRET=your-super-secret-jwt-key-change-in-production-12345

# Start the development server
npm run dev
```

The backend will run on `http://localhost:3000`

### 2. Face Recognition Setup (attendance-system)

```bash
cd attendance-system/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the FastAPI server
python3 main.py
```

The Face API will run on `http://localhost:8000`

### 3. Mobile App Setup (scanmark)

```bash
cd scanmark

# Install dependencies
npm install

# Start Expo development server
npm start
```

Then:
- Press `i` for iOS simulator
- Press `a` for Android emulator
- Scan QR code with Expo Go app on physical device

## 🔐 Authentication

### Default Login Credentials

**Admin Account:**
- Email: `admin@example.com`
- Password: `admin123`

**Teacher Account:**
- Email: `teacher@example.com`
- Password: `teacher123`

### Skip Login (Offline Mode)

You can skip login to use the app in offline mode with local storage only.

## 📱 Features

### Mobile App (scanmark)

1. **Login Screen**
   - JWT-based authentication
   - Option to skip and use offline
   - Secure token storage

2. **Dashboard**
   - Real-time attendance statistics
   - Recent activity feed
   - Quick action buttons
   - Progress tracking

3. **Barcode Scanner**
   - Scan student ID cards
   - Instant attendance marking
   - Visual feedback
   - End-of-day batch marking

4. **Attendance Records**
   - Filter by: Today, Specific Date, All Time
   - Calendar date picker
   - Present/Absent statistics
   - Student details

5. **Student Management**
   - Import from Excel
   - View all students
   - Search functionality
   - Add manually

6. **Settings**
   - Toggle API sync mode
   - Connection status
   - User profile
   - Logout

7. **Export**
   - Export to Excel
   - Share functionality
   - Date range selection

### Backend API (attendance-app)

#### Authentication Endpoints

```
POST /api/auth/login
Body: { email, password }
Response: { token, user }

POST /api/auth/verify
Body: { token }
Response: { valid, user }
```

#### Student Endpoints

```
GET /api/students
Headers: Authorization: Bearer <token>
Response: Array of students

GET /api/students/barcode/:barcode
Headers: Authorization: Bearer <token>
Response: Student object

POST /api/students
Headers: Authorization: Bearer <token>
Body: { name, roll_number, barcode }
Response: Created student
```

#### Attendance Endpoints

```
GET /api/attendance
Headers: Authorization: Bearer <token>
Response: Array of attendance records

POST /api/attendance
Headers: Authorization: Bearer <token>
Body: { student_id, date, status }
Response: Created attendance record
```

#### Stats Endpoint

```
GET /api/stats
Headers: Authorization: Bearer <token>
Response: { totalStudents, present, absent, unmarked, date }
```

#### Health Check

```
GET /api/health
Response: { status: "ok" }
```

#### Face Recognition Endpoints (Port 8000)

```
POST /enroll
Body: FormData { image, name, studentId }
Response: { success, studentId }

POST /recognize
Body: { photo_base64, class_name, date }
Response: { success, studentId, name, prn }

POST /recognize-group
Body: { photo_base64, class_name, date }
Response: { success, recognized: [...] }

GET /enroll/status/:prn
Response: { enrolled: boolean }

POST /enroll/check
Body: { prns: string[] }
Response: { enrolled: string[] }

GET /photo/:prn
Response: Student Photo (Image)
```

## 🔄 Data Synchronization

### API Mode (Online)
- All data synced with backend in real-time
- Requires internet connection
- Shared across all devices
- Automatic token refresh

### Offline Mode
- Data stored locally on device
- Works without internet
- Device-specific data
- Can switch to API mode anytime

### Switching Modes

1. Go to Settings
2. Toggle "Use Backend API"
3. Test connection
4. Data will sync automatically

## 🗄️ Database Schema

### Students Table
```sql
- id: integer (primary key)
- name: string
- roll_number: string
- barcode: string (unique)
- created_at: timestamp
```

### Attendance Table
```sql
- id: integer (primary key)
- student_id: integer (foreign key)
- date: date
- status: enum ('present', 'absent')
- created_at: timestamp
```

## 📊 Excel Import Format

Students Excel file should have columns:
- Name
- Roll Number
- Barcode

Example:
```
Name              | Roll Number | Barcode
------------------|-------------|------------
John Doe          | 1           | 1032233185
Jane Smith        | 2           | 1032231329
```

## 🔧 Configuration

### Backend URL Configuration

Edit `scanmark/utils/api.ts`:

```typescript
// For local development
const API_BASE_URL = 'http://localhost:3000/api';

// For production (replace with your deployed URL)
const API_BASE_URL = 'https://your-domain.com/api';

// For testing on physical device (use your computer's IP)
const API_BASE_URL = 'http://192.168.1.100:3000/api';
const FACE_API_BASE_URL = 'http://192.168.1.100:8000';
```

### JWT Secret

Edit `attendance-app/.env.local`:

```env
JWT_SECRET=your-super-secret-jwt-key-change-in-production-12345
```

⚠️ **Important**: Change this in production!

## 🐛 Troubleshooting

### "Cannot connect to backend"

1. Check backend is running: `http://localhost:3000/api/health`
2. Verify API_BASE_URL in `scanmark/utils/api.ts`
3. For physical device, use computer's IP address
4. Check firewall settings

### "Authentication failed"

1. Verify credentials are correct
2. Check JWT_SECRET is set in backend
3. Clear app data and try again
4. Use "Skip Login" for offline mode

### "Student not found"

1. Import students via Excel
2. Check barcode format matches
3. Verify database connection
4. Refresh student list

### "Barcode scanner not working"

1. Grant camera permissions
2. Ensure good lighting
3. Hold barcode steady
4. Try different barcode types

## 📱 Testing on Physical Device

### iOS
1. Install Expo Go from App Store
2. Scan QR code from terminal
3. Update API_BASE_URL to computer's IP

### Android
1. Install Expo Go from Play Store
2. Scan QR code from terminal
3. Update API_BASE_URL to computer's IP

### Find Your Computer's IP

**macOS/Linux:**
```bash
ifconfig | grep "inet "
```

**Windows:**
```bash
ipconfig
```

Look for IPv4 address (e.g., 192.168.1.100)

## 🚢 Production Deployment

### Backend Deployment

1. Deploy to Vercel/Netlify/Railway
2. Set environment variables:
   - DATABASE_URL
   - JWT_SECRET
3. Update CORS settings if needed

### Mobile App Deployment

1. Update API_BASE_URL to production URL
2. Build for iOS: `expo build:ios`
3. Build for Android: `expo build:android`
4. Submit to App Store / Play Store

## 📝 API Response Examples

### Login Success
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "admin@example.com",
    "name": "Admin User"
  }
}
```

### Students List
```json
[
  {
    "id": 1,
    "name": "John Doe",
    "roll_number": "1",
    "barcode": "1032233185",
    "created_at": "2024-03-31T00:00:00.000Z"
  }
]
```

### Attendance Record
```json
{
  "id": 1,
  "student_id": 1,
  "date": "2024-03-31",
  "status": "present",
  "created_at": "2024-03-31T10:30:00.000Z",
  "name": "John Doe",
  "roll_number": "1"
}
```

## 🎨 Customization

### Change Theme Colors

Edit color values in StyleSheet objects:
- Primary: `#3b82f6` (blue)
- Success: `#22c55e` (green)
- Error: `#ef4444` (red)

### Add New User Roles

1. Update users array in `attendance-app/src/app/api/auth/login/route.ts`
2. Add role field to JWT payload
3. Implement role-based access control

## 📞 Support

For issues or questions:
1. Check this guide first
2. Review error messages in console
3. Test with offline mode
4. Verify backend is running

## ✅ Quick Start Checklist

- [ ] Backend running on port 3000
- [ ] Database connected
- [ ] JWT_SECRET configured
- [ ] Mobile app started with Expo
- [ ] API_BASE_URL configured correctly
- [ ] Camera permissions granted
- [ ] Students imported
- [ ] Test login successful
- [ ] Barcode scan working
- [ ] Data syncing properly

## 🎉 You're All Set!

The system is now fully integrated and ready to use. Start by:
1. Logging in with admin credentials
2. Importing student list
3. Scanning barcodes to mark attendance
4. Viewing reports and statistics

Happy attendance tracking! 📊
