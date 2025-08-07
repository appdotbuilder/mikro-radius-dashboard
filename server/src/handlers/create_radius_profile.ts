import { db } from '../db';
import { radiusProfilesTable } from '../db/schema';
import { type CreateRadiusProfileInput, type RadiusProfile } from '../schema';

export const createRadiusProfile = async (input: CreateRadiusProfileInput): Promise<RadiusProfile> => {
  try {
    // Insert radius profile record
    const result = await db.insert(radiusProfilesTable)
      .values({
        name: input.name,
        upload_speed: input.upload_speed,
        download_speed: input.download_speed,
        session_timeout: input.session_timeout,
        idle_timeout: input.idle_timeout,
        monthly_quota: input.monthly_quota,
        price: input.price ? input.price.toString() : null, // Convert number to string for numeric column
        description: input.description
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const profile = result[0];
    return {
      ...profile,
      price: profile.price ? parseFloat(profile.price) : null // Convert string back to number
    };
  } catch (error) {
    console.error('Radius profile creation failed:', error);
    throw error;
  }
};