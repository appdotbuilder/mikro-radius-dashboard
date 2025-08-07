import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { radiusProfilesTable } from '../db/schema';
import { type CreateRadiusProfileInput } from '../schema';
import { createRadiusProfile } from '../handlers/create_radius_profile';
import { eq } from 'drizzle-orm';

// Test input with all fields
const testInputFull: CreateRadiusProfileInput = {
  name: 'Test Profile',
  upload_speed: 1024,
  download_speed: 2048,
  session_timeout: 3600,
  idle_timeout: 300,
  monthly_quota: 10240,
  price: 29.99,
  description: 'A test profile for bandwidth control'
};

// Test input with minimal fields (nullables omitted)
const testInputMinimal: CreateRadiusProfileInput = {
  name: 'Basic Profile',
  upload_speed: 512,
  download_speed: 1024,
  session_timeout: null,
  idle_timeout: null,
  monthly_quota: null,
  price: null,
  description: null
};

describe('createRadiusProfile', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a radius profile with all fields', async () => {
    const result = await createRadiusProfile(testInputFull);

    // Basic field validation
    expect(result.name).toEqual('Test Profile');
    expect(result.upload_speed).toEqual(1024);
    expect(result.download_speed).toEqual(2048);
    expect(result.session_timeout).toEqual(3600);
    expect(result.idle_timeout).toEqual(300);
    expect(result.monthly_quota).toEqual(10240);
    expect(result.price).toEqual(29.99);
    expect(typeof result.price).toBe('number'); // Verify numeric conversion
    expect(result.description).toEqual('A test profile for bandwidth control');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should create a radius profile with minimal fields', async () => {
    const result = await createRadiusProfile(testInputMinimal);

    // Basic field validation
    expect(result.name).toEqual('Basic Profile');
    expect(result.upload_speed).toEqual(512);
    expect(result.download_speed).toEqual(1024);
    expect(result.session_timeout).toBeNull();
    expect(result.idle_timeout).toBeNull();
    expect(result.monthly_quota).toBeNull();
    expect(result.price).toBeNull();
    expect(result.description).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save radius profile to database', async () => {
    const result = await createRadiusProfile(testInputFull);

    // Query using proper drizzle syntax
    const profiles = await db.select()
      .from(radiusProfilesTable)
      .where(eq(radiusProfilesTable.id, result.id))
      .execute();

    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toEqual('Test Profile');
    expect(profiles[0].upload_speed).toEqual(1024);
    expect(profiles[0].download_speed).toEqual(2048);
    expect(profiles[0].session_timeout).toEqual(3600);
    expect(profiles[0].idle_timeout).toEqual(300);
    expect(profiles[0].monthly_quota).toEqual(10240);
    expect(parseFloat(profiles[0].price!)).toEqual(29.99); // Convert string back to number for comparison
    expect(profiles[0].description).toEqual('A test profile for bandwidth control');
    expect(profiles[0].created_at).toBeInstanceOf(Date);
  });

  it('should handle null price correctly', async () => {
    const result = await createRadiusProfile(testInputMinimal);

    // Verify null price handling
    expect(result.price).toBeNull();

    // Check database storage
    const profiles = await db.select()
      .from(radiusProfilesTable)
      .where(eq(radiusProfilesTable.id, result.id))
      .execute();

    expect(profiles[0].price).toBeNull();
  });

  it('should create profiles with different bandwidth configurations', async () => {
    const highBandwidthInput: CreateRadiusProfileInput = {
      name: 'Premium Profile',
      upload_speed: 10240, // 10 Mbps
      download_speed: 51200, // 50 Mbps
      session_timeout: 7200,
      idle_timeout: 600,
      monthly_quota: 102400, // 100 GB
      price: 99.99,
      description: 'High-speed premium package'
    };

    const result = await createRadiusProfile(highBandwidthInput);

    expect(result.name).toEqual('Premium Profile');
    expect(result.upload_speed).toEqual(10240);
    expect(result.download_speed).toEqual(51200);
    expect(result.monthly_quota).toEqual(102400);
    expect(result.price).toEqual(99.99);
    expect(typeof result.price).toBe('number');
  });

  it('should create multiple profiles with unique names', async () => {
    const profile1Input: CreateRadiusProfileInput = {
      name: 'Standard Profile',
      upload_speed: 2048,
      download_speed: 4096,
      session_timeout: null,
      idle_timeout: null,
      monthly_quota: null,
      price: 19.99,
      description: null
    };

    const profile2Input: CreateRadiusProfileInput = {
      name: 'Business Profile',
      upload_speed: 5120,
      download_speed: 10240,
      session_timeout: null,
      idle_timeout: null,
      monthly_quota: null,
      price: 49.99,
      description: 'Business-grade internet access'
    };

    const result1 = await createRadiusProfile(profile1Input);
    const result2 = await createRadiusProfile(profile2Input);

    expect(result1.id).not.toEqual(result2.id);
    expect(result1.name).toEqual('Standard Profile');
    expect(result2.name).toEqual('Business Profile');
    expect(result1.price).toEqual(19.99);
    expect(result2.price).toEqual(49.99);

    // Verify both profiles exist in database
    const allProfiles = await db.select()
      .from(radiusProfilesTable)
      .execute();

    expect(allProfiles).toHaveLength(2);
    const names = allProfiles.map(p => p.name).sort();
    expect(names).toEqual(['Business Profile', 'Standard Profile']);
  });
});