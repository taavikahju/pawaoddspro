import { db } from "../server/db";
import { users } from "../shared/schema";
import { eq, isNull } from "drizzle-orm";

async function main() {
  try {
    console.log("Adding roles to existing users...");
    
    // Count users with no role
    const [{ count }] = await db
      .select({ count: count() })
      .from(users)
      .where(isNull(users.role));
      
    if (count === 0) {
      console.log("All users already have roles assigned!");
      return;
    }
    
    console.log(`Found ${count} users without roles. Updating...`);
    
    // Update all users without roles to 'user' role
    const result = await db
      .update(users)
      .set({ role: "user" })
      .where(isNull(users.role));
    
    console.log(`Updated ${result.rowCount} users with 'user' role.`);
    
    // List all admin users
    const admins = await db.select().from(users).where(eq(users.role, "admin"));
    console.log(`Currently ${admins.length} admin users in the system.`);
    
    if (admins.length > 0) {
      console.log("Admin usernames:");
      admins.forEach(admin => {
        console.log(`- ${admin.username}`);
      });
    }
    
  } catch (error) {
    console.error("Error updating user roles:", error);
  } finally {
    process.exit(0);
  }
}

main();