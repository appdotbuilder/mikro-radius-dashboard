import { db } from '../db';
import { activityLogsTable } from '../db/schema';
import { type ActivityLogFilter, type ActivityLog } from '../schema';
import { eq, gte, lte, and, desc, type SQL } from 'drizzle-orm';

export const getActivityLogs = async (input: Partial<ActivityLogFilter> = {}): Promise<ActivityLog[]> => {
  try {
    // Apply defaults for pagination
    const filter = {
      limit: 100,
      offset: 0,
      ...input
    };

    // Build conditions array for filtering
    const conditions: SQL<unknown>[] = [];

    // Filter by username if provided
    if (filter.username) {
      conditions.push(eq(activityLogsTable.username, filter.username));
    }

    // Filter by action if provided
    if (filter.action) {
      conditions.push(eq(activityLogsTable.action, filter.action));
    }

    // Filter by date range if provided
    if (filter.start_date) {
      conditions.push(gte(activityLogsTable.created_at, filter.start_date));
    }

    if (filter.end_date) {
      conditions.push(lte(activityLogsTable.created_at, filter.end_date));
    }

    // Build query with all clauses at once to avoid type issues
    const baseQuery = db.select().from(activityLogsTable);
    
    const finalQuery = conditions.length > 0 
      ? baseQuery
          .where(conditions.length === 1 ? conditions[0] : and(...conditions))
          .orderBy(desc(activityLogsTable.created_at))
          .limit(filter.limit)
          .offset(filter.offset)
      : baseQuery
          .orderBy(desc(activityLogsTable.created_at))
          .limit(filter.limit)
          .offset(filter.offset);

    // Execute query
    const results = await finalQuery.execute();

    // Convert numeric fields from string to number for return
    return results.map(log => ({
      ...log,
      bytes_in: log.bytes_in ? parseFloat(log.bytes_in) : null,
      bytes_out: log.bytes_out ? parseFloat(log.bytes_out) : null
    }));
  } catch (error) {
    console.error('Failed to fetch activity logs:', error);
    throw error;
  }
};