import { db } from "../server/db";
import { users } from "../shared/schema";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { eq } from "drizzle-orm";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function main() {
  try {
    // Default admin credentials that can be changed after first login
    const adminUsername = "admin";
    const adminPassword = "adminpassword"; // Will be hashed before storage
    
    console.log("Checking if admin user exists...");
    const [existingAdmin] = await db.select().from(users).where(eq(users.username, adminUsername));
    
    if (existingAdmin) {
      console.log("Admin user already exists!");
      
      // Update role to admin if it isn't already
      if (existingAdmin.role !== "admin") {
        console.log("Updating existing user to admin role...");
        await db.update(users)
          .set({ role: "admin" })
          .where(eq(users.id, existingAdmin.id));
        console.log("User role updated to admin!");
      }
    } else {
      console.log("Creating admin user...");
      const hashedPassword = await hashPassword(adminPassword);
      
      await db.insert(users).values({
        username: adminUsername,
        password: hashedPassword,
        role: "admin"
      });
      
      console.log("Admin user created successfully!");
      console.log("Username: admin");
      console.log("Password: adminpassword");
      console.log("IMPORTANT: Please change the admin password after first login");
    }
  } catch (error) {
    console.error("Error creating/updating admin user:", error);
  } finally {
    process.exit(0);
  }
}

main();