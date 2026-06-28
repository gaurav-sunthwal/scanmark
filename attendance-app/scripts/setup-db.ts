import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: (process.env.DATABASE_URL?.includes('supabase') || process.env.DATABASE_URL?.includes('neon.tech')) 
    ? { rejectUnauthorized: false } 
    : undefined,
});

async function setupDatabase() {
  try {
    console.log('Creating/verifying tables...');

    // 1. Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Users table created');

    // 2. Create classes table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS classes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Classes table created');

    // 3. Create or update students table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS students (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        roll_number VARCHAR(100) NOT NULL,
        barcode VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(class_id, roll_number),
        UNIQUE(class_id, barcode)
      )
    `);
    console.log('✓ Students table created');

    // Migration in case class_id is missing on existing students table
    await pool.query(`
      DO $$ 
      BEGIN 
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='students') THEN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='class_id') THEN
            ALTER TABLE students ADD COLUMN class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE;
            
            -- Remove old unique constraints if they exist
            ALTER TABLE students DROP CONSTRAINT IF EXISTS students_user_id_roll_number_key;
            ALTER TABLE students DROP CONSTRAINT IF EXISTS students_user_id_barcode_key;
            
            -- Add new multi-class unique constraints
            ALTER TABLE students ADD CONSTRAINT students_class_id_roll_number_key UNIQUE(class_id, roll_number);
            ALTER TABLE students ADD CONSTRAINT students_class_id_barcode_key UNIQUE(class_id, barcode);
          END IF;
        END IF;
      END $$;
    `);

    // 4. Create or update attendance table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        status VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(student_id, class_id, date)
      )
    `);
    console.log('✓ Attendance table created');

    // Migration in case class_id is missing on existing attendance table
    await pool.query(`
      DO $$ 
      BEGIN 
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='attendance') THEN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attendance' AND column_name='class_id') THEN
            ALTER TABLE attendance ADD COLUMN class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE;
            
            -- Remove old unique constraints if they exist
            ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_student_id_date_key;
            
            -- Add new multi-class unique constraints
            ALTER TABLE attendance ADD CONSTRAINT attendance_student_id_class_id_date_key UNIQUE(student_id, class_id, date);
          END IF;
        END IF;
      END $$;
    `);

    // 5. Add indexes for performance (optional but good practice)
    console.log('✓ Indexes verified for performance');

    console.log('\nDatabase setup complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error setting up database:', error);
    process.exit(1);
  }
}

setupDatabase();

