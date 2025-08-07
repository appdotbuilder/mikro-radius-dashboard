import { db } from '../db';
import { radiusProfilesTable, radiusUsersTable } from '../db/schema';
import { eq } from 'drizzle-orm';

export async function deleteRadiusProfile(input: { id: number }): Promise<{ success: boolean }> {
  try {
    // First, check if the profile exists
    const existingProfile = await db.select()
      .from(radiusProfilesTable)
      .where(eq(radiusProfilesTable.id, input.id))
      .execute();

    if (existingProfile.length === 0) {
      throw new Error(`Radius profile with id ${input.id} not found`);
    }

    // Check for dependent users
    const dependentUsers = await db.select()
      .from(radiusUsersTable)
      .where(eq(radiusUsersTable.profile_id, input.id))
      .execute();

    if (dependentUsers.length > 0) {
      throw new Error(`Cannot delete profile: ${dependentUsers.length} users are still using this profile`);
    }

    // Delete the profile
    const result = await db.delete(radiusProfilesTable)
      .where(eq(radiusProfilesTable.id, input.id))
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Profile deletion failed:', error);
    throw error;
  }
}