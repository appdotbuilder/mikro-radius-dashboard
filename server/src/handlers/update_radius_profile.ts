import { db } from '../db';
import { radiusProfilesTable } from '../db/schema';
import { type UpdateRadiusProfileInput, type RadiusProfile } from '../schema';
import { eq } from 'drizzle-orm';

export const updateRadiusProfile = async (input: UpdateRadiusProfileInput): Promise<RadiusProfile> => {
  try {
    // First verify the profile exists
    const existingProfile = await db.select()
      .from(radiusProfilesTable)
      .where(eq(radiusProfilesTable.id, input.id))
      .execute();

    if (existingProfile.length === 0) {
      throw new Error(`Radius profile with id ${input.id} not found`);
    }

    // Build update object with only provided fields
    const updateData: Partial<typeof radiusProfilesTable.$inferInsert> = {};
    
    if (input.name !== undefined) updateData.name = input.name;
    if (input.upload_speed !== undefined) updateData.upload_speed = input.upload_speed;
    if (input.download_speed !== undefined) updateData.download_speed = input.download_speed;
    if (input.session_timeout !== undefined) updateData.session_timeout = input.session_timeout;
    if (input.idle_timeout !== undefined) updateData.idle_timeout = input.idle_timeout;
    if (input.monthly_quota !== undefined) updateData.monthly_quota = input.monthly_quota;
    if (input.price !== undefined) updateData.price = input.price !== null ? input.price.toString() : null; // Convert number to string for numeric column
    if (input.description !== undefined) updateData.description = input.description;

    // Update the profile
    const result = await db.update(radiusProfilesTable)
      .set(updateData)
      .where(eq(radiusProfilesTable.id, input.id))
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const profile = result[0];
    return {
      ...profile,
      price: profile.price ? parseFloat(profile.price) : null // Convert string back to number
    };
  } catch (error) {
    console.error('Radius profile update failed:', error);
    throw error;
  }
};