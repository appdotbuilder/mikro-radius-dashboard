import { db } from '../db';
import { radiusUsersTable } from '../db/schema';
import { type RadiusUser } from '../schema';

export const getRadiusUsers = async (): Promise<RadiusUser[]> => {
  try {
    const results = await db.select()
      .from(radiusUsersTable)
      .execute();

    // Convert numeric fields back to numbers before returning
    return results.map(user => ({
      ...user,
      // No numeric conversions needed for radius users table
      // All numeric fields (profile_id, id) are integers
      // created_at and expires_at are already Date objects from timestamp columns
    }));
  } catch (error) {
    console.error('Failed to fetch radius users:', error);
    throw error;
  }
};