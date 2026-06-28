import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function check() {
  const { db } = await import('../src/lib/db');
  const { students } = await import('../src/lib/db/schema');

  const allStudents = await db.select().from(students).limit(5);
  console.log('Sample IDs:', allStudents.map(s => ({ id: s.id, name: s.name })));
}

check().catch(console.error);
