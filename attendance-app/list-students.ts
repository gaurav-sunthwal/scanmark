import 'dotenv/config';
import { db } from './src/lib/db';
import { students } from './src/lib/db/schema';

async function listStudents() {
  const allStudents = await db.select().from(students);
  console.log('Students in database:', JSON.stringify(allStudents, null, 2));
}

listStudents();
