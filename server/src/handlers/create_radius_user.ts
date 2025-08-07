import { db } from '../db';
import { radiusUsersTable, radiusProfilesTable, activityLogsTable } from '../db/schema';
import { type CreateRadiusUserInput, type RadiusUser } from '../schema';
import { eq } from 'drizzle-orm';
import { createHash, randomBytes, pbkdf2Sync } from 'crypto';

// Helper function to hash passwords using Node.js crypto
function hashPassword(password: string): string {
  const salt = randomBytes(32).toString('hex');
  const hash = pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

// Helper function to verify passwords
function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  const verifyHash = pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

export async function createRadiusUser(input: CreateRadiusUserInput): Promise<RadiusUser> {
  try {
    // Validate that the profile exists
    const profile = await db.select()
      .from(radiusProfilesTable)
      .where(eq(radiusProfilesTable.id, input.profile_id))
      .execute();

    if (profile.length === 0) {
      throw new Error(`Profile with ID ${input.profile_id} does not exist`);
    }

    // Check username uniqueness
    const existingUser = await db.select()
      .from(radiusUsersTable)
      .where(eq(radiusUsersTable.username, input.username))
      .execute();

    if (existingUser.length > 0) {
      throw new Error(`Username ${input.username} already exists`);
    }

    // Hash the password
    const hashedPassword = hashPassword(input.password);

    // Insert the new user
    const result = await db.insert(radiusUsersTable)
      .values({
        username: input.username,
        password: hashedPassword,
        profile_id: input.profile_id,
        full_name: input.full_name,
        email: input.email,
        phone: input.phone,
        address: input.address,
        expires_at: input.expires_at
      })
      .returning()
      .execute();

    const newUser = result[0];

    // Create activity log entry for account creation
    await db.insert(activityLogsTable)
      .values({
        user_id: newUser.id,
        username: newUser.username,
        action: 'account_created'
      })
      .execute();

    // Convert numeric fields and return
    return {
      ...newUser,
      // No numeric fields to convert in this case
    };
  } catch (error) {
    console.error('Radius user creation failed:', error);
    throw error;
  }
}

// Export the verification function for testing
export { verifyPassword };