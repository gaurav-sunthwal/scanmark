const { Client } = require('pg');
require('dotenv').config();

async function sync() {
  console.log('Syncing enrollment across classes...');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  
  try {
    // Find roll numbers that are enrolled in any class
    const res = await client.query('SELECT DISTINCT roll_number FROM students WHERE is_face_enrolled = 1');
    
    if (res.rows.length === 0) {
      console.log('No enrolled students found.');
      return;
    }
    
    const rolls = res.rows.map(r => r.roll_number);
    console.log(`Found ${rolls.length} enrolled students. Updating all class records...`);
    
    // Update all students with these roll numbers
    const updateRes = await client.query('UPDATE students SET is_face_enrolled = 1 WHERE roll_number = ANY($1)', [rolls]);
    
    console.log(`Sync complete. Updated ${updateRes.rowCount} records.`);
  } finally {
    await client.end();
  }
}

sync().catch(err => {
  console.error(err);
  process.exit(1);
});
