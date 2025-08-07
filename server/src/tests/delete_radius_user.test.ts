import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { radiusUsersTable, radiusProfilesTable, activityLogsTable } from '../db/schema';
import { deleteRadiusUser } from '../handlers/delete_radius_user';
import { eq } from 'drizzle-orm';

describe('deleteRadiusUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should delete a radius user', async () => {
    // Create a profile first (required foreign key)
    const profileResult = await db.insert(radiusProfilesTable)
      .values({
        name: 'Test Profile',
        upload_speed: 1024,
        download_speed: 2048,
        session_timeout: null,
        idle_timeout: null,
        monthly_quota: null,
        price: null,
        description: null
      })
      .returning()
      .execute();

    const profile = profileResult[0];

    // Create a user to delete
    const userResult = await db.insert(radiusUsersTable)
      .values({
        username: 'testuser',
        password: 'testpass',
        profile_id: profile.id,
        full_name: 'Test User',
        email: 'test@example.com',
        phone: '123456789',
        address: '123 Test St',
        status: 'active',
        expires_at: null
      })
      .returning()
      .execute();

    const user = userResult[0];

    // Delete the user
    const result = await deleteRadiusUser({ id: user.id });

    expect(result.success).toBe(true);

    // Verify user was deleted from database
    const deletedUsers = await db.select()
      .from(radiusUsersTable)
      .where(eq(radiusUsersTable.id, user.id))
      .execute();

    expect(deletedUsers).toHaveLength(0);
  });

  it('should create activity log entry when deleting user', async () => {
    // Create a profile first
    const profileResult = await db.insert(radiusProfilesTable)
      .values({
        name: 'Test Profile',
        upload_speed: 1024,
        download_speed: 2048,
        session_timeout: null,
        idle_timeout: null,
        monthly_quota: null,
        price: null,
        description: null
      })
      .returning()
      .execute();

    const profile = profileResult[0];

    // Create a user to delete
    const userResult = await db.insert(radiusUsersTable)
      .values({
        username: 'loguser',
        password: 'testpass',
        profile_id: profile.id,
        full_name: 'Log User',
        email: 'log@example.com',
        phone: '987654321',
        address: '456 Log Ave',
        status: 'active',
        expires_at: null
      })
      .returning()
      .execute();

    const user = userResult[0];

    // Delete the user
    await deleteRadiusUser({ id: user.id });

    // Verify activity log was created
    const activityLogs = await db.select()
      .from(activityLogsTable)
      .where(eq(activityLogsTable.user_id, user.id))
      .execute();

    expect(activityLogs).toHaveLength(1);
    
    const logEntry = activityLogs[0];
    expect(logEntry.user_id).toBe(user.id);
    expect(logEntry.username).toBe('loguser');
    expect(logEntry.action).toBe('account_updated');
    expect(logEntry.ip_address).toBeNull();
    expect(logEntry.mac_address).toBeNull();
    expect(logEntry.bytes_in).toBeNull();
    expect(logEntry.bytes_out).toBeNull();
    expect(logEntry.session_duration).toBeNull();
    expect(logEntry.created_at).toBeInstanceOf(Date);
  });

  it('should throw error when user does not exist', async () => {
    const nonExistentId = 99999;

    await expect(deleteRadiusUser({ id: nonExistentId }))
      .rejects.toThrow(/Radius user with id 99999 not found/i);
  });

  it('should handle multiple users with different profiles', async () => {
    // Create two profiles
    const profile1Result = await db.insert(radiusProfilesTable)
      .values({
        name: 'Profile 1',
        upload_speed: 512,
        download_speed: 1024,
        session_timeout: null,
        idle_timeout: null,
        monthly_quota: null,
        price: null,
        description: null
      })
      .returning()
      .execute();

    const profile2Result = await db.insert(radiusProfilesTable)
      .values({
        name: 'Profile 2',
        upload_speed: 2048,
        download_speed: 4096,
        session_timeout: null,
        idle_timeout: null,
        monthly_quota: null,
        price: null,
        description: null
      })
      .returning()
      .execute();

    const profile1 = profile1Result[0];
    const profile2 = profile2Result[0];

    // Create two users
    const user1Result = await db.insert(radiusUsersTable)
      .values({
        username: 'user1',
        password: 'pass1',
        profile_id: profile1.id,
        full_name: 'User One',
        email: 'user1@example.com',
        phone: '1111111111',
        address: '111 First St',
        status: 'active',
        expires_at: null
      })
      .returning()
      .execute();

    const user2Result = await db.insert(radiusUsersTable)
      .values({
        username: 'user2',
        password: 'pass2',
        profile_id: profile2.id,
        full_name: 'User Two',
        email: 'user2@example.com',
        phone: '2222222222',
        address: '222 Second St',
        status: 'suspended',
        expires_at: null
      })
      .returning()
      .execute();

    const user1 = user1Result[0];
    const user2 = user2Result[0];

    // Delete first user
    const result1 = await deleteRadiusUser({ id: user1.id });
    expect(result1.success).toBe(true);

    // Verify only first user was deleted
    const remainingUsers = await db.select()
      .from(radiusUsersTable)
      .execute();

    expect(remainingUsers).toHaveLength(1);
    expect(remainingUsers[0].username).toBe('user2');

    // Delete second user
    const result2 = await deleteRadiusUser({ id: user2.id });
    expect(result2.success).toBe(true);

    // Verify all users are deleted
    const finalUsers = await db.select()
      .from(radiusUsersTable)
      .execute();

    expect(finalUsers).toHaveLength(0);
  });
});