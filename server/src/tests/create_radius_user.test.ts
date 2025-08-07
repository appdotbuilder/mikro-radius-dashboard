import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { radiusUsersTable, radiusProfilesTable, activityLogsTable } from '../db/schema';
import { type CreateRadiusUserInput } from '../schema';
import { createRadiusUser, verifyPassword } from '../handlers/create_radius_user';
import { eq } from 'drizzle-orm';

// Test input with all required and optional fields
const testInput: CreateRadiusUserInput = {
  username: 'testuser',
  password: 'testpassword123',
  profile_id: 1,
  full_name: 'Test User',
  email: 'test@example.com',
  phone: '+1234567890',
  address: '123 Test Street',
  expires_at: new Date('2025-12-31')
};

describe('createRadiusUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a radius user with all fields', async () => {
    // Create a test profile first
    await db.insert(radiusProfilesTable)
      .values({
        name: 'Test Profile',
        upload_speed: 1000,
        download_speed: 2000,
        session_timeout: 3600,
        idle_timeout: 300,
        monthly_quota: 10000,
        price: '29.99',
        description: 'Test profile for testing'
      })
      .execute();

    const result = await createRadiusUser(testInput);

    // Validate basic fields
    expect(result.username).toEqual('testuser');
    expect(result.profile_id).toEqual(1);
    expect(result.full_name).toEqual('Test User');
    expect(result.email).toEqual('test@example.com');
    expect(result.phone).toEqual('+1234567890');
    expect(result.address).toEqual('123 Test Street');
    expect(result.status).toEqual('active');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.expires_at).toBeInstanceOf(Date);

    // Verify password is hashed (not plain text)
    expect(result.password).not.toEqual('testpassword123');
    expect(result.password.length).toBeGreaterThan(20); // Hashed passwords are longer
    expect(result.password).toContain(':'); // Our hash format includes salt:hash
  });

  it('should save user to database with hashed password', async () => {
    // Create a test profile first
    await db.insert(radiusProfilesTable)
      .values({
        name: 'Test Profile',
        upload_speed: 1000,
        download_speed: 2000
      })
      .execute();

    const result = await createRadiusUser(testInput);

    // Query the database to verify the user was saved
    const users = await db.select()
      .from(radiusUsersTable)
      .where(eq(radiusUsersTable.id, result.id))
      .execute();

    expect(users).toHaveLength(1);
    const savedUser = users[0];
    
    expect(savedUser.username).toEqual('testuser');
    expect(savedUser.full_name).toEqual('Test User');
    expect(savedUser.email).toEqual('test@example.com');
    expect(savedUser.status).toEqual('active');

    // Verify password was hashed correctly using our verification function
    const isPasswordValid = verifyPassword('testpassword123', savedUser.password);
    expect(isPasswordValid).toBe(true);
    
    // Verify wrong password fails
    const isWrongPasswordValid = verifyPassword('wrongpassword', savedUser.password);
    expect(isWrongPasswordValid).toBe(false);
  });

  it('should create activity log entry for account creation', async () => {
    // Create a test profile first
    await db.insert(radiusProfilesTable)
      .values({
        name: 'Test Profile',
        upload_speed: 1000,
        download_speed: 2000
      })
      .execute();

    const result = await createRadiusUser(testInput);

    // Check activity log was created
    const activityLogs = await db.select()
      .from(activityLogsTable)
      .where(eq(activityLogsTable.user_id, result.id))
      .execute();

    expect(activityLogs).toHaveLength(1);
    const log = activityLogs[0];
    
    expect(log.username).toEqual('testuser');
    expect(log.action).toEqual('account_created');
    expect(log.user_id).toEqual(result.id);
    expect(log.created_at).toBeInstanceOf(Date);
  });

  it('should handle minimal input with only required fields', async () => {
    // Create a test profile first
    await db.insert(radiusProfilesTable)
      .values({
        name: 'Basic Profile',
        upload_speed: 500,
        download_speed: 1000
      })
      .execute();

    const minimalInput: CreateRadiusUserInput = {
      username: 'minimaluser',
      password: 'password123',
      profile_id: 1,
      full_name: null,
      email: null,
      phone: null,
      address: null,
      expires_at: null
    };

    const result = await createRadiusUser(minimalInput);

    expect(result.username).toEqual('minimaluser');
    expect(result.profile_id).toEqual(1);
    expect(result.full_name).toBeNull();
    expect(result.email).toBeNull();
    expect(result.phone).toBeNull();
    expect(result.address).toBeNull();
    expect(result.expires_at).toBeNull();
    expect(result.status).toEqual('active');
  });

  it('should throw error for non-existent profile', async () => {
    // Don't create a profile - use non-existent profile_id
    const invalidInput = { ...testInput, profile_id: 999 };

    expect(createRadiusUser(invalidInput))
      .rejects
      .toThrow(/Profile with ID 999 does not exist/i);
  });

  it('should throw error for duplicate username', async () => {
    // Create a test profile first
    await db.insert(radiusProfilesTable)
      .values({
        name: 'Test Profile',
        upload_speed: 1000,
        download_speed: 2000
      })
      .execute();

    // Create first user
    await createRadiusUser(testInput);

    // Try to create second user with same username
    const duplicateInput = { ...testInput, email: 'different@example.com' };

    expect(createRadiusUser(duplicateInput))
      .rejects
      .toThrow(/Username testuser already exists/i);
  });

  it('should handle different profile assignments', async () => {
    // Create multiple profiles
    await db.insert(radiusProfilesTable)
      .values([
        {
          name: 'Basic Profile',
          upload_speed: 500,
          download_speed: 1000
        },
        {
          name: 'Premium Profile',
          upload_speed: 2000,
          download_speed: 5000
        }
      ])
      .execute();

    // Create users with different profiles
    const basicUser = await createRadiusUser({
      ...testInput,
      username: 'basicuser',
      profile_id: 1
    });

    const premiumUser = await createRadiusUser({
      ...testInput,
      username: 'premiumuser',
      profile_id: 2
    });

    expect(basicUser.profile_id).toEqual(1);
    expect(premiumUser.profile_id).toEqual(2);

    // Verify both users exist in database
    const users = await db.select()
      .from(radiusUsersTable)
      .execute();

    expect(users).toHaveLength(2);
    expect(users.map(u => u.username)).toContain('basicuser');
    expect(users.map(u => u.username)).toContain('premiumuser');
  });

  it('should verify password hashing works correctly', async () => {
    // Create a test profile first
    await db.insert(radiusProfilesTable)
      .values({
        name: 'Test Profile',
        upload_speed: 1000,
        download_speed: 2000
      })
      .execute();

    const result = await createRadiusUser(testInput);

    // Test that the stored password can be verified
    expect(verifyPassword('testpassword123', result.password)).toBe(true);
    expect(verifyPassword('wrongpassword', result.password)).toBe(false);
    
    // Test that each hash is unique (different salt)
    const secondUser = await createRadiusUser({
      ...testInput,
      username: 'testuser2',
      password: 'testpassword123'
    });
    
    // Same password should produce different hashes due to different salts
    expect(result.password).not.toEqual(secondUser.password);
    
    // But both should verify correctly
    expect(verifyPassword('testpassword123', result.password)).toBe(true);
    expect(verifyPassword('testpassword123', secondUser.password)).toBe(true);
  });
});