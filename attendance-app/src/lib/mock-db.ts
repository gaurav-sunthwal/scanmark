// Mock database for demo purposes - replace with real DB connection when available

export interface Student {
  id: number;
  name: string;
  roll_number: string;
  barcode: string;
  created_at: string;
}

export interface AttendanceRecord {
  id: number;
  student_id: number;
  date: string;
  status: 'present' | 'absent';
  created_at: string;
  name?: string;
  roll_number?: string;
}

// Initial student data from the Excel file
const initialStudents: Student[] = [
  { id: 1, name: 'Omkar Patel', roll_number: '1', barcode: '1032233185', created_at: new Date().toISOString() },
  { id: 2, name: 'Sushant Kumar', roll_number: '2', barcode: '1032231329', created_at: new Date().toISOString() },
  { id: 3, name: 'Damini Chandrakar', roll_number: '3', barcode: '1032233188', created_at: new Date().toISOString() },
  { id: 4, name: 'Meha Patel', roll_number: '4', barcode: '1032231163', created_at: new Date().toISOString() },
  { id: 5, name: 'Ashish Sharma', roll_number: '5', barcode: '1032231907', created_at: new Date().toISOString() },
  { id: 6, name: 'Yashraj Narke', roll_number: '6', barcode: '1032232513', created_at: new Date().toISOString() },
  { id: 7, name: 'Maaz Visawaderwala', roll_number: '7', barcode: '1032232397', created_at: new Date().toISOString() },
  { id: 8, name: 'Om Jagdeesh', roll_number: '8', barcode: '1032232632', created_at: new Date().toISOString() },
  { id: 9, name: 'Himanshu Prakash', roll_number: '9', barcode: '1032233853', created_at: new Date().toISOString() },
  { id: 10, name: 'Sanyam Sharma', roll_number: '10', barcode: '1032233187', created_at: new Date().toISOString() },
  { id: 11, name: 'Khushi Singh', roll_number: '11', barcode: '1032233940', created_at: new Date().toISOString() },
  { id: 12, name: 'Harsh Patel', roll_number: '12', barcode: '1032232829', created_at: new Date().toISOString() },
  { id: 13, name: 'Vineet M', roll_number: '13', barcode: '1032232744', created_at: new Date().toISOString() },
  { id: 14, name: 'Abhinav Magesh', roll_number: '14', barcode: '1032230701', created_at: new Date().toISOString() },
  { id: 15, name: 'Meghshyam Kimmatkar', roll_number: '15', barcode: '1262240002', created_at: new Date().toISOString() },
  { id: 16, name: 'Vishakha Poojari', roll_number: '16', barcode: '1262240013', created_at: new Date().toISOString() },
  { id: 17, name: 'Harsh Malpani', roll_number: '17', barcode: '1032221973', created_at: new Date().toISOString() },
  { id: 18, name: 'Sindhura Gulhane', roll_number: '18', barcode: '1032230397', created_at: new Date().toISOString() },
  { id: 19, name: 'Strelisha Lewis', roll_number: '19', barcode: '1032231040', created_at: new Date().toISOString() },
  { id: 20, name: 'Zamil', roll_number: '20', barcode: '1032232683', created_at: new Date().toISOString() },
  { id: 21, name: 'Amar Soni', roll_number: '21', barcode: '1032231364', created_at: new Date().toISOString() },
  { id: 22, name: 'Rishika Agarwal', roll_number: '22', barcode: '1032232953', created_at: new Date().toISOString() },
  { id: 23, name: 'Chahat Jain', roll_number: '23', barcode: '1032231059', created_at: new Date().toISOString() },
  { id: 24, name: 'Sanya Asati', roll_number: '24', barcode: '1032232956', created_at: new Date().toISOString() },
  { id: 25, name: 'Kaashvi Gupta', roll_number: '25', barcode: '1032231301', created_at: new Date().toISOString() },
  { id: 26, name: 'Yash Darekar', roll_number: '26', barcode: '1032231148', created_at: new Date().toISOString() },
  { id: 27, name: 'Taha Mohammedi', roll_number: '27', barcode: '1032232889', created_at: new Date().toISOString() },
  { id: 28, name: 'Pooja Karaniya', roll_number: '28', barcode: '1032230214', created_at: new Date().toISOString() },
  { id: 29, name: 'Siddhartha Swamy', roll_number: '29', barcode: '1032230692', created_at: new Date().toISOString() },
  { id: 30, name: 'Tanushree Dharmavaram', roll_number: '30', barcode: '1032232615', created_at: new Date().toISOString() },
  { id: 31, name: 'Vanshika Kaushal', roll_number: '31', barcode: '1032233712', created_at: new Date().toISOString() },
  { id: 32, name: 'Yashika Raj', roll_number: '32', barcode: '1032232524', created_at: new Date().toISOString() },
  { id: 33, name: 'Khushi Tiwari', roll_number: '33', barcode: '1032231420', created_at: new Date().toISOString() },
  { id: 34, name: 'Vishwesh Bhat', roll_number: '34', barcode: '1032232281', created_at: new Date().toISOString() },
  { id: 35, name: 'Imad Gharade', roll_number: '35', barcode: '1032230935', created_at: new Date().toISOString() },
  { id: 36, name: 'Vani Sarda', roll_number: '36', barcode: '1032233579', created_at: new Date().toISOString() },
  { id: 37, name: 'Sujay Chawda', roll_number: '37', barcode: '1032232493', created_at: new Date().toISOString() },
  { id: 38, name: 'Darshil Patel', roll_number: '38', barcode: '1032232467', created_at: new Date().toISOString() },
  { id: 39, name: 'Ayush Devdhe', roll_number: '39', barcode: '1032233876', created_at: new Date().toISOString() },
  { id: 40, name: 'Lakshya Chanchlani', roll_number: '40', barcode: '1032232588', created_at: new Date().toISOString() },
  { id: 41, name: 'Tanishq Patil', roll_number: '41', barcode: '1032231257', created_at: new Date().toISOString() },
  { id: 42, name: 'Shubham Waditake', roll_number: '42', barcode: '1032232463', created_at: new Date().toISOString() },
  { id: 43, name: 'Himanshu Gupta', roll_number: '43', barcode: '1032230849', created_at: new Date().toISOString() },
  { id: 44, name: 'Pradyumna Raundal', roll_number: '44', barcode: '1032232997', created_at: new Date().toISOString() },
  { id: 45, name: 'Gaurav Sunthwal', roll_number: '45', barcode: '1032232584', created_at: new Date().toISOString() },
  { id: 46, name: 'Riya Naik', roll_number: '46', barcode: '1032231063', created_at: new Date().toISOString() },
];

