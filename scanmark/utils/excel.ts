import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { attendanceApi, studentsApi } from './api';
import { Student } from './types';

export interface ExcelStudent {
  'Student Name': string;
  'Roll Number': string;
  'Barcode': string;
  [key: string]: string;
}

export async function parseExcelFile(base64Data: string): Promise<Student[]> {
  try {
    const workbook = XLSX.read(base64Data, { type: 'base64' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, string>[];
    
    console.log('Excel columns found:', jsonData.length > 0 ? Object.keys(jsonData[0]) : 'No data');
    console.log('First row:', jsonData[0]);
    
    const students: Student[] = jsonData.map((row, index) => {
      // Try multiple possible column names for each field with case-insensitive check if needed
      const name = row['Student Name'] || row['Name'] || row['student_name'] || row['Full Name'] || row['FullName'] || row['STUDENT NAME'] || row['name'] || '';
      const rollNumber = row['Roll Number'] || row['RollNumber'] || row['Roll No'] || row['RollNo'] || row['Roll'] || row['ID'] || row['Id'] || row['roll_number'] || String(index + 1);
      
      // Extensive barcode column detection
      const barcode = row['Barcode'] || row['Barcode Value'] || row['BarcodeValue'] || row['PRN'] || row['prn'] || 
                     row['barcode'] || row['QR'] || row['qr'] || row['UID'] || row['uid'] || 
                     row['Student ID'] || row['StudentID'] || row['Id'] || row['ID'] || '';
      
      const finalRoll = rollNumber.toString().trim();
      const finalBarcode = (barcode.toString().trim() || finalRoll); // Fallback to roll number if barcode is empty
      
      return {
        id: `student_${Date.now()}_${index}`,
        name: name.trim(),
        rollNumber: finalRoll,
        barcode: finalBarcode,
      };
    }).filter(s => s.name && s.name.length > 0);
    
    console.log('Parsed students:', students.length);
    return students;
  } catch (error) {
    console.error('Parse Excel error:', error);
    throw new Error('Failed to parse Excel file: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

export async function exportAttendanceToExcel(classId?: string): Promise<string> {
  const [students, attendance] = await Promise.all([
    studentsApi.getAll(classId),
    attendanceApi.getAll(classId)
  ]);
  
  // Get all unique dates for this class
  const dates = [...new Set(attendance.map(a => a.date))].sort();
  
  const data = students.map(student => {
    const row: Record<string, string> = {
      'Student Name': student.name,
      'Roll Number': student.rollNumber,
      'Barcode': student.barcode,
    };
    
    dates.forEach(date => {
      const record = attendance.find(a => a.studentId === student.id && a.date === date);
      row[date] = record ? (record.status === 'present' ? 'P' : 'A') : '';
    });
    
    return row;
  });
  
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');
  
  // Generate base64 output
  const wbout = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
  const fileName = `Attendance_${new Date().toISOString().split('T')[0]}.xlsx`;
  
  // Create file and write base64 content
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  file.write(wbout, { encoding: 'base64' });
  
  return file.uri;
}

export async function shareExcelFile(filePath: string): Promise<void> {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(filePath, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'Share Attendance Sheet',
    });
  }
}

export async function exportTemplateExcel(): Promise<string> {
  const templateData = [
    {
      'Student Name': 'John Doe',
      'Roll Number': '001',
      'Barcode': 'BARCODE001',
    },
    {
      'Student Name': 'Jane Smith',
      'Roll Number': '002',
      'Barcode': 'BARCODE002',
    },
  ];
  
  const worksheet = XLSX.utils.json_to_sheet(templateData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
  
  // Generate base64 output
  const wbout = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
  const fileName = 'Student_Template.xlsx';
  
  // Create file and write base64 content
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  file.write(wbout, { encoding: 'base64' });
  
  return file.uri;
}
