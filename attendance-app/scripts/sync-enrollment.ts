import { db } from '../src/lib/db';
import { students } from '../src/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';

async function syncEnrollment() {
  console.log('Starting enrollment synchronization across classes...');
  
  // 1. Get all roll numbers that are enrolled in at least one class
  const enrolledStudents = await db.select({
    rollNumber: students.rollNumber,
    userId: students.userId
  })
  .from(students)
  .where(eq(students.isFaceEnrolled, 1));
  
  if (enrolledStudents.length === 0) {
    console.log('No enrolled students found to sync.');
    return;
  }
  
  // Create a map of roll numbers to user IDs to avoid duplicates
  const rollNumbersToSync = Array.from(new Set(enrolledStudents.map(s => s.rollNumber)));
  
  console.log(`Found ${rollNumbersToSync.length} enrolled students. Syncing status to all classes...`);
  
  // 2. Update all students with these roll numbers
  // Note: We're doing this per roll number for safety (keeping it simple)
  let updatedCount = 0;
  for (const rollNumber of rollNumbersToSync) {
    const result = await db.update(students)
      .set({ isFaceEnrolled: 1 })
      .where(eq(students.rollNumber, rollNumber));
    updatedCount++;
  }
  
  console.log(`Successfully synchronized ${updatedCount} students across all their classes.`);
}

syncEnrollment().catch(console.error);
