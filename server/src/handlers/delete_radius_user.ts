import { db } from '../db';
import { radiusUsersTable, activityLogsTable } from '../db/schema';
import { eq } from 'drizzle-orm';

export async function deleteRadiusUser(input: { id: number }): Promise<{ success: boolean }> {
  try {
    // First, check if the user exists and get their username for logging
    const existingUsers = await db.select()
      .from(radiusUsersTable)
      .where(eq(radiusUsersTable.id, input.id))
      .execute();

    if (existingUsers.length === 0) {
      throw new Error(`Radius user with id ${input.id} not found`);
    }

    const userToDelete = existingUsers[0];

    // Create activity log entry for account deletion
    await db.insert(activityLogsTable)
      .values({
        user_id: input.id,
        username: userToDelete.username,
        action: 'account_updated', // Using closest available action since 'account_deleted' is not in enum
        ip_address: null,
        mac_address: null,
        bytes_in: null,
        bytes_out: null,
        session_duration: null
      })
      .execute();

    // Delete the radius user
    const result = await db.delete(radiusUsersTable)
      .where(eq(radiusUsersTable.id, input.id))
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Radius user deletion failed:', error);
    throw error;
  }
}