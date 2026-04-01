# ScanMark - Attendance Management Mobile App

A React Native mobile app for managing student attendance with barcode scanning, built with Expo.

## Features

- **JWT Authentication**: Secure login with token-based authentication
- **Backend Integration**: Syncs with attendance-app API for centralized data storage
- **Barcode Scanning**: Quick attendance marking via barcode/QR code scanning
- **Date Filtering**: View attendance records by today, specific date, or all time
- **Offline Mode**: Works offline with local storage fallback
- **Excel Import/Export**: Import student lists and export attendance data
- **Real-time Stats**: Dashboard with attendance statistics

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure backend URL in `utils/api.ts`:
```typescript
const API_BASE_URL = 'http://your-backend-url/api';
```

3. Start the app:
```bash
npm start
```

## Authentication

Default credentials:
- Email: admin@example.com
- Password: admin123

Or skip login to use offline mode.

## Backend Integration

The app connects to the attendance-app backend API with the following endpoints:

- `POST /api/auth/login` - User authentication
- `POST /api/auth/verify` - Token verification
- `GET /api/students` - Fetch all students
- `GET /api/students/barcode/:barcode` - Find student by barcode
- `POST /api/students` - Add new student
- `GET /api/attendance` - Fetch attendance records
- `POST /api/attendance` - Mark attendance
- `GET /api/stats` - Get attendance statistics

## Settings

Access settings to:
- Toggle backend API mode
- Check connection status
- View logged-in user info
- Logout

## Tech Stack

- React Native with Expo
- TypeScript
- AsyncStorage for local data
- Expo Camera for barcode scanning
- JWT for authentication
# scanmark
