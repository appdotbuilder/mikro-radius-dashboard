import { serial, text, pgTable, timestamp, numeric, integer, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const deviceStatusEnum = pgEnum('device_status', ['online', 'offline', 'error']);
export const userStatusEnum = pgEnum('user_status', ['active', 'idle', 'disabled']);
export const radiusUserStatusEnum = pgEnum('radius_user_status', ['active', 'suspended', 'expired']);
export const activityActionEnum = pgEnum('activity_action', [
  'login', 'logout', 'session_start', 'session_end', 
  'account_created', 'account_updated', 'account_suspended'
]);

// Mikrotik devices table
export const mikrotikDevicesTable = pgTable('mikrotik_devices', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  ip_address: text('ip_address').notNull(),
  username: text('username').notNull(),
  password: text('password').notNull(),
  port: integer('port').notNull().default(8728),
  status: deviceStatusEnum('status').notNull().default('offline'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Mikrotik monitoring data table
export const mikrotikMonitoringTable = pgTable('mikrotik_monitoring', {
  id: serial('id').primaryKey(),
  device_id: integer('device_id').notNull(),
  cpu_usage: numeric('cpu_usage', { precision: 5, scale: 2 }).notNull(),
  ram_usage: numeric('ram_usage', { precision: 10, scale: 2 }).notNull(),
  total_ram: numeric('total_ram', { precision: 10, scale: 2 }).notNull(),
  uptime: text('uptime').notNull(),
  recorded_at: timestamp('recorded_at').defaultNow().notNull(),
});

// Interface traffic table
export const interfaceTrafficTable = pgTable('interface_traffic', {
  id: serial('id').primaryKey(),
  device_id: integer('device_id').notNull(),
  interface_name: text('interface_name').notNull(),
  rx_bytes: numeric('rx_bytes', { precision: 20, scale: 0 }).notNull(),
  tx_bytes: numeric('tx_bytes', { precision: 20, scale: 0 }).notNull(),
  rx_packets: numeric('rx_packets', { precision: 20, scale: 0 }).notNull(),
  tx_packets: numeric('tx_packets', { precision: 20, scale: 0 }).notNull(),
  recorded_at: timestamp('recorded_at').defaultNow().notNull(),
});

// Active users table
export const activeUsersTable = pgTable('active_users', {
  id: serial('id').primaryKey(),
  device_id: integer('device_id').notNull(),
  username: text('username').notNull(),
  ip_address: text('ip_address').notNull(),
  mac_address: text('mac_address'),
  session_time: text('session_time').notNull(),
  bytes_in: numeric('bytes_in', { precision: 20, scale: 0 }).notNull(),
  bytes_out: numeric('bytes_out', { precision: 20, scale: 0 }).notNull(),
  status: userStatusEnum('status').notNull().default('active'),
  last_seen: timestamp('last_seen').defaultNow().notNull(),
});

// Radius profiles table
export const radiusProfilesTable = pgTable('radius_profiles', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  upload_speed: integer('upload_speed').notNull(), // in kbps
  download_speed: integer('download_speed').notNull(), // in kbps
  session_timeout: integer('session_timeout'), // in seconds
  idle_timeout: integer('idle_timeout'), // in seconds
  monthly_quota: integer('monthly_quota'), // in MB
  price: numeric('price', { precision: 10, scale: 2 }),
  description: text('description'),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Radius users table
export const radiusUsersTable = pgTable('radius_users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull(),
  password: text('password').notNull(),
  profile_id: integer('profile_id').notNull(),
  full_name: text('full_name'),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  status: radiusUserStatusEnum('status').notNull().default('active'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  expires_at: timestamp('expires_at'),
});

// Activity logs table
export const activityLogsTable = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id'),
  username: text('username').notNull(),
  action: activityActionEnum('action').notNull(),
  ip_address: text('ip_address'),
  mac_address: text('mac_address'),
  bytes_in: numeric('bytes_in', { precision: 20, scale: 0 }),
  bytes_out: numeric('bytes_out', { precision: 20, scale: 0 }),
  session_duration: integer('session_duration'), // in seconds
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const mikrotikDevicesRelations = relations(mikrotikDevicesTable, ({ many }) => ({
  monitoring: many(mikrotikMonitoringTable),
  interfaceTraffic: many(interfaceTrafficTable),
  activeUsers: many(activeUsersTable),
}));

export const mikrotikMonitoringRelations = relations(mikrotikMonitoringTable, ({ one }) => ({
  device: one(mikrotikDevicesTable, {
    fields: [mikrotikMonitoringTable.device_id],
    references: [mikrotikDevicesTable.id],
  }),
}));

export const interfaceTrafficRelations = relations(interfaceTrafficTable, ({ one }) => ({
  device: one(mikrotikDevicesTable, {
    fields: [interfaceTrafficTable.device_id],
    references: [mikrotikDevicesTable.id],
  }),
}));

export const activeUsersRelations = relations(activeUsersTable, ({ one }) => ({
  device: one(mikrotikDevicesTable, {
    fields: [activeUsersTable.device_id],
    references: [mikrotikDevicesTable.id],
  }),
}));

export const radiusUsersRelations = relations(radiusUsersTable, ({ one, many }) => ({
  profile: one(radiusProfilesTable, {
    fields: [radiusUsersTable.profile_id],
    references: [radiusProfilesTable.id],
  }),
  activityLogs: many(activityLogsTable),
}));

export const radiusProfilesRelations = relations(radiusProfilesTable, ({ many }) => ({
  users: many(radiusUsersTable),
}));

export const activityLogsRelations = relations(activityLogsTable, ({ one }) => ({
  user: one(radiusUsersTable, {
    fields: [activityLogsTable.user_id],
    references: [radiusUsersTable.id],
  }),
}));

// TypeScript types for the table schemas
export type MikrotikDevice = typeof mikrotikDevicesTable.$inferSelect;
export type NewMikrotikDevice = typeof mikrotikDevicesTable.$inferInsert;

export type MikrotikMonitoring = typeof mikrotikMonitoringTable.$inferSelect;
export type NewMikrotikMonitoring = typeof mikrotikMonitoringTable.$inferInsert;

export type InterfaceTraffic = typeof interfaceTrafficTable.$inferSelect;
export type NewInterfaceTraffic = typeof interfaceTrafficTable.$inferInsert;

export type ActiveUser = typeof activeUsersTable.$inferSelect;
export type NewActiveUser = typeof activeUsersTable.$inferInsert;

export type RadiusProfile = typeof radiusProfilesTable.$inferSelect;
export type NewRadiusProfile = typeof radiusProfilesTable.$inferInsert;

export type RadiusUser = typeof radiusUsersTable.$inferSelect;
export type NewRadiusUser = typeof radiusUsersTable.$inferInsert;

export type ActivityLog = typeof activityLogsTable.$inferSelect;
export type NewActivityLog = typeof activityLogsTable.$inferInsert;

// Export all tables for proper query building
export const tables = {
  mikrotikDevices: mikrotikDevicesTable,
  mikrotikMonitoring: mikrotikMonitoringTable,
  interfaceTraffic: interfaceTrafficTable,
  activeUsers: activeUsersTable,
  radiusProfiles: radiusProfilesTable,
  radiusUsers: radiusUsersTable,
  activityLogs: activityLogsTable,
};