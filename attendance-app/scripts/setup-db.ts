import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost/attendance',
  ssl: process.env.DATABASE_URL?.includes('supabase') ? { rejectUnauthorized: false } : undefined,
});

async function setupDatabase() {
  try {
    console.log('Creating tables...');

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

    // 3. Update students table (add class_id if missing)
    await pool.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='class_id') THEN
          ALTER TABLE students ADD COLUMN class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE;
          
          -- Remove old unique constraints if they exist
          ALTER TABLE students DROP CONSTRAINT IF EXISTS students_user_id_roll_number_key;
          ALTER TABLE students DROP CONSTRAINT IF EXISTS students_user_id_barcode_key;
          
          -- Add new multi-class unique constraints
          ALTER TABLE students ADD CONSTRAINT students_class_id_roll_number_key UNIQUE(class_id, roll_number);
          ALTER TABLE students ADD CONSTRAINT students_class_id_barcode_key UNIQUE(class_id, barcode);
        END IF;
      END $$;
    `);
    console.log('✓ Students table updated with class_id');

    // 4. Update attendance table (add class_id if missing)
    await pool.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attendance' AND column_name='class_id') THEN
          ALTER TABLE attendance ADD COLUMN class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE;
          
          -- Remove old unique constraints if they exist
          ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_student_id_date_key;
          
          -- Add new multi-class unique constraints
          ALTER TABLE attendance ADD CONSTRAINT attendance_student_id_class_id_date_key UNIQUE(student_id, class_id, date);
        END IF;
      END $$;
    `);
    // 5. Add indexes for performance
    console.log('✓ Indexes created for performance');
    
    // 6. Face Recognition Columns
    await pool.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='face_descriptor') THEN
          ALTER TABLE students ADD COLUMN face_descriptor TEXT;
          ALTER TABLE students ADD COLUMN photo_urls TEXT;
        END IF;
      END $$;
    `);
    console.log('✓ Students table updated with face recognition columns');

    console.log('\nDatabase setup complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error setting up database:', error);
    process.exit(1);
  }
}

setupDatabase();
