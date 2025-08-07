import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { radiusProfilesTable } from '../db/schema';
import { type UpdateRadiusProfileInput, type CreateRadiusProfileInput } from '../schema';
import { updateRadiusProfile } from '../handlers/update_radius_profile';
import { eq } from 'drizzle-orm';

// Helper to create test profile
const createTestProfile = async (profileData: Partial<CreateRadiusProfileInput> = {}) => {
  const defaultProfile = {
    name: 'Test Profile',
    upload_speed: 1024,
    download_speed: 2048,
    session_timeout: 3600,
    idle_timeout: 300,
    monthly_quota: 10240,
    price: 29.99,
    description: 'Test profile description'
  };

  const result = await db.insert(radiusProfilesTable)
    .values({
      ...defaultProfile,
      ...profileData,
      price: profileData.price ? profileData.price.toString() : defaultProfile.price.toString()
    })
    .returning()
    .execute();

  return {
    ...result[0],
    price: result[0].price ? parseFloat(result[0].price) : null
  };
};

describe('updateRadiusProfile', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update a radius profile with all fields', async () => {
    // Create a test profile
    const testProfile = await createTestProfile();

    const updateInput: UpdateRadiusProfileInput = {
      id: testProfile.id,
      name: 'Updated Profile Name',
      upload_speed: 2048,
      download_speed: 4096,
      session_timeout: 7200,
      idle_timeout: 600,
      monthly_quota: 20480,
      price: 49.99,
      description: 'Updated description'
    };

    const result = await updateRadiusProfile(updateInput);

    // Verify all updated fields
    expect(result.id).toEqual(testProfile.id);
    expect(result.name).toEqual('Updated Profile Name');
    expect(result.upload_speed).toEqual(2048);
    expect(result.download_speed).toEqual(4096);
    expect(result.session_timeout).toEqual(7200);
    expect(result.idle_timeout).toEqual(600);
    expect(result.monthly_quota).toEqual(20480);
    expect(result.price).toEqual(49.99);
    expect(typeof result.price).toBe('number');
    expect(result.description).toEqual('Updated description');
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should update only provided fields', async () => {
    const testProfile = await createTestProfile();

    const updateInput: UpdateRadiusProfileInput = {
      id: testProfile.id,
      name: 'Partially Updated Profile',
      price: 39.99
    };

    const result = await updateRadiusProfile(updateInput);

    // Verify updated fields
    expect(result.name).toEqual('Partially Updated Profile');
    expect(result.price).toEqual(39.99);
    
    // Verify unchanged fields remain the same
    expect(result.upload_speed).toEqual(testProfile.upload_speed);
    expect(result.download_speed).toEqual(testProfile.download_speed);
    expect(result.session_timeout).toEqual(testProfile.session_timeout);
    expect(result.idle_timeout).toEqual(testProfile.idle_timeout);
    expect(result.monthly_quota).toEqual(testProfile.monthly_quota);
    expect(result.description).toEqual(testProfile.description);
  });

  it('should update nullable fields to null', async () => {
    const testProfile = await createTestProfile();

    const updateInput: UpdateRadiusProfileInput = {
      id: testProfile.id,
      session_timeout: null,
      idle_timeout: null,
      monthly_quota: null,
      price: null,
      description: null
    };

    const result = await updateRadiusProfile(updateInput);

    expect(result.session_timeout).toBeNull();
    expect(result.idle_timeout).toBeNull();
    expect(result.monthly_quota).toBeNull();
    expect(result.price).toBeNull();
    expect(result.description).toBeNull();
  });

  it('should save updated profile to database', async () => {
    const testProfile = await createTestProfile();

    const updateInput: UpdateRadiusProfileInput = {
      id: testProfile.id,
      name: 'Database Updated Profile',
      upload_speed: 512,
      price: 19.99
    };

    await updateRadiusProfile(updateInput);

    // Query database to verify changes were persisted
    const profiles = await db.select()
      .from(radiusProfilesTable)
      .where(eq(radiusProfilesTable.id, testProfile.id))
      .execute();

    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toEqual('Database Updated Profile');
    expect(profiles[0].upload_speed).toEqual(512);
    expect(parseFloat(profiles[0].price!)).toEqual(19.99);
  });

  it('should handle zero values correctly', async () => {
    const testProfile = await createTestProfile();

    const updateInput: UpdateRadiusProfileInput = {
      id: testProfile.id,
      upload_speed: 0,
      download_speed: 0,
      session_timeout: 0,
      idle_timeout: 0,
      monthly_quota: 0,
      price: 0
    };

    const result = await updateRadiusProfile(updateInput);

    expect(result.upload_speed).toEqual(0);
    expect(result.download_speed).toEqual(0);
    expect(result.session_timeout).toEqual(0);
    expect(result.idle_timeout).toEqual(0);
    expect(result.monthly_quota).toEqual(0);
    expect(result.price).toEqual(0);
    expect(typeof result.price).toBe('number');
  });

  it('should throw error when profile does not exist', async () => {
    const updateInput: UpdateRadiusProfileInput = {
      id: 99999,
      name: 'Non-existent Profile'
    };

    await expect(updateRadiusProfile(updateInput))
      .rejects
      .toThrow(/Radius profile with id 99999 not found/i);
  });

  it('should handle large numeric values correctly', async () => {
    const testProfile = await createTestProfile();

    const updateInput: UpdateRadiusProfileInput = {
      id: testProfile.id,
      upload_speed: 1000000, // 1 Mbps in kbps
      download_speed: 10000000, // 10 Mbps in kbps
      monthly_quota: 1048576, // 1 TB in MB
      price: 999.99
    };

    const result = await updateRadiusProfile(updateInput);

    expect(result.upload_speed).toEqual(1000000);
    expect(result.download_speed).toEqual(10000000);
    expect(result.monthly_quota).toEqual(1048576);
    expect(result.price).toEqual(999.99);
  });

  it('should preserve created_at timestamp', async () => {
    const testProfile = await createTestProfile();
    const originalCreatedAt = testProfile.created_at;

    const updateInput: UpdateRadiusProfileInput = {
      id: testProfile.id,
      name: 'Timestamp Test Profile'
    };

    const result = await updateRadiusProfile(updateInput);

    expect(result.created_at).toEqual(originalCreatedAt);
  });
});