# 📱 ScanMark Attendance System

Complete attendance management system with mobile app and backend API integration.

## 🎯 What's This?

A full-stack attendance tracking solution with:
- **Mobile App** (React Native + Expo) - Scan barcodes to mark attendance
- **Backend API** (Next.js + PostgreSQL) - Centralized data storage
- **JWT Authentication** - Secure login system
- **Real-time Sync** - Data shared across devices
- **Offline Mode** - Works without internet

## ⚡ Quick Start

### 1. Start Backend
```bash
cd attendance-app
npm run dev
```

### 2. Start Mobile App
```bash
cd scanmark
npm start
```

### 3. Login
- Email: `admin@example.com`
- Password: `admin123`
- Or skip for offline mode

## 📚 Documentation

- **[START_HERE.md](START_HERE.md)** - Quick 2-minute setup guide
- **[INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md)** - Complete technical documentation
- **[FEATURES_COMPLETED.md](FEATURES_COMPLETED.md)** - Full feature list

## ✨ Key Features

### Mobile App
- 📸 Barcode/QR code scanning
- 🔐 JWT authentication
- 📅 Date-based filtering with calendar
- 📊 Real-time statistics
- 📥 Excel import/export
- ⚙️ Settings & configuration
- 🔄 Online/offline sync

### Backend API
- 🔑 JWT authentication endpoints
- 👥 Student management
- ✅ Attendance tracking
- 📈 Statistics & reports
- 🏥 Health check
- 🗄️ PostgreSQL database

## 🏗️ Project Structure

```
.
├── attendance-app/          # Next.js Backend API
│   ├── src/
│   │   ├── app/
│   │   │   └── api/
│   │   │       ├── auth/    # Login & verify
│   │   │       ├── students/ # Student CRUD
│   │   │       ├── attendance/ # Attendance CRUD
│   │   │       ├── stats/   # Statistics
│   │   │       └── health/  # Health check
│   │   └── lib/
│   │       ├── db.ts        # Database connection
│   │       └── mock-db.ts   # Mock data
│   └── .env.local           # Environment variables
│
├── scanmark/                # React Native Mobile App
│   ├── app/
│   │   ├── login.tsx        # Login screen
│   │   ├── index.tsx        # Dashboard
│   │   ├── scanner.tsx      # Barcode scanner
│   │   ├── attendance.tsx   # Records with date filter
│   │   ├── students.tsx     # Student list
│   │   ├── settings.tsx     # Settings & logout
│   │   └── export.tsx       # Export to Excel
│   ├── components/
│   │   └── date-selector.tsx # Calendar picker
│   └── utils/
│       ├── api.ts           # API service layer
│       └── storage.ts       # Local storage + sync
│
└── Documentation files
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/verify` - Token verification

### Students
- `GET /api/students` - Get all students
- `GET /api/students/barcode/:barcode` - Find by barcode
- `POST /api/students` - Create student

### Attendance
- `GET /api/attendance` - Get all records
- `POST /api/attendance` - Mark attendance

### Stats
- `GET /api/stats` - Get statistics

### Health
- `GET /api/health` - Check server status

## 🔐 Authentication

### Default Accounts

**Admin:**
- Email: admin@example.com
- Password: admin123

**Teacher:**
- Email: teacher@example.com
- Password: teacher123

### JWT Token
- 7-day expiry
- Stored in AsyncStorage
- Auto-refresh on app start
- Secure Bearer token authentication

## 📊 Database

**PostgreSQL (Neon DB)**
- 46 pre-loaded students
- Students table (id, name, roll_number, barcode)
- Attendance table (id, student_id, date, status)
- Proper relationships and indexes

## 🎨 Screenshots

### Mobile App Screens
1. **Login** - Beautiful auth screen with skip option
2. **Dashboard** - Stats, progress, recent activity
3. **Scanner** - Camera with overlay, instant marking
4. **Attendance** - Filter by today/date/all with calendar
5. **Students** - List with search and import
6. **Settings** - API toggle, connection status, logout
7. **Export** - Excel export with sharing

## 🛠️ Tech Stack

### Backend
- Next.js 16
- TypeScript
- PostgreSQL (Neon)
- JWT (jsonwebtoken)
- Drizzle ORM

### Mobile
- React Native
- Expo SDK 54
- TypeScript
- AsyncStorage
- Expo Camera
- React Navigation
- Reanimated

## 📱 Platform Support

- ✅ iOS (Simulator & Device)
- ✅ Android (Emulator & Device)
- ✅ Web (Expo preview)

## 🚀 Deployment

### Backend
- Deploy to Vercel/Railway/Render
- Set DATABASE_URL and JWT_SECRET
- Update CORS if needed

### Mobile
- Update API_BASE_URL to production
- Build: `expo build:ios` / `expo build:android`
- Submit to App Store / Play Store

## 🔄 Data Sync

### API Mode (Online)
- Real-time sync with backend
- Shared across all devices
- Requires authentication
- Automatic token refresh

### Offline Mode
- Local AsyncStorage
- Device-specific data
- No authentication needed
- Can switch to API mode anytime

## 🐛 Troubleshooting

**Backend not connecting?**
- Check if running on port 3000
- Verify API_BASE_URL in mobile app
- For physical device, use computer's IP

**Camera not working?**
- Grant camera permissions
- Check device settings
- Ensure good lighting

**Login failing?**
- Use correct credentials
- Check JWT_SECRET is set
- Try skip login for offline

**Students not showing?**
- Import Excel file first
- Check database connection
- Refresh the list

## 📖 Learn More

- [Expo Documentation](https://docs.expo.dev/)
- [Next.js Documentation](https://nextjs.org/docs)
- [React Native](https://reactnative.dev/)
- [PostgreSQL](https://www.postgresql.org/docs/)

## 🤝 Contributing

This is a complete, production-ready system. Feel free to:
- Add new features
- Improve UI/UX
- Enhance security
- Add more user roles
- Implement notifications

## 📄 License

MIT License - Use freely for your projects

## ✅ Status

🟢 **FULLY FUNCTIONAL** - All features implemented and tested

- ✅ Backend API with 7 endpoints
- ✅ Mobile app with 7 screens
- ✅ JWT authentication
- ✅ Date filtering with calendar
- ✅ Real-time sync
- ✅ Offline mode
- ✅ Excel import/export
- ✅ 46 pre-loaded students
- ✅ Complete documentation

## 🎉 Ready to Use!

Everything is set up and working. Just follow the Quick Start guide and you're ready to track attendance!

---

**Need Help?** Check the documentation files:
- Quick setup: `START_HERE.md`
- Full guide: `INTEGRATION_GUIDE.md`
- Features: `FEATURES_COMPLETED.md`

**Happy Attendance Tracking! 📊**
# scanmark
