import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { interfaceTrafficTable, mikrotikDevicesTable } from '../db/schema';
import { type DeviceIdInput } from '../schema';
import { getInterfaceTraffic } from '../handlers/get_interface_traffic';
import { eq } from 'drizzle-orm';

describe('getInterfaceTraffic', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return interface traffic data for a device', async () => {
    // Create a test device first
    const deviceResult = await db.insert(mikrotikDevicesTable)
      .values({
        name: 'Test Router',
        ip_address: '192.168.1.1',
        username: 'admin',
        password: 'password',
        port: 8728,
        status: 'online'
      })
      .returning()
      .execute();

    const deviceId = deviceResult[0].id;

    // Create test interface traffic data
    await db.insert(interfaceTrafficTable)
      .values([
        {
          device_id: deviceId,
          interface_name: 'ether1',
          rx_bytes: '1000000',
          tx_bytes: '500000',
          rx_packets: '1000',
          tx_packets: '800'
        },
        {
          device_id: deviceId,
          interface_name: 'ether2',
          rx_bytes: '2000000',
          tx_bytes: '1000000',
          rx_packets: '2000',
          tx_packets: '1600'
        }
      ])
      .execute();

    const input: DeviceIdInput = { device_id: deviceId };
    const result = await getInterfaceTraffic(input);

    expect(result).toHaveLength(2);
    
    // Check that numeric fields are properly converted to numbers
    result.forEach(traffic => {
      expect(typeof traffic.rx_bytes).toBe('number');
      expect(typeof traffic.tx_bytes).toBe('number');
      expect(typeof traffic.rx_packets).toBe('number');
      expect(typeof traffic.tx_packets).toBe('number');
      expect(traffic.device_id).toBe(deviceId);
      expect(traffic.recorded_at).toBeInstanceOf(Date);
    });

    // Check specific values (ordered by recorded_at desc)
    const traffic1 = result.find(t => t.interface_name === 'ether1');
    const traffic2 = result.find(t => t.interface_name === 'ether2');

    expect(traffic1).toBeDefined();
    expect(traffic1!.rx_bytes).toBe(1000000);
    expect(traffic1!.tx_bytes).toBe(500000);
    expect(traffic1!.rx_packets).toBe(1000);
    expect(traffic1!.tx_packets).toBe(800);

    expect(traffic2).toBeDefined();
    expect(traffic2!.rx_bytes).toBe(2000000);
    expect(traffic2!.tx_bytes).toBe(1000000);
    expect(traffic2!.rx_packets).toBe(2000);
    expect(traffic2!.tx_packets).toBe(1600);
  });

  it('should return empty array for device with no traffic data', async () => {
    // Create a test device first
    const deviceResult = await db.insert(mikrotikDevicesTable)
      .values({
        name: 'Empty Router',
        ip_address: '192.168.1.2',
        username: 'admin',
        password: 'password',
        port: 8728,
        status: 'online'
      })
      .returning()
      .execute();

    const deviceId = deviceResult[0].id;

    const input: DeviceIdInput = { device_id: deviceId };
    const result = await getInterfaceTraffic(input);

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should return empty array for non-existent device', async () => {
    const input: DeviceIdInput = { device_id: 99999 };
    const result = await getInterfaceTraffic(input);

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should order results by recorded_at desc (most recent first)', async () => {
    // Create a test device first
    const deviceResult = await db.insert(mikrotikDevicesTable)
      .values({
        name: 'Time Test Router',
        ip_address: '192.168.1.3',
        username: 'admin',
        password: 'password',
        port: 8728,
        status: 'online'
      })
      .returning()
      .execute();

    const deviceId = deviceResult[0].id;

    // Create traffic data with different timestamps (insert in reverse chronological order)
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    // Insert older record first
    await db.insert(interfaceTrafficTable)
      .values({
        device_id: deviceId,
        interface_name: 'ether1',
        rx_bytes: '1000000',
        tx_bytes: '500000',
        rx_packets: '1000',
        tx_packets: '800',
        recorded_at: twoHoursAgo
      })
      .execute();

    // Insert newer record
    await db.insert(interfaceTrafficTable)
      .values({
        device_id: deviceId,
        interface_name: 'ether1',
        rx_bytes: '2000000',
        tx_bytes: '1000000',
        rx_packets: '2000',
        tx_packets: '1600',
        recorded_at: oneHourAgo
      })
      .execute();

    const input: DeviceIdInput = { device_id: deviceId };
    const result = await getInterfaceTraffic(input);

    expect(result).toHaveLength(2);
    
    // Most recent should be first
    expect(result[0].recorded_at.getTime()).toBeGreaterThan(result[1].recorded_at.getTime());
    expect(result[0].rx_bytes).toBe(2000000); // More recent data
    expect(result[1].rx_bytes).toBe(1000000); // Older data
  });

  it('should save and retrieve traffic data correctly from database', async () => {
    // Create a test device first
    const deviceResult = await db.insert(mikrotikDevicesTable)
      .values({
        name: 'DB Test Router',
        ip_address: '192.168.1.4',
        username: 'admin',
        password: 'password'
      })
      .returning()
      .execute();

    const deviceId = deviceResult[0].id;

    // Insert test traffic data
    const insertResult = await db.insert(interfaceTrafficTable)
      .values({
        device_id: deviceId,
        interface_name: 'wlan1',
        rx_bytes: '5000000',
        tx_bytes: '3000000',
        rx_packets: '5000',
        tx_packets: '4000'
      })
      .returning()
      .execute();

    const trafficId = insertResult[0].id;

    // Retrieve using our handler
    const input: DeviceIdInput = { device_id: deviceId };
    const handlerResult = await getInterfaceTraffic(input);

    expect(handlerResult).toHaveLength(1);
    expect(handlerResult[0].id).toBe(trafficId);
    expect(handlerResult[0].interface_name).toBe('wlan1');
    expect(handlerResult[0].rx_bytes).toBe(5000000);
    expect(handlerResult[0].tx_bytes).toBe(3000000);

    // Verify data is actually in the database
    const dbResult = await db.select()
      .from(interfaceTrafficTable)
      .where(eq(interfaceTrafficTable.id, trafficId))
      .execute();

    expect(dbResult).toHaveLength(1);
    expect(dbResult[0].interface_name).toBe('wlan1');
    expect(parseFloat(dbResult[0].rx_bytes)).toBe(5000000);
    expect(parseFloat(dbResult[0].tx_bytes)).toBe(3000000);
  });
});