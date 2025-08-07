import { db } from '../db';
import { mikrotikDevicesTable } from '../db/schema';
import { type UpdateMikrotikDeviceInput, type MikrotikDevice } from '../schema';
import { eq } from 'drizzle-orm';

export const updateMikrotikDevice = async (input: UpdateMikrotikDeviceInput): Promise<MikrotikDevice> => {
  try {
    // First, verify the device exists
    const existingDevice = await db.select()
      .from(mikrotikDevicesTable)
      .where(eq(mikrotikDevicesTable.id, input.id))
      .execute();

    if (existingDevice.length === 0) {
      throw new Error(`Mikrotik device with id ${input.id} not found`);
    }

    // Build the update object with only the fields that are provided
    const updateData: Record<string, any> = {
      updated_at: new Date()
    };

    if (input.name !== undefined) {
      updateData['name'] = input.name;
    }
    if (input.ip_address !== undefined) {
      updateData['ip_address'] = input.ip_address;
    }
    if (input.username !== undefined) {
      updateData['username'] = input.username;
    }
    if (input.password !== undefined) {
      updateData['password'] = input.password;
    }
    if (input.port !== undefined) {
      updateData['port'] = input.port;
    }

    // Update the device record
    const result = await db.update(mikrotikDevicesTable)
      .set(updateData)
      .where(eq(mikrotikDevicesTable.id, input.id))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Mikrotik device update failed:', error);
    throw error;
  }
};