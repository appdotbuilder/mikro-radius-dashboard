import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { radiusProfilesTable } from '../db/schema';
import { getRadiusProfiles } from '../handlers/get_radius_profiles';

describe('getRadiusProfiles', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no profiles exist', async () => {
    const result = await getRadiusProfiles();
    
    expect(result).toEqual([]);
  });

  it('should fetch all radius profiles with correct data types', async () => {
    // Create test profiles
    const profiles = await db.insert(radiusProfilesTable)
      .values([
        {
          name: 'Basic Plan',
          upload_speed: 1024,
          download_speed: 5120,
          session_timeout: 3600,
          idle_timeout: 1800,
          monthly_quota: 10240,
          price: '29.99',
          description: 'Basic internet plan'
        },
        {
          name: 'Premium Plan',
          upload_speed: 2048,
          download_speed: 10240,
          session_timeout: null,
          idle_timeout: null,
          monthly_quota: null,
          price: '59.99',
          description: 'Unlimited premium plan'
        },
        {
          name: 'Free Trial',
          upload_speed: 512,
          download_speed: 2048,
          session_timeout: 1800,
          idle_timeout: 900,
          monthly_quota: 1024,
          price: null,
          description: 'Trial plan for new users'
        }
      ])
      .returning()
      .execute();

    const result = await getRadiusProfiles();

    expect(result).toHaveLength(3);

    // Verify data types and conversions
    result.forEach(profile => {
      expect(profile.id).toBeTypeOf('number');
      expect(profile.name).toBeTypeOf('string');
      expect(profile.upload_speed).toBeTypeOf('number');
      expect(profile.download_speed).toBeTypeOf('number');
      expect(profile.created_at).toBeInstanceOf(Date);
      
      // Verify numeric conversion for price
      if (profile.price !== null) {
        expect(typeof profile.price).toBe('number');
      }
    });
  });

  it('should return profiles ordered by creation date (newest first)', async () => {
    // Create profiles with slight delays to ensure different timestamps
    const profile1 = await db.insert(radiusProfilesTable)
      .values({
        name: 'First Profile',
        upload_speed: 1024,
        download_speed: 5120,
        price: '19.99',
        description: 'First created profile'
      })
      .returning()
      .execute();

    // Small delay to ensure different timestamp
    await new Promise(resolve => setTimeout(resolve, 10));

    const profile2 = await db.insert(radiusProfilesTable)
      .values({
        name: 'Second Profile',
        upload_speed: 2048,
        download_speed: 10240,
        price: '39.99',
        description: 'Second created profile'
      })
      .returning()
      .execute();

    await new Promise(resolve => setTimeout(resolve, 10));

    const profile3 = await db.insert(radiusProfilesTable)
      .values({
        name: 'Third Profile',
        upload_speed: 4096,
        download_speed: 20480,
        price: '79.99',
        description: 'Third created profile'
      })
      .returning()
      .execute();

    const result = await getRadiusProfiles();

    expect(result).toHaveLength(3);
    
    // Should be ordered by creation date descending (newest first)
    expect(result[0].name).toBe('Third Profile');
    expect(result[1].name).toBe('Second Profile');
    expect(result[2].name).toBe('First Profile');
  });

  it('should handle profiles with null values correctly', async () => {
    await db.insert(radiusProfilesTable)
      .values({
        name: 'Minimal Plan',
        upload_speed: 256,
        download_speed: 1024,
        session_timeout: null,
        idle_timeout: null,
        monthly_quota: null,
        price: null,
        description: null
      })
      .execute();

    const result = await getRadiusProfiles();

    expect(result).toHaveLength(1);
    expect(result[0].session_timeout).toBeNull();
    expect(result[0].idle_timeout).toBeNull();
    expect(result[0].monthly_quota).toBeNull();
    expect(result[0].price).toBeNull();
    expect(result[0].description).toBeNull();
  });

  it('should correctly parse numeric price values', async () => {
    await db.insert(radiusProfilesTable)
      .values([
        {
          name: 'Integer Price',
          upload_speed: 1024,
          download_speed: 5120,
          price: '25.00'
        },
        {
          name: 'Decimal Price',
          upload_speed: 2048,
          download_speed: 10240,
          price: '49.99'
        }
      ])
      .execute();

    const result = await getRadiusProfiles();

    expect(result).toHaveLength(2);
    
    const integerPriceProfile = result.find(p => p.name === 'Integer Price');
    const decimalPriceProfile = result.find(p => p.name === 'Decimal Price');

    expect(integerPriceProfile?.price).toBe(25.00);
    expect(decimalPriceProfile?.price).toBe(49.99);
    expect(typeof integerPriceProfile?.price).toBe('number');
    expect(typeof decimalPriceProfile?.price).toBe('number');
  });

  it('should include all profile fields in response', async () => {
    await db.insert(radiusProfilesTable)
      .values({
        name: 'Complete Profile',
        upload_speed: 2048,
        download_speed: 10240,
        session_timeout: 7200,
        idle_timeout: 3600,
        monthly_quota: 50000,
        price: '99.99',
        description: 'Full-featured profile'
      })
      .execute();

    const result = await getRadiusProfiles();

    expect(result).toHaveLength(1);
    
    const profile = result[0];
    expect(profile).toHaveProperty('id');
    expect(profile).toHaveProperty('name');
    expect(profile).toHaveProperty('upload_speed');
    expect(profile).toHaveProperty('download_speed');
    expect(profile).toHaveProperty('session_timeout');
    expect(profile).toHaveProperty('idle_timeout');
    expect(profile).toHaveProperty('monthly_quota');
    expect(profile).toHaveProperty('price');
    expect(profile).toHaveProperty('description');
    expect(profile).toHaveProperty('created_at');

    expect(profile.name).toBe('Complete Profile');
    expect(profile.upload_speed).toBe(2048);
    expect(profile.download_speed).toBe(10240);
    expect(profile.session_timeout).toBe(7200);
    expect(profile.idle_timeout).toBe(3600);
    expect(profile.monthly_quota).toBe(50000);
    expect(profile.price).toBe(99.99);
    expect(profile.description).toBe('Full-featured profile');
  });
});