// In-memory storage
let students: Student[] = [...initialStudents];
let attendance: AttendanceRecord[] = [];
let nextStudentId = 47;
let nextAttendanceId = 1;

// Students API
export const mockStudents = {
  getAll: (): Student[] => {
    return [...students].sort((a, b) => parseInt(a.roll_number) - parseInt(b.roll_number));
  },
  
  getByBarcode: (barcode: string): Student | undefined => {
    return students.find(s => s.barcode === barcode);
  },
  
  getById: (id: number): Student | undefined => {
    return students.find(s => s.id === id);
  },
  
  create: (name: string, roll_number: string, barcode: string): Student => {
    const student: Student = {
      id: nextStudentId++,
      name,
      roll_number,
      barcode,
      created_at: new Date().toISOString(),
    };
    students.push(student);
    return student;
  },
  
  reset: () => {
    students = [...initialStudents];
    attendance = [];
    nextStudentId = 47;
    nextAttendanceId = 1;
  },
};

// Attendance API
export const mockAttendance = {
  getAll: (): AttendanceRecord[] => {
    return attendance
      .map(a => {
        const student = students.find(s => s.id === a.student_id);
        return {
          ...a,
          name: student?.name,
          roll_number: student?.roll_number,
        };
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },
  
  getByDate: (date: string): AttendanceRecord[] => {
    return attendance.filter(a => a.date === date);
  },
  
  mark: (student_id: number, date: string, status: 'present' | 'absent'): AttendanceRecord => {
    // Check if already marked
    const existingIndex = attendance.findIndex(
      a => a.student_id === student_id && a.date === date
    );
    
    const student = students.find(s => s.id === student_id);
    
    if (existingIndex >= 0) {
      // Update existing
      attendance[existingIndex] = {
        ...attendance[existingIndex],
        status,
        created_at: new Date().toISOString(),
      };
      return {
        ...attendance[existingIndex],
        name: student?.name,
        roll_number: student?.roll_number,
      };
    }
    
    // Create new
    const record: AttendanceRecord = {
      id: nextAttendanceId++,
      student_id,
      date,
      status,
      created_at: new Date().toISOString(),
      name: student?.name,
      roll_number: student?.roll_number,
    };
    attendance.push(record);
    return record;
  },
  
  getStats: () => {
    const today = new Date().toISOString().split('T')[0];
    const todayAttendance = attendance.filter(a => a.date === today);
    const present = todayAttendance.filter(a => a.status === 'present').length;
    const absent = todayAttendance.filter(a => a.status === 'absent').length;
    
    return {
      totalStudents: students.length,
      present,
      absent,
      unmarked: students.length - present - absent,
      date: today,
    };
  },
  
  clear: () => {
    attendance = [];
    nextAttendanceId = 1;
  },
};
