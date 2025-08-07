import { type DeviceIdInput, type ActiveUser } from '../schema';

export async function getActiveUsers(input: DeviceIdInput): Promise<ActiveUser[]> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is fetching currently active/connected users from a specific Mikrotik device.
    // Should connect to Mikrotik API and retrieve active PPPoE/Hotspot sessions with user details.
    return [];
}