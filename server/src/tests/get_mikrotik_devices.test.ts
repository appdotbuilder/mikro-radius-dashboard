import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { mikrotikDevicesTable } from '../db/schema';
import { getMikrotikDevices } from '../handlers/get_mikrotik_devices';
import { eq } from 'drizzle-orm';

describe('getMikrotikDevices', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no devices exist', async () => {
    const result = await getMikrotikDevices();
    
    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  it('should return all mikrotik devices', async () => {
    // Insert test devices
    const testDevices = [
      {
        name: 'Router 1',
        ip_address: '192.168.1.1',
        username: 'admin',
        password: 'password123',
        port: 8728,
        status: 'online' as const
      },
      {
        name: 'Router 2',
        ip_address: '192.168.1.2',
        username: 'admin',
        password: 'password456',
        port: 8729,
        status: 'offline' as const
      },
      {
        name: 'Access Point 1',
        ip_address: '192.168.1.10',
        username: 'admin',
        password: 'password789',
        port: 8728,
        status: 'error' as const
      }
    ];

    await db.insert(mikrotikDevicesTable)
      .values(testDevices)
      .execute();

    const result = await getMikrotikDevices();

    expect(result).toHaveLength(3);
    
    // Verify first device
    const device1 = result.find(d => d.name === 'Router 1');
    expect(device1).toBeDefined();
    expect(device1!.name).toEqual('Router 1');
    expect(device1!.ip_address).toEqual('192.168.1.1');
    expect(device1!.username).toEqual('admin');
    expect(device1!.password).toEqual('password123');
    expect(device1!.port).toEqual(8728);
    expect(device1!.status).toEqual('online');
    expect(device1!.id).toBeDefined();
    expect(device1!.created_at).toBeInstanceOf(Date);
    expect(device1!.updated_at).toBeInstanceOf(Date);

    // Verify second device
    const device2 = result.find(d => d.name === 'Router 2');
    expect(device2).toBeDefined();
    expect(device2!.status).toEqual('offline');
    expect(device2!.port).toEqual(8729);

    // Verify third device
    const device3 = result.find(d => d.name === 'Access Point 1');
    expect(device3).toBeDefined();
    expect(device3!.status).toEqual('error');
    expect(device3!.ip_address).toEqual('192.168.1.10');
  });

  it('should return devices with all required fields', async () => {
    // Insert a device with minimal data
    await db.insert(mikrotikDevicesTable)
      .values({
        name: 'Test Device',
        ip_address: '10.0.0.1',
        username: 'testuser',
        password: 'testpass',
        port: 8728,
        status: 'online'
      })
      .execute();

    const result = await getMikrotikDevices();

    expect(result).toHaveLength(1);
    const device = result[0];

    // Verify all required fields are present
    expect(device.id).toBeDefined();
    expect(typeof device.id).toBe('number');
    expect(device.name).toBe('Test Device');
    expect(device.ip_address).toBe('10.0.0.1');
    expect(device.username).toBe('testuser');
    expect(device.password).toBe('testpass');
    expect(device.port).toBe(8728);
    expect(device.status).toBe('online');
    expect(device.created_at).toBeInstanceOf(Date);
    expect(device.updated_at).toBeInstanceOf(Date);
  });

  it('should return devices ordered by creation time', async () => {
    // Insert devices with slight time delay to ensure different timestamps
    await db.insert(mikrotikDevicesTable)
      .values({
        name: 'First Device',
        ip_address: '192.168.1.1',
        username: 'admin',
        password: 'pass1',
        port: 8728,
        status: 'online'
      })
      .execute();

    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    await db.insert(mikrotikDevicesTable)
      .values({
        name: 'Second Device',
        ip_address: '192.168.1.2',
        username: 'admin',
        password: 'pass2',
        port: 8728,
        status: 'offline'
      })
      .execute();

    const result = await getMikrotikDevices();

    expect(result).toHaveLength(2);
    // Devices should be returned in the order they were inserted (by id)
    expect(result[0].name).toBe('First Device');
    expect(result[1].name).toBe('Second Device');
  });

  it('should handle devices with different status values', async () => {
    const statusTests = [
      { name: 'Online Device', status: 'online' as const },
      { name: 'Offline Device', status: 'offline' as const },
      { name: 'Error Device', status: 'error' as const }
    ];

    for (const test of statusTests) {
      await db.insert(mikrotikDevicesTable)
        .values({
          name: test.name,
          ip_address: '192.168.1.100',
          username: 'admin',
          password: 'password',
          port: 8728,
          status: test.status
        })
        .execute();
    }

    const result = await getMikrotikDevices();

    expect(result).toHaveLength(3);
    
    const onlineDevice = result.find(d => d.name === 'Online Device');
    const offlineDevice = result.find(d => d.name === 'Offline Device');
    const errorDevice = result.find(d => d.name === 'Error Device');

    expect(onlineDevice!.status).toBe('online');
    expect(offlineDevice!.status).toBe('offline');
    expect(errorDevice!.status).toBe('error');
  });

  it('should persist data correctly in database', async () => {
    const testDevice = {
      name: 'Persistence Test',
      ip_address: '172.16.0.1',
      username: 'testadmin',
      password: 'secretpass',
      port: 8730,
      status: 'online' as const
    };

    await db.insert(mikrotikDevicesTable)
      .values(testDevice)
      .execute();

    // Get devices through handler
    const handlerResult = await getMikrotikDevices();
    
    // Get devices directly from database
    const dbResult = await db.select()
      .from(mikrotikDevicesTable)
      .where(eq(mikrotikDevicesTable.name, 'Persistence Test'))
      .execute();

    expect(handlerResult).toHaveLength(1);
    expect(dbResult).toHaveLength(1);

    // Verify handler result matches database
    const handlerDevice = handlerResult[0];
    const dbDevice = dbResult[0];

    expect(handlerDevice.id).toEqual(dbDevice.id);
    expect(handlerDevice.name).toEqual(dbDevice.name);
    expect(handlerDevice.ip_address).toEqual(dbDevice.ip_address);
    expect(handlerDevice.username).toEqual(dbDevice.username);
    expect(handlerDevice.password).toEqual(dbDevice.password);
    expect(handlerDevice.port).toEqual(dbDevice.port);
    expect(handlerDevice.status).toEqual(dbDevice.status);
    expect(handlerDevice.created_at.getTime()).toEqual(dbDevice.created_at.getTime());
    expect(handlerDevice.updated_at.getTime()).toEqual(dbDevice.updated_at.getTime());
  });
});