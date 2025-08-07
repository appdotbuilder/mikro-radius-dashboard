import { db } from '../db';
import { mikrotikMonitoringTable } from '../db/schema';
import { type DeviceIdInput, type MikrotikMonitoring } from '../schema';
import { eq, desc } from 'drizzle-orm';

export async function getDeviceMonitoring(input: DeviceIdInput): Promise<MikrotikMonitoring[]> {
  try {
    // Query monitoring data for the specific device, ordered by most recent first
    const results = await db.select()
      .from(mikrotikMonitoringTable)
      .where(eq(mikrotikMonitoringTable.device_id, input.device_id))
      .orderBy(desc(mikrotikMonitoringTable.recorded_at))
      .execute();

    // Convert numeric fields from strings to numbers
    return results.map(monitoring => ({
      ...monitoring,
      cpu_usage: parseFloat(monitoring.cpu_usage),
      ram_usage: parseFloat(monitoring.ram_usage),
      total_ram: parseFloat(monitoring.total_ram)
    }));
  } catch (error) {
    console.error('Failed to fetch device monitoring data:', error);
    throw error;
  }
}