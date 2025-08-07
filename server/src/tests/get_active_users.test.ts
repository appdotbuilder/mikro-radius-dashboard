import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { mikrotikDevicesTable, activeUsersTable } from '../db/schema';
import { type DeviceIdInput } from '../schema';
import { getActiveUsers } from '../handlers/get_active_users';
import { eq } from 'drizzle-orm';

describe('getActiveUsers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should fetch active users for a specific device', async () => {
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

    // Create test active users
    await db.insert(activeUsersTable)
      .values([
        {
          device_id: deviceId,
          username: 'user1',
          ip_address: '10.0.0.10',
          mac_address: '00:11:22:33:44:55',
          session_time: '02:30:45',
          bytes_in: '1048576',  // 1MB
          bytes_out: '2097152', // 2MB
          status: 'active'
        },
        {
          device_id: deviceId,
          username: 'user2',
          ip_address: '10.0.0.11',
          mac_address: '00:11:22:33:44:66',
          session_time: '01:15:30',
          bytes_in: '524288',   // 512KB
          bytes_out: '1048576', // 1MB
          status: 'idle'
        }
      ])
      .execute();

    const input: DeviceIdInput = { device_id: deviceId };
    const result = await getActiveUsers(input);

    expect(result).toHaveLength(2);

    // Verify first user
    const user1 = result.find(u => u.username === 'user1');
    expect(user1).toBeDefined();
    expect(user1!.device_id).toEqual(deviceId);
    expect(user1!.ip_address).toEqual('10.0.0.10');
    expect(user1!.mac_address).toEqual('00:11:22:33:44:55');
    expect(user1!.session_time).toEqual('02:30:45');
    expect(user1!.bytes_in).toEqual(1048576);
    expect(user1!.bytes_out).toEqual(2097152);
    expect(user1!.status).toEqual('active');
    expect(user1!.last_seen).toBeInstanceOf(Date);
    expect(typeof user1!.bytes_in).toBe('number');
    expect(typeof user1!.bytes_out).toBe('number');

    // Verify second user
    const user2 = result.find(u => u.username === 'user2');
    expect(user2).toBeDefined();
    expect(user2!.device_id).toEqual(deviceId);
    expect(user2!.username).toEqual('user2');
    expect(user2!.bytes_in).toEqual(524288);
    expect(user2!.bytes_out).toEqual(1048576);
    expect(user2!.status).toEqual('idle');
  });

  it('should return empty array when device has no active users', async () => {
    // Create a test device
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

    const input: DeviceIdInput = { device_id: deviceResult[0].id };
    const result = await getActiveUsers(input);

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should return empty array for non-existent device', async () => {
    const input: DeviceIdInput = { device_id: 99999 };
    const result = await getActiveUsers(input);

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should only return users for the specified device', async () => {
    // Create two test devices
    const device1Result = await db.insert(mikrotikDevicesTable)
      .values({
        name: 'Router 1',
        ip_address: '192.168.1.1',
        username: 'admin',
        password: 'password',
        port: 8728,
        status: 'online'
      })
      .returning()
      .execute();

    const device2Result = await db.insert(mikrotikDevicesTable)
      .values({
        name: 'Router 2',
        ip_address: '192.168.1.2',
        username: 'admin',
        password: 'password',
        port: 8728,
        status: 'online'
      })
      .returning()
      .execute();

    const device1Id = device1Result[0].id;
    const device2Id = device2Result[0].id;

    // Create active users for both devices
    await db.insert(activeUsersTable)
      .values([
        {
          device_id: device1Id,
          username: 'device1_user',
          ip_address: '10.0.0.10',
          mac_address: '00:11:22:33:44:55',
          session_time: '01:00:00',
          bytes_in: '1000000',
          bytes_out: '2000000',
          status: 'active'
        },
        {
          device_id: device2Id,
          username: 'device2_user',
          ip_address: '10.0.0.20',
          mac_address: '00:11:22:33:44:77',
          session_time: '02:00:00',
          bytes_in: '3000000',
          bytes_out: '4000000',
          status: 'active'
        }
      ])
      .execute();

    // Query for device 1 users only
    const input: DeviceIdInput = { device_id: device1Id };
    const result = await getActiveUsers(input);

    expect(result).toHaveLength(1);
    expect(result[0].username).toEqual('device1_user');
    expect(result[0].device_id).toEqual(device1Id);
  });

  it('should handle null mac_address correctly', async () => {
    // Create a test device
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

    // Create active user with null mac_address
    await db.insert(activeUsersTable)
      .values({
        device_id: deviceId,
        username: 'user_no_mac',
        ip_address: '10.0.0.50',
        mac_address: null,
        session_time: '00:30:00',
        bytes_in: '100000',
        bytes_out: '200000',
        status: 'active'
      })
      .execute();

    const input: DeviceIdInput = { device_id: deviceId };
    const result = await getActiveUsers(input);

    expect(result).toHaveLength(1);
    expect(result[0].username).toEqual('user_no_mac');
    expect(result[0].mac_address).toBeNull();
    expect(result[0].bytes_in).toEqual(100000);
    expect(result[0].bytes_out).toEqual(200000);
  });

  it('should verify data is persisted in database', async () => {
    // Create a test device
    const deviceResult = await db.insert(mikrotikDevicesTable)
      .values({
        name: 'DB Test Router',
        ip_address: '192.168.1.1',
        username: 'admin',
        password: 'password',
        port: 8728,
        status: 'online'
      })
      .returning()
      .execute();

    const deviceId = deviceResult[0].id;

    // Create active user
    await db.insert(activeUsersTable)
      .values({
        device_id: deviceId,
        username: 'db_test_user',
        ip_address: '10.0.0.100',
        mac_address: '00:aa:bb:cc:dd:ee',
        session_time: '03:45:12',
        bytes_in: '5000000',
        bytes_out: '8000000',
        status: 'active'
      })
      .execute();

    // Query the database directly to verify data exists
    const dbUsers = await db.select()
      .from(activeUsersTable)
      .where(eq(activeUsersTable.device_id, deviceId))
      .execute();

    expect(dbUsers).toHaveLength(1);
    expect(dbUsers[0].username).toEqual('db_test_user');
    expect(parseFloat(dbUsers[0].bytes_in)).toEqual(5000000);
    expect(parseFloat(dbUsers[0].bytes_out)).toEqual(8000000);

    // Now test the handler
    const input: DeviceIdInput = { device_id: deviceId };
    const result = await getActiveUsers(input);

    expect(result).toHaveLength(1);
    expect(result[0].username).toEqual('db_test_user');
    expect(result[0].bytes_in).toEqual(5000000);
    expect(result[0].bytes_out).toEqual(8000000);
  });
});