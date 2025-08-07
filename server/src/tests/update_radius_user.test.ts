import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { radiusUsersTable, radiusProfilesTable, activityLogsTable } from '../db/schema';
import { type UpdateRadiusUserInput, type RadiusUser } from '../schema';
import { updateRadiusUser } from '../handlers/update_radius_user';
import { eq } from 'drizzle-orm';
import { createHash } from 'crypto';

describe('updateRadiusUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create a test profile
  const createTestProfile = async () => {
    const result = await db.insert(radiusProfilesTable)
      .values({
        name: 'Test Profile',
        upload_speed: 1000,
        download_speed: 5000,
        session_timeout: 3600,
        idle_timeout: 600,
        monthly_quota: 10000,
        price: '29.99',
        description: 'Test profile'
      })
      .returning()
      .execute();

    return result[0];
  };

  // Helper function to create a test user
  const createTestUser = async (profileId: number) => {
    const result = await db.insert(radiusUsersTable)
      .values({
        username: 'testuser',
        password: 'originalpass',
        profile_id: profileId,
        full_name: 'Test User',
        email: 'test@example.com',
        phone: '1234567890',
        address: '123 Test St',
        status: 'active',
        expires_at: new Date('2024-12-31')
      })
      .returning()
      .execute();

    return result[0];
  };

  it('should update user password correctly', async () => {
    const profile = await createTestProfile();
    const user = await createTestUser(profile.id);

    const updateInput: UpdateRadiusUserInput = {
      id: user.id,
      password: 'newpassword123'
    };

    const result = await updateRadiusUser(updateInput);

    expect(result.id).toEqual(user.id);
    expect(result.username).toEqual('testuser');
    
    // Verify password was hashed with MD5
    const expectedHash = createHash('md5').update('newpassword123').digest('hex');
    expect(result.password).toEqual(expectedHash);

    // Verify in database
    const dbUser = await db.select()
      .from(radiusUsersTable)
      .where(eq(radiusUsersTable.id, user.id))
      .execute();

    expect(dbUser[0].password).toEqual(expectedHash);
  });

  it('should update user profile assignment', async () => {
    const profile1 = await createTestProfile();
    const profile2 = await db.insert(radiusProfilesTable)
      .values({
        name: 'Premium Profile',
        upload_speed: 2000,
        download_speed: 10000,
        session_timeout: 7200,
        idle_timeout: 1200,
        monthly_quota: 50000,
        price: '49.99',
        description: 'Premium profile'
      })
      .returning()
      .execute();

    const user = await createTestUser(profile1.id);

    const updateInput: UpdateRadiusUserInput = {
      id: user.id,
      profile_id: profile2[0].id
    };

    const result = await updateRadiusUser(updateInput);

    expect(result.profile_id).toEqual(profile2[0].id);

    // Verify in database
    const dbUser = await db.select()
      .from(radiusUsersTable)
      .where(eq(radiusUsersTable.id, user.id))
      .execute();

    expect(dbUser[0].profile_id).toEqual(profile2[0].id);
  });

  it('should update user personal information', async () => {
    const profile = await createTestProfile();
    const user = await createTestUser(profile.id);

    const updateInput: UpdateRadiusUserInput = {
      id: user.id,
      full_name: 'Updated Name',
      email: 'updated@example.com',
      phone: '9876543210',
      address: '456 Updated St'
    };

    const result = await updateRadiusUser(updateInput);

    expect(result.full_name).toEqual('Updated Name');
    expect(result.email).toEqual('updated@example.com');
    expect(result.phone).toEqual('9876543210');
    expect(result.address).toEqual('456 Updated St');

    // Verify in database
    const dbUser = await db.select()
      .from(radiusUsersTable)
      .where(eq(radiusUsersTable.id, user.id))
      .execute();

    expect(dbUser[0].full_name).toEqual('Updated Name');
    expect(dbUser[0].email).toEqual('updated@example.com');
    expect(dbUser[0].phone).toEqual('9876543210');
    expect(dbUser[0].address).toEqual('456 Updated St');
  });

  it('should update user status and expiration', async () => {
    const profile = await createTestProfile();
    const user = await createTestUser(profile.id);

    const newExpiryDate = new Date('2025-06-30');
    const updateInput: UpdateRadiusUserInput = {
      id: user.id,
      status: 'suspended',
      expires_at: newExpiryDate
    };

    const result = await updateRadiusUser(updateInput);

    expect(result.status).toEqual('suspended');
    expect(result.expires_at).toEqual(newExpiryDate);

    // Verify in database
    const dbUser = await db.select()
      .from(radiusUsersTable)
      .where(eq(radiusUsersTable.id, user.id))
      .execute();

    expect(dbUser[0].status).toEqual('suspended');
    expect(dbUser[0].expires_at?.getTime()).toEqual(newExpiryDate.getTime());
  });

  it('should update multiple fields at once', async () => {
    const profile = await createTestProfile();
    const profile2 = await db.insert(radiusProfilesTable)
      .values({
        name: 'Another Profile',
        upload_speed: 3000,
        download_speed: 15000,
        session_timeout: null,
        idle_timeout: null,
        monthly_quota: null,
        price: '99.99',
        description: null
      })
      .returning()
      .execute();

    const user = await createTestUser(profile.id);

    const updateInput: UpdateRadiusUserInput = {
      id: user.id,
      password: 'combinedupdate',
      profile_id: profile2[0].id,
      full_name: 'Combined Update User',
      status: 'expired',
      expires_at: null
    };

    const result = await updateRadiusUser(updateInput);

    const expectedHash = createHash('md5').update('combinedupdate').digest('hex');
    expect(result.password).toEqual(expectedHash);
    expect(result.profile_id).toEqual(profile2[0].id);
    expect(result.full_name).toEqual('Combined Update User');
    expect(result.status).toEqual('expired');
    expect(result.expires_at).toBeNull();
  });

  it('should create activity log entry', async () => {
    const profile = await createTestProfile();
    const user = await createTestUser(profile.id);

    const updateInput: UpdateRadiusUserInput = {
      id: user.id,
      full_name: 'Activity Log Test'
    };

    await updateRadiusUser(updateInput);

    // Check activity log was created
    const activityLogs = await db.select()
      .from(activityLogsTable)
      .where(eq(activityLogsTable.user_id, user.id))
      .execute();

    expect(activityLogs).toHaveLength(1);
    expect(activityLogs[0].username).toEqual('testuser');
    expect(activityLogs[0].action).toEqual('account_updated');
    expect(activityLogs[0].user_id).toEqual(user.id);
    expect(activityLogs[0].created_at).toBeInstanceOf(Date);
  });

  it('should handle nullable fields correctly', async () => {
    const profile = await createTestProfile();
    const user = await createTestUser(profile.id);

    const updateInput: UpdateRadiusUserInput = {
      id: user.id,
      full_name: null,
      email: null,
      phone: null,
      address: null,
      expires_at: null
    };

    const result = await updateRadiusUser(updateInput);

    expect(result.full_name).toBeNull();
    expect(result.email).toBeNull();
    expect(result.phone).toBeNull();
    expect(result.address).toBeNull();
    expect(result.expires_at).toBeNull();
  });

  it('should throw error when user not found', async () => {
    const updateInput: UpdateRadiusUserInput = {
      id: 99999,
      full_name: 'Should Not Work'
    };

    await expect(updateRadiusUser(updateInput))
      .rejects.toThrow(/Radius user with id 99999 not found/i);
  });

  it('should throw error when profile_id does not exist', async () => {
    const profile = await createTestProfile();
    const user = await createTestUser(profile.id);

    const updateInput: UpdateRadiusUserInput = {
      id: user.id,
      profile_id: 99999
    };

    await expect(updateRadiusUser(updateInput))
      .rejects.toThrow(/Radius profile with id 99999 not found/i);
  });

  it('should not update fields that are not provided', async () => {
    const profile = await createTestProfile();
    const user = await createTestUser(profile.id);

    // Only update email
    const updateInput: UpdateRadiusUserInput = {
      id: user.id,
      email: 'onlyemail@example.com'
    };

    const result = await updateRadiusUser(updateInput);

    // These should remain unchanged
    expect(result.username).toEqual('testuser');
    expect(result.password).toEqual('originalpass'); // Original password unchanged
    expect(result.full_name).toEqual('Test User');
    expect(result.phone).toEqual('1234567890');
    expect(result.address).toEqual('123 Test St');
    expect(result.status).toEqual('active');
    expect(result.profile_id).toEqual(profile.id);
    
    // Only this should be updated
    expect(result.email).toEqual('onlyemail@example.com');
  });
});