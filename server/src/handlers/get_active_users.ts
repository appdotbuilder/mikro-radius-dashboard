import { db } from '../db';
import { activeUsersTable } from '../db/schema';
import { type DeviceIdInput, type ActiveUser } from '../schema';
import { eq } from 'drizzle-orm';

export async function getActiveUsers(input: DeviceIdInput): Promise<ActiveUser[]> {
  try {
    // Query active users for the specific device
    const results = await db.select()
      .from(activeUsersTable)
      .where(eq(activeUsersTable.device_id, input.device_id))
      .execute();

    // Convert numeric fields from strings to numbers
    return results.map(user => ({
      ...user,
      bytes_in: parseFloat(user.bytes_in),
      bytes_out: parseFloat(user.bytes_out)
    }));
  } catch (error) {
    console.error('Failed to fetch active users:', error);
    throw error;
  }
}