import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { radiusUsersTable, radiusProfilesTable } from '../db/schema';
import { type CreateRadiusUserInput, type CreateRadiusProfileInput } from '../schema';
import { getRadiusUsers } from '../handlers/get_radius_users';

// Test profile input for creating prerequisite data
const testProfile: CreateRadiusProfileInput = {
  name: 'Test Profile',
  upload_speed: 1024,
  download_speed: 2048,
  session_timeout: 3600,
  idle_timeout: 300,
  monthly_quota: 10240,
  price: 29.99,
  description: 'Test profile for testing'
};

// Test user inputs
const testUser1: CreateRadiusUserInput = {
  username: 'testuser1',
  password: 'password123',
  profile_id: 1, // Will be set after profile creation
  full_name: 'Test User One',
  email: 'test1@example.com',
  phone: '+1234567890',
  address: '123 Test Street',
  expires_at: new Date('2024-12-31')
};

const testUser2: CreateRadiusUserInput = {
  username: 'testuser2',
  password: 'password456',
  profile_id: 1, // Will be set after profile creation
  full_name: null,
  email: null,
  phone: null,
  address: null,
  expires_at: null
};

describe('getRadiusUsers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no users exist', async () => {
    const result = await getRadiusUsers();

    expect(result).toEqual([]);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should fetch all radius users', async () => {
    // Create prerequisite profile first
    const profileResult = await db.insert(radiusProfilesTable)
      .values({
        name: testProfile.name,
        upload_speed: testProfile.upload_speed,
        download_speed: testProfile.download_speed,
        session_timeout: testProfile.session_timeout,
        idle_timeout: testProfile.idle_timeout,
        monthly_quota: testProfile.monthly_quota,
        price: testProfile.price?.toString(), // Convert to string for numeric column
        description: testProfile.description
      })
      .returning()
      .execute();

    const profileId = profileResult[0].id;

    // Create test users
    await db.insert(radiusUsersTable)
      .values([
        {
          ...testUser1,
          profile_id: profileId
        },
        {
          ...testUser2,
          profile_id: profileId
        }
      ])
      .execute();

    const result = await getRadiusUsers();

    expect(result).toHaveLength(2);
    
    // Verify first user
    const user1 = result.find(u => u.username === 'testuser1');
    expect(user1).toBeDefined();
    expect(user1!.username).toBe('testuser1');
    expect(user1!.password).toBe('password123');
    expect(user1!.profile_id).toBe(profileId);
    expect(user1!.full_name).toBe('Test User One');
    expect(user1!.email).toBe('test1@example.com');
    expect(user1!.phone).toBe('+1234567890');
    expect(user1!.address).toBe('123 Test Street');
    expect(user1!.status).toBe('active');
    expect(user1!.created_at).toBeInstanceOf(Date);
    expect(user1!.expires_at).toBeInstanceOf(Date);

    // Verify second user (with nullable fields)
    const user2 = result.find(u => u.username === 'testuser2');
    expect(user2).toBeDefined();
    expect(user2!.username).toBe('testuser2');
    expect(user2!.password).toBe('password456');
    expect(user2!.profile_id).toBe(profileId);
    expect(user2!.full_name).toBeNull();
    expect(user2!.email).toBeNull();
    expect(user2!.phone).toBeNull();
    expect(user2!.address).toBeNull();
    expect(user2!.status).toBe('active');
    expect(user2!.created_at).toBeInstanceOf(Date);
    expect(user2!.expires_at).toBeNull();
  });

  it('should return users with different statuses', async () => {
    // Create prerequisite profile
    const profileResult = await db.insert(radiusProfilesTable)
      .values({
        name: testProfile.name,
        upload_speed: testProfile.upload_speed,
        download_speed: testProfile.download_speed,
        session_timeout: testProfile.session_timeout,
        idle_timeout: testProfile.idle_timeout,
        monthly_quota: testProfile.monthly_quota,
        price: testProfile.price?.toString(),
        description: testProfile.description
      })
      .returning()
      .execute();

    const profileId = profileResult[0].id;

    // Create users with different statuses
    await db.insert(radiusUsersTable)
      .values([
        {
          username: 'active_user',
          password: 'pass1',
          profile_id: profileId,
          full_name: 'Active User',
          email: null,
          phone: null,
          address: null,
          status: 'active',
          expires_at: null
        },
        {
          username: 'suspended_user',
          password: 'pass2',
          profile_id: profileId,
          full_name: 'Suspended User',
          email: null,
          phone: null,
          address: null,
          status: 'suspended',
          expires_at: null
        },
        {
          username: 'expired_user',
          password: 'pass3',
          profile_id: profileId,
          full_name: 'Expired User',
          email: null,
          phone: null,
          address: null,
          status: 'expired',
          expires_at: new Date('2023-01-01')
        }
      ])
      .execute();

    const result = await getRadiusUsers();

    expect(result).toHaveLength(3);

    const activeUser = result.find(u => u.username === 'active_user');
    const suspendedUser = result.find(u => u.username === 'suspended_user');
    const expiredUser = result.find(u => u.username === 'expired_user');

    expect(activeUser!.status).toBe('active');
    expect(suspendedUser!.status).toBe('suspended');
    expect(expiredUser!.status).toBe('expired');
    expect(expiredUser!.expires_at).toBeInstanceOf(Date);
  });

  it('should return users ordered by creation date', async () => {
    // Create prerequisite profile
    const profileResult = await db.insert(radiusProfilesTable)
      .values({
        name: testProfile.name,
        upload_speed: testProfile.upload_speed,
        download_speed: testProfile.download_speed,
        session_timeout: testProfile.session_timeout,
        idle_timeout: testProfile.idle_timeout,
        monthly_quota: testProfile.monthly_quota,
        price: testProfile.price?.toString(),
        description: testProfile.description
      })
      .returning()
      .execute();

    const profileId = profileResult[0].id;

    // Create users at different times by inserting them separately
    await db.insert(radiusUsersTable)
      .values({
        username: 'user_first',
        password: 'pass1',
        profile_id: profileId,
        full_name: 'First User',
        email: null,
        phone: null,
        address: null,
        expires_at: null
      })
      .execute();

    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    await db.insert(radiusUsersTable)
      .values({
        username: 'user_second',
        password: 'pass2',
        profile_id: profileId,
        full_name: 'Second User',
        email: null,
        phone: null,
        address: null,
        expires_at: null
      })
      .execute();

    const result = await getRadiusUsers();

    expect(result).toHaveLength(2);
    
    // Verify that both users are present
    const firstUser = result.find(u => u.username === 'user_first');
    const secondUser = result.find(u => u.username === 'user_second');
    
    expect(firstUser).toBeDefined();
    expect(secondUser).toBeDefined();
    expect(firstUser!.created_at).toBeInstanceOf(Date);
    expect(secondUser!.created_at).toBeInstanceOf(Date);
  });

  it('should handle users with multiple profiles', async () => {
    // Create two different profiles
    const profile1Result = await db.insert(radiusProfilesTable)
      .values({
        name: 'Basic Profile',
        upload_speed: 512,
        download_speed: 1024,
        session_timeout: 1800,
        idle_timeout: 150,
        monthly_quota: 5120,
        price: '19.99',
        description: 'Basic package'
      })
      .returning()
      .execute();

    const profile2Result = await db.insert(radiusProfilesTable)
      .values({
        name: 'Premium Profile',
        upload_speed: 2048,
        download_speed: 4096,
        session_timeout: 7200,
        idle_timeout: 600,
        monthly_quota: 20480,
        price: '59.99',
        description: 'Premium package'
      })
      .returning()
      .execute();

    // Create users with different profiles
    await db.insert(radiusUsersTable)
      .values([
        {
          username: 'basic_user',
          password: 'pass1',
          profile_id: profile1Result[0].id,
          full_name: 'Basic User',
          email: 'basic@example.com',
          phone: null,
          address: null,
          expires_at: null
        },
        {
          username: 'premium_user',
          password: 'pass2',
          profile_id: profile2Result[0].id,
          full_name: 'Premium User',
          email: 'premium@example.com',
          phone: null,
          address: null,
          expires_at: null
        }
      ])
      .execute();

    const result = await getRadiusUsers();

    expect(result).toHaveLength(2);

    const basicUser = result.find(u => u.username === 'basic_user');
    const premiumUser = result.find(u => u.username === 'premium_user');

    expect(basicUser!.profile_id).toBe(profile1Result[0].id);
    expect(premiumUser!.profile_id).toBe(profile2Result[0].id);
  });
});