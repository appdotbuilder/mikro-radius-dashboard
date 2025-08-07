import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { mikrotikDevicesTable } from '../db/schema';
import { type UpdateMikrotikDeviceInput } from '../schema';
import { updateMikrotikDevice } from '../handlers/update_mikrotik_device';
import { eq } from 'drizzle-orm';

// Test data for creating initial device
const initialDeviceData = {
  name: 'Original Device',
  ip_address: '192.168.1.1',
  username: 'admin',
  password: 'original_password',
  port: 8728
};

describe('updateMikrotikDevice', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testDeviceId: number;

  beforeEach(async () => {
    // Create a device to update in each test
    const result = await db.insert(mikrotikDevicesTable)
      .values(initialDeviceData)
      .returning()
      .execute();
    testDeviceId = result[0].id;
  });

  it('should update device name only', async () => {
    const updateInput: UpdateMikrotikDeviceInput = {
      id: testDeviceId,
      name: 'Updated Device Name'
    };

    const result = await updateMikrotikDevice(updateInput);

    expect(result.id).toEqual(testDeviceId);
    expect(result.name).toEqual('Updated Device Name');
    expect(result.ip_address).toEqual('192.168.1.1'); // unchanged
    expect(result.username).toEqual('admin'); // unchanged
    expect(result.password).toEqual('original_password'); // unchanged
    expect(result.port).toEqual(8728); // unchanged
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update multiple fields', async () => {
    const updateInput: UpdateMikrotikDeviceInput = {
      id: testDeviceId,
      name: 'New Device Name',
      ip_address: '10.0.0.1',
      username: 'newadmin',
      port: 9999
    };

    const result = await updateMikrotikDevice(updateInput);

    expect(result.id).toEqual(testDeviceId);
    expect(result.name).toEqual('New Device Name');
    expect(result.ip_address).toEqual('10.0.0.1');
    expect(result.username).toEqual('newadmin');
    expect(result.password).toEqual('original_password'); // unchanged
    expect(result.port).toEqual(9999);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update all fields including password', async () => {
    const updateInput: UpdateMikrotikDeviceInput = {
      id: testDeviceId,
      name: 'Complete Update',
      ip_address: '172.16.0.1',
      username: 'superadmin',
      password: 'new_secure_password',
      port: 22
    };

    const result = await updateMikrotikDevice(updateInput);

    expect(result.id).toEqual(testDeviceId);
    expect(result.name).toEqual('Complete Update');
    expect(result.ip_address).toEqual('172.16.0.1');
    expect(result.username).toEqual('superadmin');
    expect(result.password).toEqual('new_secure_password');
    expect(result.port).toEqual(22);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save updated data to database', async () => {
    const updateInput: UpdateMikrotikDeviceInput = {
      id: testDeviceId,
      name: 'Database Test Device',
      ip_address: '203.0.113.1'
    };

    await updateMikrotikDevice(updateInput);

    // Verify data was saved to database
    const devices = await db.select()
      .from(mikrotikDevicesTable)
      .where(eq(mikrotikDevicesTable.id, testDeviceId))
      .execute();

    expect(devices).toHaveLength(1);
    expect(devices[0].name).toEqual('Database Test Device');
    expect(devices[0].ip_address).toEqual('203.0.113.1');
    expect(devices[0].username).toEqual('admin'); // unchanged
    expect(devices[0].password).toEqual('original_password'); // unchanged
    expect(devices[0].port).toEqual(8728); // unchanged
    expect(devices[0].updated_at).toBeInstanceOf(Date);
  });

  it('should update timestamps correctly', async () => {
    const originalDevice = await db.select()
      .from(mikrotikDevicesTable)
      .where(eq(mikrotikDevicesTable.id, testDeviceId))
      .execute();

    const originalUpdatedAt = originalDevice[0].updated_at;

    // Wait a small amount to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    const updateInput: UpdateMikrotikDeviceInput = {
      id: testDeviceId,
      name: 'Timestamp Test'
    };

    const result = await updateMikrotikDevice(updateInput);

    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    expect(result.created_at).toEqual(originalDevice[0].created_at); // unchanged
  });

  it('should throw error when device does not exist', async () => {
    const nonExistentId = 99999;
    const updateInput: UpdateMikrotikDeviceInput = {
      id: nonExistentId,
      name: 'Non-existent Device'
    };

    await expect(updateMikrotikDevice(updateInput)).rejects.toThrow(/not found/i);
  });

  it('should handle updating with only id provided', async () => {
    const updateInput: UpdateMikrotikDeviceInput = {
      id: testDeviceId
    };

    const result = await updateMikrotikDevice(updateInput);

    // Should update only the updated_at timestamp
    expect(result.id).toEqual(testDeviceId);
    expect(result.name).toEqual('Original Device'); // unchanged
    expect(result.ip_address).toEqual('192.168.1.1'); // unchanged
    expect(result.username).toEqual('admin'); // unchanged
    expect(result.password).toEqual('original_password'); // unchanged
    expect(result.port).toEqual(8728); // unchanged
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should preserve device status during update', async () => {
    // First, update the device status to 'online'
    await db.update(mikrotikDevicesTable)
      .set({ status: 'online' })
      .where(eq(mikrotikDevicesTable.id, testDeviceId))
      .execute();

    const updateInput: UpdateMikrotikDeviceInput = {
      id: testDeviceId,
      name: 'Status Test Device'
    };

    const result = await updateMikrotikDevice(updateInput);

    expect(result.status).toEqual('online'); // should remain unchanged
    expect(result.name).toEqual('Status Test Device');
  });
});