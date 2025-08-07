import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { radiusProfilesTable, radiusUsersTable } from '../db/schema';
import { deleteRadiusProfile } from '../handlers/delete_radius_profile';
import { eq } from 'drizzle-orm';

describe('deleteRadiusProfile', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should delete a profile successfully', async () => {
    // Create a test profile
    const profileResult = await db.insert(radiusProfilesTable)
      .values({
        name: 'Test Profile',
        upload_speed: 1024,
        download_speed: 2048,
        session_timeout: 3600,
        idle_timeout: 300,
        monthly_quota: 1000,
        price: '29.99',
        description: 'Test profile for deletion'
      })
      .returning()
      .execute();

    const profileId = profileResult[0].id;

    // Delete the profile
    const result = await deleteRadiusProfile({ id: profileId });

    // Verify deletion was successful
    expect(result.success).toBe(true);

    // Verify profile is no longer in database
    const profiles = await db.select()
      .from(radiusProfilesTable)
      .where(eq(radiusProfilesTable.id, profileId))
      .execute();

    expect(profiles).toHaveLength(0);
  });

  it('should throw error when profile does not exist', async () => {
    const nonExistentId = 999;

    await expect(deleteRadiusProfile({ id: nonExistentId }))
      .rejects.toThrow(/Radius profile with id 999 not found/i);
  });

  it('should prevent deletion when users are using the profile', async () => {
    // Create a test profile
    const profileResult = await db.insert(radiusProfilesTable)
      .values({
        name: 'Profile with Users',
        upload_speed: 1024,
        download_speed: 2048,
        session_timeout: 3600,
        idle_timeout: 300,
        monthly_quota: 1000,
        price: '39.99',
        description: 'Profile that has users'
      })
      .returning()
      .execute();

    const profileId = profileResult[0].id;

    // Create users that reference this profile
    await db.insert(radiusUsersTable)
      .values([
        {
          username: 'user1',
          password: 'pass1',
          profile_id: profileId,
          full_name: 'Test User 1',
          email: 'user1@test.com',
          phone: '1234567890',
          address: '123 Test St',
          status: 'active',
          expires_at: null
        },
        {
          username: 'user2',
          password: 'pass2',
          profile_id: profileId,
          full_name: 'Test User 2',
          email: 'user2@test.com',
          phone: '0987654321',
          address: '456 Test Ave',
          status: 'suspended',
          expires_at: null
        }
      ])
      .execute();

    // Attempt to delete profile should fail
    await expect(deleteRadiusProfile({ id: profileId }))
      .rejects.toThrow(/Cannot delete profile: 2 users are still using this profile/i);

    // Verify profile still exists
    const profiles = await db.select()
      .from(radiusProfilesTable)
      .where(eq(radiusProfilesTable.id, profileId))
      .execute();

    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toBe('Profile with Users');
  });

  it('should allow deletion after all dependent users are removed', async () => {
    // Create a test profile
    const profileResult = await db.insert(radiusProfilesTable)
      .values({
        name: 'Profile to Clear',
        upload_speed: 512,
        download_speed: 1024,
        session_timeout: 1800,
        idle_timeout: 120,
        monthly_quota: 500,
        price: '19.99',
        description: 'Profile that will be cleared'
      })
      .returning()
      .execute();

    const profileId = profileResult[0].id;

    // Create a user that references this profile
    const userResult = await db.insert(radiusUsersTable)
      .values({
        username: 'temp_user',
        password: 'temp_pass',
        profile_id: profileId,
        full_name: 'Temporary User',
        email: 'temp@test.com',
        phone: '5555555555',
        address: '789 Temp Rd',
        status: 'active',
        expires_at: null
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // First attempt should fail
    await expect(deleteRadiusProfile({ id: profileId }))
      .rejects.toThrow(/Cannot delete profile: 1 users are still using this profile/i);

    // Remove the dependent user
    await db.delete(radiusUsersTable)
      .where(eq(radiusUsersTable.id, userId))
      .execute();

    // Now deletion should succeed
    const result = await deleteRadiusProfile({ id: profileId });
    expect(result.success).toBe(true);

    // Verify profile is deleted
    const profiles = await db.select()
      .from(radiusProfilesTable)
      .where(eq(radiusProfilesTable.id, profileId))
      .execute();

    expect(profiles).toHaveLength(0);
  });

  it('should handle profiles with nullable fields correctly', async () => {
    // Create a profile with minimal required fields
    const profileResult = await db.insert(radiusProfilesTable)
      .values({
        name: 'Minimal Profile',
        upload_speed: 256,
        download_speed: 512,
        session_timeout: null,
        idle_timeout: null,
        monthly_quota: null,
        price: null,
        description: null
      })
      .returning()
      .execute();

    const profileId = profileResult[0].id;

    // Delete should work fine
    const result = await deleteRadiusProfile({ id: profileId });
    expect(result.success).toBe(true);

    // Verify deletion
    const profiles = await db.select()
      .from(radiusProfilesTable)
      .where(eq(radiusProfilesTable.id, profileId))
      .execute();

    expect(profiles).toHaveLength(0);
  });
});