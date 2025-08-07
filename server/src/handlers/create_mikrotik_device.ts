import { db } from '../db';
import { mikrotikDevicesTable } from '../db/schema';
import { type CreateMikrotikDeviceInput, type MikrotikDevice } from '../schema';

export const createMikrotikDevice = async (input: CreateMikrotikDeviceInput): Promise<MikrotikDevice> => {
  try {
    // Insert the device record with initial status as 'offline'
    const result = await db.insert(mikrotikDevicesTable)
      .values({
        name: input.name,
        ip_address: input.ip_address,
        username: input.username,
        password: input.password,
        port: input.port, // This comes with default from schema
        status: 'offline' // Start as offline until connection is verified
      })
      .returning()
      .execute();

    const device = result[0];
    return device;
  } catch (error) {
    console.error('Mikrotik device creation failed:', error);
    throw error;
  }
};