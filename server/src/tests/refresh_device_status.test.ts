import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { mikrotikDevicesTable } from '../db/schema';
import { type DeviceIdInput } from '../schema';
import { refreshDeviceStatus } from '../handlers/refresh_device_status';
import { eq } from 'drizzle-orm';

describe('refreshDeviceStatus', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testDeviceId: number;

  beforeEach(async () => {
    // Create a test device before each test
    const result = await db.insert(mikrotikDevicesTable)
      .values({
        name: 'Test Device',
        ip_address: '192.168.1.1',
        username: 'admin',
        password: 'password',
        port: 8728,
        status: 'offline'
      })
      .returning()
      .execute();
    
    testDeviceId = result[0].id;
  });

  it('should refresh device status to online for reachable device', async () => {
    const input: DeviceIdInput = {
      device_id: testDeviceId
    };

    const result = await refreshDeviceStatus(input);

    // Verify return value
    expect(result.id).toEqual(testDeviceId);
    expect(result.name).toEqual('Test Device');
    expect(result.ip_address).toEqual('192.168.1.1');
    expect(result.username).toEqual('admin');
    expect(result.password).toEqual('password');
    expect(result.port).toEqual(8728);
    expect(result.status).toEqual('online');
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);

    // Verify database was updated
    const devices = await db.select()
      .from(mikrotikDevicesTable)
      .where(eq(mikrotikDevicesTable.id, testDeviceId))
      .execute();

    expect(devices).toHaveLength(1);
    expect(devices[0].status).toEqual('online');
    expect(devices[0].updated_at).toBeInstanceOf(Date);
  });

  it('should refresh device status to offline for unreachable device', async () => {
    // Create device with unreachable IP
    const unreachableResult = await db.insert(mikrotikDevicesTable)
      .values({
        name: 'Unreachable Device',
        ip_address: '192.168.1.999', // This will simulate unreachable
        username: 'admin',
        password: 'password',
        port: 8728,
        status: 'online' // Start as online to test status change
      })
      .returning()
      .execute();

    const input: DeviceIdInput = {
      device_id: unreachableResult[0].id
    };

    const result = await refreshDeviceStatus(input);

    expect(result.id).toEqual(unreachableResult[0].id);
    expect(result.status).toEqual('offline');
    expect(result.updated_at).toBeInstanceOf(Date);

    // Verify database was updated
    const devices = await db.select()
      .from(mikrotikDevicesTable)
      .where(eq(mikrotikDevicesTable.id, unreachableResult[0].id))
      .execute();

    expect(devices[0].status).toEqual('offline');
  });

  it('should refresh device status to error for connection issues', async () => {
    // Create device with error-prone IP
    const errorResult = await db.insert(mikrotikDevicesTable)
      .values({
        name: 'Error Device',
        ip_address: '192.168.1.500', // This will simulate connection error
        username: 'admin',
        password: 'password',
        port: 8728,
        status: 'online'
      })
      .returning()
      .execute();

    const input: DeviceIdInput = {
      device_id: errorResult[0].id
    };

    const result = await refreshDeviceStatus(input);

    expect(result.id).toEqual(errorResult[0].id);
    expect(result.status).toEqual('error');
    expect(result.updated_at).toBeInstanceOf(Date);

    // Verify database was updated
    const devices = await db.select()
      .from(mikrotikDevicesTable)
      .where(eq(mikrotikDevicesTable.id, errorResult[0].id))
      .execute();

    expect(devices[0].status).toEqual('error');
  });

  it('should update the updated_at timestamp', async () => {
    const input: DeviceIdInput = {
      device_id: testDeviceId
    };

    // Get original timestamp
    const originalDevice = await db.select()
      .from(mikrotikDevicesTable)
      .where(eq(mikrotikDevicesTable.id, testDeviceId))
      .execute();

    const originalTimestamp = originalDevice[0].updated_at;

    // Wait a bit to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    const result = await refreshDeviceStatus(input);

    expect(result.updated_at.getTime()).toBeGreaterThan(originalTimestamp.getTime());

    // Verify in database
    const updatedDevice = await db.select()
      .from(mikrotikDevicesTable)
      .where(eq(mikrotikDevicesTable.id, testDeviceId))
      .execute();

    expect(updatedDevice[0].updated_at.getTime()).toBeGreaterThan(originalTimestamp.getTime());
  });

  it('should throw error for non-existent device', async () => {
    const input: DeviceIdInput = {
      device_id: 999999 // Non-existent ID
    };

    await expect(refreshDeviceStatus(input)).rejects.toThrow(/Device with ID 999999 not found/i);
  });

  it('should preserve all other device fields during status update', async () => {
    // Create device with specific values
    const deviceResult = await db.insert(mikrotikDevicesTable)
      .values({
        name: 'Preserve Test Device',
        ip_address: '192.168.1.100',
        username: 'testuser',
        password: 'testpass',
        port: 9999,
        status: 'offline'
      })
      .returning()
      .execute();

    const input: DeviceIdInput = {
      device_id: deviceResult[0].id
    };

    const result = await refreshDeviceStatus(input);

    // All fields should be preserved except status and updated_at
    expect(result.name).toEqual('Preserve Test Device');
    expect(result.ip_address).toEqual('192.168.1.100');
    expect(result.username).toEqual('testuser');
    expect(result.password).toEqual('testpass');
    expect(result.port).toEqual(9999);
    expect(result.created_at).toEqual(deviceResult[0].created_at);
    expect(result.status).toEqual('online'); // Should be updated
    expect(result.updated_at.getTime()).toBeGreaterThan(deviceResult[0].updated_at.getTime());
  });

  it('should handle multiple consecutive status refreshes', async () => {
    const input: DeviceIdInput = {
      device_id: testDeviceId
    };

    // First refresh
    const result1 = await refreshDeviceStatus(input);
    expect(result1.status).toEqual('online');

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 10));

    // Second refresh
    const result2 = await refreshDeviceStatus(input);
    expect(result2.status).toEqual('online');
    expect(result2.updated_at.getTime()).toBeGreaterThan(result1.updated_at.getTime());

    // Verify database consistency
    const devices = await db.select()
      .from(mikrotikDevicesTable)
      .where(eq(mikrotikDevicesTable.id, testDeviceId))
      .execute();

    expect(devices).toHaveLength(1);
    expect(devices[0].status).toEqual('online');
  });
});