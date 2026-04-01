const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const students = [
  { name: 'Omkar Patel', roll_number: '1', prn: '1032233185', barcode: '1032233185' },
  { name: 'Sushant Kumar', roll_number: '2', prn: '1032231329', barcode: '1032231329' },
  { name: 'Damini Chandrakar', roll_number: '3', prn: '1032233188', barcode: '1032233188' },
  { name: 'Meha Patel', roll_number: '4', prn: '1032231163', barcode: '1032231163' },
  { name: 'Ashish Sharma', roll_number: '5', prn: '1032231907', barcode: '1032231907' },
  { name: 'Yashraj Narke', roll_number: '6', prn: '1032232513', barcode: '1032232513' },
  { name: 'Maaz Visawaderwala', roll_number: '7', prn: '1032232397', barcode: '1032232397' },
  { name: 'Om Jagdeesh', roll_number: '8', prn: '1032232632', barcode: '1032232632' },
  { name: 'Himanshu Prakash', roll_number: '9', prn: '1032233853', barcode: '1032233853' },
  { name: 'Sanyam Sharma', roll_number: '10', prn: '1032233187', barcode: '1032233187' },
  { name: 'Khushi Singh', roll_number: '11', prn: '1032233940', barcode: '1032233940' },
  { name: 'Harsh Patel', roll_number: '12', prn: '1032232829', barcode: '1032232829' },
  { name: 'Vineet M', roll_number: '13', prn: '1032232744', barcode: '1032232744' },
  { name: 'Abhinav Magesh', roll_number: '14', prn: '1032230701', barcode: '1032230701' },
  { name: 'Meghshyam Kimmatkar', roll_number: '15', prn: '1262240002', barcode: '1262240002' },
  { name: 'Vishakha Poojari', roll_number: '16', prn: '1262240013', barcode: '1262240013' },
  { name: 'Harsh Malpani', roll_number: '17', prn: '1032221973', barcode: '1032221973' },
  { name: 'Sindhura Gulhane', roll_number: '18', prn: '1032230397', barcode: '1032230397' },
  { name: 'Strelisha Lewis', roll_number: '19', prn: '1032231040', barcode: '1032231040' },
  { name: 'Zamil', roll_number: '20', prn: '1032232683', barcode: '1032232683' },
  { name: 'Amar Soni', roll_number: '21', prn: '1032231364', barcode: '1032231364' },
  { name: 'Rishika Agarwal', roll_number: '22', prn: '1032232953', barcode: '1032232953' },
  { name: 'Chahat Jain', roll_number: '23', prn: '1032231059', barcode: '1032231059' },
  { name: 'Sanya Asati', roll_number: '24', prn: '1032232956', barcode: '1032232956' },
  { name: 'Kaashvi Gupta', roll_number: '25', prn: '1032231301', barcode: '1032231301' },
  { name: 'Yash Darekar', roll_number: '26', prn: '1032231148', barcode: '1032231148' },
  { name: 'Taha Mohammedi', roll_number: '27', prn: '1032232889', barcode: '1032232889' },
  { name: 'Pooja Karaniya', roll_number: '28', prn: '1032230214', barcode: '1032230214' },
  { name: 'Siddhartha Swamy', roll_number: '29', prn: '1032230692', barcode: '1032230692' },
  { name: 'Tanushree Dharmavaram', roll_number: '30', prn: '1032232615', barcode: '1032232615' },
  { name: 'Vanshika Kaushal', roll_number: '31', prn: '1032233712', barcode: '1032233712' },
  { name: 'Yashika Raj', roll_number: '32', prn: '1032232524', barcode: '1032232524' },
  { name: 'Khushi Tiwari', roll_number: '33', prn: '1032231420', barcode: '1032231420' },
  { name: 'Vishwesh Bhat', roll_number: '34', prn: '1032232281', barcode: '1032232281' },
  { name: 'Imad Gharade', roll_number: '35', prn: '1032230935', barcode: '1032230935' },
  { name: 'Vani Sarda', roll_number: '36', prn: '1032233579', barcode: '1032233579' },
  { name: 'Sujay Chawda', roll_number: '37', prn: '1032232493', barcode: '1032232493' },
  { name: 'Darshil Patel', roll_number: '38', prn: '1032232467', barcode: '1032232467' },
  { name: 'Ayush Devdhe', roll_number: '39', prn: '1032233876', barcode: '1032233876' },
  { name: 'Lakshya Chanchlani', roll_number: '40', prn: '1032232588', barcode: '1032232588' },
  { name: 'Tanishq Patil', roll_number: '41', prn: '1032231257', barcode: '1032231257' },
  { name: 'Shubham Waditake', roll_number: '42', prn: '1032232463', barcode: '1032232463' },
  { name: 'Himanshu Gupta', roll_number: '43', prn: '1032230849', barcode: '1032230849' },
  { name: 'Pradyumna Raundal', roll_number: '44', prn: '1032232997', barcode: '1032232997' },
  { name: 'Gaurav Sunthwal', roll_number: '45', prn: '1032232584', barcode: '1032232584' },
  { name: 'Riya Naik', roll_number: '46', prn: '1032231063', barcode: '1032231063' },
];

async function seedStudents() {
  try {
    console.log('Seeding students...');
    
    // Clear existing students first
    await pool.query('DELETE FROM attendance');
    await pool.query('DELETE FROM students');
    console.log('Cleared existing data');
    
    // Insert students
    for (const student of students) {
      await pool.query(
        'INSERT INTO students (name, roll_number, barcode) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [student.name, student.roll_number, student.barcode]
      );
    }
    
    console.log(`✓ Successfully seeded ${students.length} students`);
    process.exit(0);
  } catch (error) {
    console.error('Error seeding students:', error);
    process.exit(1);
  }
}

seedStudents();
