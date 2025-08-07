import { z } from 'zod';

// Mikrotik device schema
export const mikrotikDeviceSchema = z.object({
  id: z.number(),
  name: z.string(),
  ip_address: z.string(),
  username: z.string(),
  password: z.string(),
  port: z.number().default(8728),
  status: z.enum(['online', 'offline', 'error']),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type MikrotikDevice = z.infer<typeof mikrotikDeviceSchema>;

// Mikrotik monitoring data schema
export const mikrotikMonitoringSchema = z.object({
  id: z.number(),
  device_id: z.number(),
  cpu_usage: z.number(),
  ram_usage: z.number(),
  total_ram: z.number(),
  uptime: z.string(),
  recorded_at: z.coerce.date()
});

export type MikrotikMonitoring = z.infer<typeof mikrotikMonitoringSchema>;

// Interface traffic schema
export const interfaceTrafficSchema = z.object({
  id: z.number(),
  device_id: z.number(),
  interface_name: z.string(),
  rx_bytes: z.number(),
  tx_bytes: z.number(),
  rx_packets: z.number(),
  tx_packets: z.number(),
  recorded_at: z.coerce.date()
});

export type InterfaceTraffic = z.infer<typeof interfaceTrafficSchema>;

// Active user schema
export const activeUserSchema = z.object({
  id: z.number(),
  device_id: z.number(),
  username: z.string(),
  ip_address: z.string(),
  mac_address: z.string().nullable(),
  session_time: z.string(),
  bytes_in: z.number(),
  bytes_out: z.number(),
  status: z.enum(['active', 'idle', 'disabled']),
  last_seen: z.coerce.date()
});

export type ActiveUser = z.infer<typeof activeUserSchema>;

// Radius user schema
export const radiusUserSchema = z.object({
  id: z.number(),
  username: z.string(),
  password: z.string(),
  profile_id: z.number(),
  full_name: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  status: z.enum(['active', 'suspended', 'expired']),
  created_at: z.coerce.date(),
  expires_at: z.coerce.date().nullable()
});

export type RadiusUser = z.infer<typeof radiusUserSchema>;

// Radius profile schema
export const radiusProfileSchema = z.object({
  id: z.number(),
  name: z.string(),
  upload_speed: z.number(), // in kbps
  download_speed: z.number(), // in kbps
  session_timeout: z.number().nullable(), // in seconds
  idle_timeout: z.number().nullable(), // in seconds
  monthly_quota: z.number().nullable(), // in MB
  price: z.number().nullable(),
  description: z.string().nullable(),
  created_at: z.coerce.date()
});

export type RadiusProfile = z.infer<typeof radiusProfileSchema>;

// Activity log schema
export const activityLogSchema = z.object({
  id: z.number(),
  user_id: z.number().nullable(),
  username: z.string(),
  action: z.enum(['login', 'logout', 'session_start', 'session_end', 'account_created', 'account_updated', 'account_suspended']),
  ip_address: z.string().nullable(),
  mac_address: z.string().nullable(),
  bytes_in: z.number().nullable(),
  bytes_out: z.number().nullable(),
  session_duration: z.number().nullable(), // in seconds
  created_at: z.coerce.date()
});

export type ActivityLog = z.infer<typeof activityLogSchema>;

// Input schemas for creating/updating data
export const createMikrotikDeviceInputSchema = z.object({
  name: z.string(),
  ip_address: z.string(),
  username: z.string(),
  password: z.string(),
  port: z.number().default(8728)
});

export type CreateMikrotikDeviceInput = z.infer<typeof createMikrotikDeviceInputSchema>;

export const updateMikrotikDeviceInputSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  ip_address: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  port: z.number().optional()
});

export type UpdateMikrotikDeviceInput = z.infer<typeof updateMikrotikDeviceInputSchema>;

export const createRadiusUserInputSchema = z.object({
  username: z.string(),
  password: z.string(),
  profile_id: z.number(),
  full_name: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  expires_at: z.coerce.date().nullable()
});

export type CreateRadiusUserInput = z.infer<typeof createRadiusUserInputSchema>;

export const updateRadiusUserInputSchema = z.object({
  id: z.number(),
  password: z.string().optional(),
  profile_id: z.number().optional(),
  full_name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  status: z.enum(['active', 'suspended', 'expired']).optional(),
  expires_at: z.coerce.date().nullable().optional()
});

export type UpdateRadiusUserInput = z.infer<typeof updateRadiusUserInputSchema>;

export const createRadiusProfileInputSchema = z.object({
  name: z.string(),
  upload_speed: z.number(),
  download_speed: z.number(),
  session_timeout: z.number().nullable(),
  idle_timeout: z.number().nullable(),
  monthly_quota: z.number().nullable(),
  price: z.number().nullable(),
  description: z.string().nullable()
});

export type CreateRadiusProfileInput = z.infer<typeof createRadiusProfileInputSchema>;

export const updateRadiusProfileInputSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  upload_speed: z.number().optional(),
  download_speed: z.number().optional(),
  session_timeout: z.number().nullable().optional(),
  idle_timeout: z.number().nullable().optional(),
  monthly_quota: z.number().nullable().optional(),
  price: z.number().nullable().optional(),
  description: z.string().nullable().optional()
});

export type UpdateRadiusProfileInput = z.infer<typeof updateRadiusProfileInputSchema>;

// Query filters
export const activityLogFilterSchema = z.object({
  username: z.string().optional(),
  action: z.enum(['login', 'logout', 'session_start', 'session_end', 'account_created', 'account_updated', 'account_suspended']).optional(),
  start_date: z.coerce.date().optional(),
  end_date: z.coerce.date().optional(),
  limit: z.number().default(100),
  offset: z.number().default(0)
});

export type ActivityLogFilter = z.infer<typeof activityLogFilterSchema>;

export const deviceIdSchema = z.object({
  device_id: z.number()
});

export type DeviceIdInput = z.infer<typeof deviceIdSchema>;