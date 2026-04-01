'use client';

import { useEffect, useState } from 'react';

interface Student {
  id: number;
  name: string;
  roll_number: string;
  barcode: string;
}

interface AttendanceRecord {
  id: number;
  student_id: number;
  name: string;
  roll_number: string;
  date: string;
  status: string;
}

interface Stats {
  totalStudents: number;
  present: number;
  absent: number;
  unmarked: number;
  date: string;
}

export default function Home() {
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [dbStatus, setDbStatus] = useState<string>('Checking...');
  const [loading, setLoading] = useState(true);
  const [scanInput, setScanInput] = useState('');
  const [lastScanned, setLastScanned] = useState<{name: string; status: string} | null>(null);

  useEffect(() => {
    checkHealth();
    fetchData();
    const interval = setInterval(fetchData, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const checkHealth = async () => {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setDbStatus(data.status === 'connected' ? 'Connected' : 'Error');
    } catch {
      setDbStatus('Error');
    }
  };

  const fetchData = async () => {
    try {
      const [studentsRes, attendanceRes, statsRes] = await Promise.all([
        fetch('/api/students'),
        fetch('/api/attendance'),
        fetch('/api/stats'),
      ]);
      
      if (studentsRes.ok) setStudents(await studentsRes.json());
      if (attendanceRes.ok) setAttendance(await attendanceRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanInput.trim()) return;

    try {
      // Try to find student by barcode
      const res = await fetch(`/api/students/barcode/${scanInput.trim()}`);
      
      if (res.ok) {
        const student = await res.json();
        // Mark as present
        const today = new Date().toISOString().split('T')[0];
        await fetch('/api/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ student_id: student.id, date: today, status: 'present' }),
        });
        setLastScanned({ name: student.name, status: 'present' });
        fetchData();
      } else {
        setLastScanned({ name: 'Not Found', status: 'error' });
      }
      setScanInput('');
    } catch (error) {
      console.error('Scan error:', error);
    }
  };

  const markAttendance = async (studentId: number, status: string) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, date: today, status }),
      });
      if (res.ok) fetchData();
    } catch (error) {
      console.error('Failed to mark attendance:', error);
    }
  };

  const getTodayAttendance = (studentId: number) => {
    return attendance.find(a => a.student_id === studentId && a.date === new Date().toISOString().split('T')[0]);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-2xl font-bold text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 dark:text-white mb-2">
            MIT WPU Attendance
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Class Attendance Management System
          </p>
          <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 rounded-full shadow">
            <div className={`w-3 h-3 rounded-full ${dbStatus === 'Connected' ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-600 dark:text-gray-300">Database: {dbStatus}</span>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 text-center">
              <div className="text-3xl md:text-4xl font-bold text-blue-600 dark:text-blue-400">{stats.totalStudents}</div>
              <div className="text-gray-600 dark:text-gray-300 mt-1 text-sm">Total Students</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 text-center">
              <div className="text-3xl md:text-4xl font-bold text-green-600 dark:text-green-400">{stats.present}</div>
              <div className="text-gray-600 dark:text-gray-300 mt-1 text-sm">Present</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 text-center">
              <div className="text-3xl md:text-4xl font-bold text-red-600 dark:text-red-400">{stats.absent}</div>
              <div className="text-gray-600 dark:text-gray-300 mt-1 text-sm">Absent</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 text-center">
              <div className="text-3xl md:text-4xl font-bold text-orange-600 dark:text-orange-400">{stats.unmarked}</div>
              <div className="text-gray-600 dark:text-gray-300 mt-1 text-sm">Unmarked</div>
            </div>
          </div>
        )}

        {/* Barcode Scanner Input */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Quick Scan (Barcode/PRN)</h2>
          <form onSubmit={handleScan} className="flex gap-3">
            <input
              type="text"
              placeholder="Enter barcode or PRN number..."
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              className="flex-1 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              autoFocus
            />
            <button
              type="submit"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
            >
              Mark Present
            </button>
          </form>
          {lastScanned && (
            <div className={`mt-4 p-4 rounded-lg ${lastScanned.status === 'error' ? 'bg-red-100 dark:bg-red-900' : 'bg-green-100 dark:bg-green-900'}`}>
              <p className={`font-semibold ${lastScanned.status === 'error' ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300'}`}>
                {lastScanned.status === 'error' ? `Student not found: ${lastScanned.name}` : `✓ Marked Present: ${lastScanned.name}`}
              </p>
            </div>
          )}
        </div>

        {/* Class List with Attendance */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Class List - {students.length} Students</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-2 text-gray-600 dark:text-gray-300">Roll</th>
                  <th className="text-left py-3 px-2 text-gray-600 dark:text-gray-300">Name</th>
                  <th className="text-left py-3 px-2 text-gray-600 dark:text-gray-300">PRN/Barcode</th>
                  <th className="text-center py-3 px-2 text-gray-600 dark:text-gray-300">Status</th>
                  <th className="text-right py-3 px-2 text-gray-600 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  const todayAttendance = getTodayAttendance(student.id);
                  return (
                    <tr key={student.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="py-3 px-2 text-gray-800 dark:text-white font-medium">{student.roll_number}</td>
                      <td className="py-3 px-2 text-gray-800 dark:text-white">{student.name}</td>
                      <td className="py-3 px-2 text-gray-500 dark:text-gray-400 text-sm font-mono">{student.barcode}</td>
                      <td className="py-3 px-2 text-center">
                        {todayAttendance ? (
                          <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                            todayAttendance.status === 'present'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                              : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                          }`}>
                            {todayAttendance.status === 'present' ? '✓ Present' : '✗ Absent'}
                          </span>
                        ) : (
                          <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                            —
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => markAttendance(student.id, 'present')}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                              todayAttendance?.status === 'present'
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-green-100 dark:hover:bg-green-900'
                            }`}
                          >
                            P
                          </button>
                          <button
                            onClick={() => markAttendance(student.id, 'absent')}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                              todayAttendance?.status === 'absent'
                                ? 'bg-red-600 text-white'
                                : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-red-100 dark:hover:bg-red-900'
                            }`}
                          >
                            A
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Attendance */}
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Recent Activity</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 text-gray-600 dark:text-gray-300">Student</th>
                  <th className="text-left py-3 px-4 text-gray-600 dark:text-gray-300">Roll</th>
                  <th className="text-left py-3 px-4 text-gray-600 dark:text-gray-300">Date</th>
                  <th className="text-left py-3 px-4 text-gray-600 dark:text-gray-300">Status</th>
                </tr>
              </thead>
              <tbody>
                {attendance.slice(0, 10).map((record) => (
                  <tr key={record.id} className="border-b border-gray-100 dark:border-gray-700">
                    <td className="py-3 px-4 text-gray-800 dark:text-white">{record.name}</td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-300">{record.roll_number}</td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-300">{record.date}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                        record.status === 'present'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                          : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                      }`}>
                        {record.status === 'present' ? 'Present' : 'Absent'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
