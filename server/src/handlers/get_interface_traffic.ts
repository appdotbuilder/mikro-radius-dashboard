import { db } from '../db';
import { interfaceTrafficTable } from '../db/schema';
import { type DeviceIdInput, type InterfaceTraffic } from '../schema';
import { eq, desc } from 'drizzle-orm';

export async function getInterfaceTraffic(input: DeviceIdInput): Promise<InterfaceTraffic[]> {
  try {
    // Query interface traffic data for the specified device, ordered by recorded_at desc
    const results = await db.select()
      .from(interfaceTrafficTable)
      .where(eq(interfaceTrafficTable.device_id, input.device_id))
      .orderBy(desc(interfaceTrafficTable.recorded_at))
      .execute();

    // Convert numeric fields back to numbers before returning
    return results.map(traffic => ({
      ...traffic,
      rx_bytes: parseFloat(traffic.rx_bytes),
      tx_bytes: parseFloat(traffic.tx_bytes),
      rx_packets: parseFloat(traffic.rx_packets),
      tx_packets: parseFloat(traffic.tx_packets)
    }));
  } catch (error) {
    console.error('Failed to get interface traffic:', error);
    throw error;
  }
}