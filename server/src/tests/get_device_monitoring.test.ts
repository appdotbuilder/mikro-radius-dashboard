import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { mikrotikDevicesTable, mikrotikMonitoringTable } from '../db/schema';
import { type DeviceIdInput } from '../schema';
import { getDeviceMonitoring } from '../handlers/get_device_monitoring';
import { eq } from 'drizzle-orm';

describe('getDeviceMonitoring', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return monitoring data for a specific device', async () => {
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

    // Create test monitoring data
    const monitoringData = [
      {
        device_id: deviceId,
        cpu_usage: '15.50',
        ram_usage: '512.75',
        total_ram: '1024.00',
        uptime: '1d 5h 30m'
      },
      {
        device_id: deviceId,
        cpu_usage: '22.30',
        ram_usage: '600.25',
        total_ram: '1024.00',
        uptime: '1d 5h 31m'
      }
    ];

    await db.insert(mikrotikMonitoringTable)
      .values(monitoringData)
      .execute();

    const input: DeviceIdInput = { device_id: deviceId };
    const result = await getDeviceMonitoring(input);

    // Should return 2 monitoring records
    expect(result).toHaveLength(2);

    // Check the structure and data types
    result.forEach(monitoring => {
      expect(monitoring.device_id).toBe(deviceId);
      expect(typeof monitoring.cpu_usage).toBe('number');
      expect(typeof monitoring.ram_usage).toBe('number');
      expect(typeof monitoring.total_ram).toBe('number');
      expect(typeof monitoring.uptime).toBe('string');
      expect(monitoring.recorded_at).toBeInstanceOf(Date);
      expect(monitoring.id).toBeDefined();
    });

    // Check that numeric values are correctly parsed
    expect(result.some(m => m.cpu_usage === 15.5 || m.cpu_usage === 22.3)).toBe(true);
    expect(result.some(m => m.ram_usage === 512.75 || m.ram_usage === 600.25)).toBe(true);
    expect(result.every(m => m.total_ram === 1024)).toBe(true);
  });

  it('should return results ordered by most recent first', async () => {
    // Create a test device
    const deviceResult = await db.insert(mikrotikDevicesTable)
      .values({
        name: 'Test Router',
        ip_address: '192.168.1.1',
        username: 'admin',
        password: 'password'
      })
      .returning()
      .execute();

    const deviceId = deviceResult[0].id;

    // Create monitoring data with different timestamps
    const oldDate = new Date('2024-01-01T10:00:00Z');
    const newDate = new Date('2024-01-01T12:00:00Z');

    // Insert older record first
    await db.insert(mikrotikMonitoringTable)
      .values({
        device_id: deviceId,
        cpu_usage: '10.00',
        ram_usage: '400.00',
        total_ram: '1024.00',
        uptime: '1d 3h',
        recorded_at: oldDate
      })
      .execute();

    // Insert newer record
    await db.insert(mikrotikMonitoringTable)
      .values({
        device_id: deviceId,
        cpu_usage: '20.00',
        ram_usage: '500.00',
        total_ram: '1024.00',
        uptime: '1d 5h',
        recorded_at: newDate
      })
      .execute();

    const input: DeviceIdInput = { device_id: deviceId };
    const result = await getDeviceMonitoring(input);

    expect(result).toHaveLength(2);
    // Most recent should be first
    expect(result[0].cpu_usage).toBe(20);
    expect(result[0].recorded_at).toEqual(newDate);
    expect(result[1].cpu_usage).toBe(10);
    expect(result[1].recorded_at).toEqual(oldDate);
  });

  it('should return empty array when no monitoring data exists for device', async () => {
    // Create a device but no monitoring data
    const deviceResult = await db.insert(mikrotikDevicesTable)
      .values({
        name: 'Empty Router',
        ip_address: '192.168.1.2',
        username: 'admin',
        password: 'password'
      })
      .returning()
      .execute();

    const input: DeviceIdInput = { device_id: deviceResult[0].id };
    const result = await getDeviceMonitoring(input);

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should return empty array for non-existent device', async () => {
    const input: DeviceIdInput = { device_id: 9999 };
    const result = await getDeviceMonitoring(input);

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should only return data for the specified device', async () => {
    // Create two devices
    const device1Result = await db.insert(mikrotikDevicesTable)
      .values({
        name: 'Router 1',
        ip_address: '192.168.1.1',
        username: 'admin',
        password: 'password'
      })
      .returning()
      .execute();

    const device2Result = await db.insert(mikrotikDevicesTable)
      .values({
        name: 'Router 2',
        ip_address: '192.168.1.2',
        username: 'admin',
        password: 'password'
      })
      .returning()
      .execute();

    const device1Id = device1Result[0].id;
    const device2Id = device2Result[0].id;

    // Create monitoring data for both devices
    await db.insert(mikrotikMonitoringTable)
      .values([
        {
          device_id: device1Id,
          cpu_usage: '15.00',
          ram_usage: '500.00',
          total_ram: '1024.00',
          uptime: '1d'
        },
        {
          device_id: device2Id,
          cpu_usage: '25.00',
          ram_usage: '600.00',
          total_ram: '2048.00',
          uptime: '2d'
        }
      ])
      .execute();

    // Query for device 1 only
    const input: DeviceIdInput = { device_id: device1Id };
    const result = await getDeviceMonitoring(input);

    expect(result).toHaveLength(1);
    expect(result[0].device_id).toBe(device1Id);
    expect(result[0].cpu_usage).toBe(15);
    expect(result[0].ram_usage).toBe(500);
    expect(result[0].total_ram).toBe(1024);
  });

  it('should handle monitoring data with decimal values correctly', async () => {
    // Create a test device
    const deviceResult = await db.insert(mikrotikDevicesTable)
      .values({
        name: 'Test Router',
        ip_address: '192.168.1.1',
        username: 'admin',
        password: 'password'
      })
      .returning()
      .execute();

    const deviceId = deviceResult[0].id;

    // Create monitoring data with precise decimal values
    await db.insert(mikrotikMonitoringTable)
      .values({
        device_id: deviceId,
        cpu_usage: '87.65',
        ram_usage: '1536.75',
        total_ram: '2048.00',
        uptime: '5d 12h 30m 45s'
      })
      .execute();

    const input: DeviceIdInput = { device_id: deviceId };
    const result = await getDeviceMonitoring(input);

    expect(result).toHaveLength(1);
    expect(result[0].cpu_usage).toBe(87.65);
    expect(result[0].ram_usage).toBe(1536.75);
    expect(result[0].total_ram).toBe(2048);
    expect(result[0].uptime).toBe('5d 12h 30m 45s');
  });
});