import { pgTable, serial, text, varchar, timestamp, integer, date, unique } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const classes = pgTable('classes', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const students = pgTable('students', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  classId: integer('class_id').notNull().references(() => classes.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  rollNumber: varchar('roll_number', { length: 100 }).notNull(),
  barcode: varchar('barcode', { length: 255 }).notNull(),

  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  classRollUnique: unique().on(t.classId, t.rollNumber),
  classBarcodeUnique: unique().on(t.classId, t.barcode),
}));

export const attendance = pgTable('attendance', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  classId: integer('class_id').notNull().references(() => classes.id, { onDelete: 'cascade' }),
  studentId: integer('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  status: varchar('status', { length: 20 }).notNull(), // 'present', 'absent'
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  studentClassDateUnique: unique().on(t.studentId, t.classId, t.date),
}));
