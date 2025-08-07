import { db } from '../db';
import { radiusProfilesTable } from '../db/schema';
import { type RadiusProfile } from '../schema';
import { desc } from 'drizzle-orm';

export const getRadiusProfiles = async (): Promise<RadiusProfile[]> => {
  try {
    const results = await db.select()
      .from(radiusProfilesTable)
      .orderBy(desc(radiusProfilesTable.created_at))
      .execute();

    // Convert numeric fields back to numbers before returning
    return results.map(profile => ({
      ...profile,
      price: profile.price ? parseFloat(profile.price) : null
    }));
  } catch (error) {
    console.error('Failed to fetch radius profiles:', error);
    throw error;
  }
};