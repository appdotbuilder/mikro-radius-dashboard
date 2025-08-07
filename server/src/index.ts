import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';

// Import schemas
import {
  createMikrotikDeviceInputSchema,
  updateMikrotikDeviceInputSchema,
  createRadiusProfileInputSchema,
  updateRadiusProfileInputSchema,
  createRadiusUserInputSchema,
  updateRadiusUserInputSchema,
  activityLogFilterSchema,
  deviceIdSchema
} from './schema';

// Import handlers
import { createMikrotikDevice } from './handlers/create_mikrotik_device';
import { getMikrotikDevices } from './handlers/get_mikrotik_devices';
import { updateMikrotikDevice } from './handlers/update_mikrotik_device';
import { getDeviceMonitoring } from './handlers/get_device_monitoring';
import { getInterfaceTraffic } from './handlers/get_interface_traffic';
import { getActiveUsers } from './handlers/get_active_users';
import { createRadiusProfile } from './handlers/create_radius_profile';
import { getRadiusProfiles } from './handlers/get_radius_profiles';
import { updateRadiusProfile } from './handlers/update_radius_profile';
import { createRadiusUser } from './handlers/create_radius_user';
import { getRadiusUsers } from './handlers/get_radius_users';
import { updateRadiusUser } from './handlers/update_radius_user';
import { getActivityLogs } from './handlers/get_activity_logs';
import { refreshDeviceStatus } from './handlers/refresh_device_status';
import { deleteRadiusUser } from './handlers/delete_radius_user';
import { deleteRadiusProfile } from './handlers/delete_radius_profile';
import { z } from 'zod';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Mikrotik Device Management
  createMikrotikDevice: publicProcedure
    .input(createMikrotikDeviceInputSchema)
    .mutation(({ input }) => createMikrotikDevice(input)),

  getMikrotikDevices: publicProcedure
    .query(() => getMikrotikDevices()),

  updateMikrotikDevice: publicProcedure
    .input(updateMikrotikDeviceInputSchema)
    .mutation(({ input }) => updateMikrotikDevice(input)),

  refreshDeviceStatus: publicProcedure
    .input(deviceIdSchema)
    .mutation(({ input }) => refreshDeviceStatus(input)),

  // Mikrotik Monitoring
  getDeviceMonitoring: publicProcedure
    .input(deviceIdSchema)
    .query(({ input }) => getDeviceMonitoring(input)),

  getInterfaceTraffic: publicProcedure
    .input(deviceIdSchema)
    .query(({ input }) => getInterfaceTraffic(input)),

  getActiveUsers: publicProcedure
    .input(deviceIdSchema)
    .query(({ input }) => getActiveUsers(input)),

  // Radius Profile Management
  createRadiusProfile: publicProcedure
    .input(createRadiusProfileInputSchema)
    .mutation(({ input }) => createRadiusProfile(input)),

  getRadiusProfiles: publicProcedure
    .query(() => getRadiusProfiles()),

  updateRadiusProfile: publicProcedure
    .input(updateRadiusProfileInputSchema)
    .mutation(({ input }) => updateRadiusProfile(input)),

  deleteRadiusProfile: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deleteRadiusProfile(input)),

  // Radius User Management
  createRadiusUser: publicProcedure
    .input(createRadiusUserInputSchema)
    .mutation(({ input }) => createRadiusUser(input)),

  getRadiusUsers: publicProcedure
    .query(() => getRadiusUsers()),

  updateRadiusUser: publicProcedure
    .input(updateRadiusUserInputSchema)
    .mutation(({ input }) => updateRadiusUser(input)),

  deleteRadiusUser: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deleteRadiusUser(input)),

  // Activity Logs
  getActivityLogs: publicProcedure
    .input(activityLogFilterSchema.optional())
    .query(({ input }) => getActivityLogs(input)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`Mikrotik Dashboard & Radius Billing TRPC server listening at port: ${port}`);
}

start();