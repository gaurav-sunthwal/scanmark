import { db } from '../src/lib/db';
import { students } from '../src/lib/db/schema';

async function check() {
  const allStudents = await db.select().from(students).limit(5);
  console.log('Sample IDs:', allStudents.map(s => ({ id: s.id, name: s.name })));
}

check().catch(console.error);
