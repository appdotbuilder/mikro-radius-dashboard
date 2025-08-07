import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { mikrotikDevicesTable } from '../db/schema';
import { type CreateMikrotikDeviceInput } from '../schema';
import { createMikrotikDevice } from '../handlers/create_mikrotik_device';
import { eq } from 'drizzle-orm';

// Test input with all required fields
const testInput: CreateMikrotikDeviceInput = {
  name: 'Test Router',
  ip_address: '192.168.1.1',
  username: 'admin',
  password: 'password123',
  port: 8728
};

// Test input with custom port
const customPortInput: CreateMikrotikDeviceInput = {
  name: 'Custom Port Router',
  ip_address: '192.168.1.2',
  username: 'admin',
  password: 'password123',
  port: 9999
};

// Test input without explicit port (should use default)
const defaultPortInput: CreateMikrotikDeviceInput = {
  name: 'Default Port Router',
  ip_address: '192.168.1.3',
  username: 'admin',
  password: 'password123',
  port: 8728 // Include default in test input
};

describe('createMikrotikDevice', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a Mikrotik device with all fields', async () => {
    const result = await createMikrotikDevice(testInput);

    // Verify all fields are correctly set
    expect(result.name).toEqual('Test Router');
    expect(result.ip_address).toEqual('192.168.1.1');
    expect(result.username).toEqual('admin');
    expect(result.password).toEqual('password123');
    expect(result.port).toEqual(8728);
    expect(result.status).toEqual('offline');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save device to database correctly', async () => {
    const result = await createMikrotikDevice(testInput);

    // Query the database to verify the device was saved
    const devices = await db.select()
      .from(mikrotikDevicesTable)
      .where(eq(mikrotikDevicesTable.id, result.id))
      .execute();

    expect(devices).toHaveLength(1);
    const savedDevice = devices[0];
    
    expect(savedDevice.name).toEqual('Test Router');
    expect(savedDevice.ip_address).toEqual('192.168.1.1');
    expect(savedDevice.username).toEqual('admin');
    expect(savedDevice.password).toEqual('password123');
    expect(savedDevice.port).toEqual(8728);
    expect(savedDevice.status).toEqual('offline');
    expect(savedDevice.created_at).toBeInstanceOf(Date);
    expect(savedDevice.updated_at).toBeInstanceOf(Date);
  });

  it('should create device with custom port', async () => {
    const result = await createMikrotikDevice(customPortInput);

    expect(result.port).toEqual(9999);
    expect(result.name).toEqual('Custom Port Router');
    expect(result.ip_address).toEqual('192.168.1.2');
    
    // Verify in database
    const devices = await db.select()
      .from(mikrotikDevicesTable)
      .where(eq(mikrotikDevicesTable.id, result.id))
      .execute();

    expect(devices[0].port).toEqual(9999);
  });

  it('should create device with default port when not specified', async () => {
    const result = await createMikrotikDevice(defaultPortInput);

    expect(result.port).toEqual(8728);
    expect(result.name).toEqual('Default Port Router');
    
    // Verify in database
    const devices = await db.select()
      .from(mikrotikDevicesTable)
      .where(eq(mikrotikDevicesTable.id, result.id))
      .execute();

    expect(devices[0].port).toEqual(8728);
  });

  it('should create multiple devices independently', async () => {
    const device1 = await createMikrotikDevice(testInput);
    const device2 = await createMikrotikDevice(customPortInput);

    // Verify both devices have different IDs
    expect(device1.id).not.toEqual(device2.id);

    // Verify both devices were saved
    const allDevices = await db.select()
      .from(mikrotikDevicesTable)
      .execute();

    expect(allDevices).toHaveLength(2);
    
    // Find our devices in the results
    const savedDevice1 = allDevices.find(d => d.id === device1.id);
    const savedDevice2 = allDevices.find(d => d.id === device2.id);

    expect(savedDevice1?.name).toEqual('Test Router');
    expect(savedDevice2?.name).toEqual('Custom Port Router');
  });

  it('should set initial status as offline', async () => {
    const result = await createMikrotikDevice(testInput);

    expect(result.status).toEqual('offline');
    
    // Verify in database
    const devices = await db.select()
      .from(mikrotikDevicesTable)
      .where(eq(mikrotikDevicesTable.id, result.id))
      .execute();

    expect(devices[0].status).toEqual('offline');
  });

  it('should generate timestamps automatically', async () => {
    const beforeCreation = new Date();
    const result = await createMikrotikDevice(testInput);
    const afterCreation = new Date();

    // Verify timestamps are within expected range
    expect(result.created_at.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime() - 1000);
    expect(result.created_at.getTime()).toBeLessThanOrEqual(afterCreation.getTime() + 1000);
    expect(result.updated_at.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime() - 1000);
    expect(result.updated_at.getTime()).toBeLessThanOrEqual(afterCreation.getTime() + 1000);
  });
});