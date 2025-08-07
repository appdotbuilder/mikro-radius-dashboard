import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { activityLogsTable, radiusUsersTable, radiusProfilesTable } from '../db/schema';
import { type ActivityLogFilter } from '../schema';
import { getActivityLogs } from '../handlers/get_activity_logs';
import { eq } from 'drizzle-orm';

describe('getActivityLogs', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create test data
  const createTestData = async () => {
    // Create a radius profile first
    const profile = await db.insert(radiusProfilesTable)
      .values({
        name: 'Test Profile',
        upload_speed: 1024,
        download_speed: 2048,
        session_timeout: null,
        idle_timeout: null,
        monthly_quota: null,
        price: '29.99',
        description: 'Test profile'
      })
      .returning()
      .execute();

    // Create a radius user
    const user = await db.insert(radiusUsersTable)
      .values({
        username: 'testuser',
        password: 'password123',
        profile_id: profile[0].id,
        full_name: 'Test User',
        email: 'test@example.com',
        phone: null,
        address: null,
        status: 'active',
        expires_at: null
      })
      .returning()
      .execute();

    // Create activity logs with different actions and specific dates
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setHours(yesterday.getHours() - 24); // Exactly 24 hours ago
    const twoDaysAgo = new Date(now);
    twoDaysAgo.setHours(twoDaysAgo.getHours() - 48); // Exactly 48 hours ago

    await db.insert(activityLogsTable)
      .values([
        {
          user_id: user[0].id,
          username: 'testuser',
          action: 'login',
          ip_address: '192.168.1.100',
          mac_address: '00:11:22:33:44:55',
          bytes_in: '1024000',
          bytes_out: '2048000',
          session_duration: 3600,
          created_at: now
        },
        {
          user_id: user[0].id,
          username: 'testuser',
          action: 'logout',
          ip_address: '192.168.1.100',
          mac_address: '00:11:22:33:44:55',
          bytes_in: '2048000',
          bytes_out: '4096000',
          session_duration: 7200,
          created_at: yesterday
        },
        {
          user_id: null,
          username: 'anotheruser',
          action: 'session_start',
          ip_address: '192.168.1.101',
          mac_address: null,
          bytes_in: null,
          bytes_out: null,
          session_duration: null,
          created_at: twoDaysAgo
        },
        {
          user_id: user[0].id,
          username: 'testuser',
          action: 'account_created',
          ip_address: null,
          mac_address: null,
          bytes_in: null,
          bytes_out: null,
          session_duration: null,
          created_at: twoDaysAgo
        }
      ])
      .execute();

    return { 
      userId: user[0].id, 
      profileId: profile[0].id,
      dates: { now, yesterday, twoDaysAgo }
    };
  };

  it('should return all activity logs when no filter is provided', async () => {
    await createTestData();

    const result = await getActivityLogs();

    expect(result).toHaveLength(4);
    expect(result[0].action).toEqual('login'); // Most recent first
    expect(result[1].action).toEqual('logout');
    expect(result[2].username).toEqual('anotheruser');
    expect(result[3].action).toEqual('account_created'); // Oldest last
  });

  it('should filter by username', async () => {
    await createTestData();

    const filter = {
      username: 'testuser'
    };

    const result = await getActivityLogs(filter);

    expect(result).toHaveLength(3);
    result.forEach(log => {
      expect(log.username).toEqual('testuser');
    });
  });

  it('should filter by action', async () => {
    await createTestData();

    const filter = {
      action: 'login' as const
    };

    const result = await getActivityLogs(filter);

    expect(result).toHaveLength(1);
    expect(result[0].action).toEqual('login');
    expect(result[0].username).toEqual('testuser');
  });

  it('should filter by date range', async () => {
    const { dates } = await createTestData();

    // Use a wider range to ensure we capture yesterday's data
    const startRange = new Date(dates.yesterday);
    startRange.setHours(startRange.getHours() - 1); // 1 hour before yesterday
    const endRange = new Date(dates.now);
    endRange.setHours(endRange.getHours() + 1); // 1 hour after now

    const filter = {
      start_date: startRange,
      end_date: endRange
    };

    const result = await getActivityLogs(filter);

    expect(result).toHaveLength(2); // login (today) and logout (yesterday)
    expect(result[0].action).toEqual('login');
    expect(result[1].action).toEqual('logout');
  });

  it('should filter by start date only', async () => {
    const { dates } = await createTestData();

    // Use yesterday minus 1 hour to ensure we capture yesterday's logout
    const startDate = new Date(dates.yesterday);
    startDate.setHours(startDate.getHours() - 1);

    const filter = {
      start_date: startDate
    };

    const result = await getActivityLogs(filter);

    expect(result).toHaveLength(2); // login and logout (not the older ones)
    result.forEach(log => {
      expect(log.created_at >= startDate).toBe(true);
    });
  });

  it('should apply pagination with limit and offset', async () => {
    await createTestData();

    const filter = {
      limit: 2,
      offset: 0
    };

    const firstPage = await getActivityLogs(filter);
    expect(firstPage).toHaveLength(2);

    const filter2 = {
      limit: 2,
      offset: 2
    };

    const secondPage = await getActivityLogs(filter2);
    expect(secondPage).toHaveLength(2);

    // Ensure no overlap between pages
    const firstPageIds = firstPage.map(log => log.id);
    const secondPageIds = secondPage.map(log => log.id);
    const overlap = firstPageIds.filter(id => secondPageIds.includes(id));
    expect(overlap).toHaveLength(0);
  });

  it('should combine multiple filters', async () => {
    const { dates } = await createTestData();

    // Use date range that includes yesterday's logout
    const startDate = new Date(dates.yesterday);
    startDate.setHours(startDate.getHours() - 1);

    const filter = {
      username: 'testuser',
      action: 'logout' as const,
      start_date: startDate
    };

    const result = await getActivityLogs(filter);

    expect(result).toHaveLength(1);
    expect(result[0].username).toEqual('testuser');
    expect(result[0].action).toEqual('logout');
  });

  it('should convert numeric fields correctly', async () => {
    await createTestData();

    const filter = {
      username: 'testuser',
      action: 'login' as const
    };

    const result = await getActivityLogs(filter);

    expect(result).toHaveLength(1);
    expect(typeof result[0].bytes_in).toBe('number');
    expect(typeof result[0].bytes_out).toBe('number');
    expect(result[0].bytes_in).toEqual(1024000);
    expect(result[0].bytes_out).toEqual(2048000);
  });

  it('should handle null numeric fields', async () => {
    await createTestData();

    const filter = {
      action: 'session_start' as const
    };

    const result = await getActivityLogs(filter);

    expect(result).toHaveLength(1);
    expect(result[0].bytes_in).toBeNull();
    expect(result[0].bytes_out).toBeNull();
    expect(result[0].session_duration).toBeNull();
  });

  it('should return logs ordered by created_at descending', async () => {
    await createTestData();

    const result = await getActivityLogs();

    expect(result).toHaveLength(4);
    
    // Check that dates are in descending order
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].created_at >= result[i + 1].created_at).toBe(true);
    }
  });

  it('should use default pagination values', async () => {
    await createTestData();

    // Test with empty filter (should use defaults)
    const result = await getActivityLogs({});

    expect(result).toHaveLength(4); // Less than default limit of 100
    
    // Verify all required fields are present
    result.forEach(log => {
      expect(log.id).toBeDefined();
      expect(log.username).toBeDefined();
      expect(log.action).toBeDefined();
      expect(log.created_at).toBeInstanceOf(Date);
    });
  });

  it('should verify data is saved correctly in database', async () => {
    const { userId } = await createTestData();

    // Query database directly to verify data integrity
    const dbLogs = await db.select()
      .from(activityLogsTable)
      .where(eq(activityLogsTable.user_id, userId))
      .execute();

    expect(dbLogs).toHaveLength(3);
    
    // Verify numeric fields are stored as strings in DB
    const loginLog = dbLogs.find(log => log.action === 'login');
    expect(loginLog).toBeDefined();
    expect(typeof loginLog!.bytes_in).toBe('string');
    expect(loginLog!.bytes_in).toEqual('1024000');
  });
});