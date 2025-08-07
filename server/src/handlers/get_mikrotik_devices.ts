import { db } from '../db';
import { mikrotikDevicesTable } from '../db/schema';
import { type MikrotikDevice } from '../schema';

export const getMikrotikDevices = async (): Promise<MikrotikDevice[]> => {
  try {
    const results = await db.select()
      .from(mikrotikDevicesTable)
      .execute();

    // Return results with proper type conversion
    return results.map(device => ({
      ...device,
      id: device.id,
      name: device.name,
      ip_address: device.ip_address,
      username: device.username,
      password: device.password,
      port: device.port,
      status: device.status,
      created_at: device.created_at,
      updated_at: device.updated_at
    }));
  } catch (error) {
    console.error('Failed to fetch Mikrotik devices:', error);
    throw error;
  }
};