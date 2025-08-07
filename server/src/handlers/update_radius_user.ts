import { db } from '../db';
import { radiusUsersTable, radiusProfilesTable, activityLogsTable } from '../db/schema';
import { type UpdateRadiusUserInput, type RadiusUser } from '../schema';
import { eq } from 'drizzle-orm';
import { createHash } from 'crypto';

export const updateRadiusUser = async (input: UpdateRadiusUserInput): Promise<RadiusUser> => {
  try {
    // Verify the user exists
    const existingUser = await db.select()
      .from(radiusUsersTable)
      .where(eq(radiusUsersTable.id, input.id))
      .limit(1)
      .execute();

    if (existingUser.length === 0) {
      throw new Error(`Radius user with id ${input.id} not found`);
    }

    // Validate profile_id exists if provided
    if (input.profile_id !== undefined) {
      const profileExists = await db.select()
        .from(radiusProfilesTable)
        .where(eq(radiusProfilesTable.id, input.profile_id))
        .limit(1)
        .execute();

      if (profileExists.length === 0) {
        throw new Error(`Radius profile with id ${input.profile_id} not found`);
      }
    }

    // Prepare update data
    const updateData: any = {};
    
    if (input.password !== undefined) {
      // Hash the password using MD5 (common for RADIUS)
      updateData.password = createHash('md5').update(input.password).digest('hex');
    }
    
    if (input.profile_id !== undefined) updateData.profile_id = input.profile_id;
    if (input.full_name !== undefined) updateData.full_name = input.full_name;
    if (input.email !== undefined) updateData.email = input.email;
    if (input.phone !== undefined) updateData.phone = input.phone;
    if (input.address !== undefined) updateData.address = input.address;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.expires_at !== undefined) updateData.expires_at = input.expires_at;

    // Update the user record
    const result = await db.update(radiusUsersTable)
      .set(updateData)
      .where(eq(radiusUsersTable.id, input.id))
      .returning()
      .execute();

    const updatedUser = result[0];

    // Create activity log entry
    await db.insert(activityLogsTable)
      .values({
        user_id: updatedUser.id,
        username: updatedUser.username,
        action: 'account_updated',
        ip_address: null,
        mac_address: null,
        bytes_in: null,
        bytes_out: null,
        session_duration: null
      })
      .execute();

    // Return the updated user
    return updatedUser;
  } catch (error) {
    console.error('Radius user update failed:', error);
    throw error;
  }
};