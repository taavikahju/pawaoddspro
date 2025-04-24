import { db } from "../server/db";
import { migrate } from "drizzle-orm/postgres-js/migrator";

async function main() {
  try {
    console.log("Adding role column to users table if it doesn't exist...");
    await db.execute(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
    `);
    
    console.log("Role column added successfully!");
  } catch (error) {
    console.error("Error adding role column:", error);
  } finally {
    process.exit(0);
  }
}

main();