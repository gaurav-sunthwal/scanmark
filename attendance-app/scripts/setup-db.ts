import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function setupDatabase() {
  try {
    console.log('Creating tables...');

    // Create students table
    await sql`
      CREATE TABLE IF NOT EXISTS students (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        roll_number VARCHAR(100) UNIQUE NOT NULL,
        barcode VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✓ Students table created');

    // Create attendance table
    await sql`
      CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(student_id, date)
      )
    `;
    console.log('✓ Attendance table created');

    console.log('\nDatabase setup complete!');
  } catch (error) {
    console.error('Error setting up database:', error);
    process.exit(1);
  }
}

setupDatabase();
