import { createHmac } from "node:crypto";

import { z } from "zod";

import type { DataTradeDatabase } from "./db/client.js";
import { events } from "./db/schema.js";

export const trackedEventNames = [
  "user_signed_up",
  "user_logged_in",
  "module_opened",
  "palletizer_calculation_created",
  "map_layer_toggled",
  "search_performed",
  "file_uploaded",
  "export_generated",
  "admin_view_opened",
  "api_error",
  "session_started",
  "session_ended",
] as const;

export const trackedModules = [
  "sislope",
  "adex_palletizer",
  "data_trade_analytics",
  "alvin",
  "admin",
  "api",
  "unknown",
] as const;

export const trackEventBodySchema = z
  .object({
    userId: z.uuid().optional(),
    anonymousId: z.string().trim().min(1).max(160).optional(),
    module: z.enum(trackedModules).default("unknown"),
    eventName: z.enum(trackedEventNames),
    metadata: z.record(z.string(), z.unknown()).default({}),
    path: z.string().trim().max(2048).optional(),
  })
  .strict()
  .refine((value) => value.userId || value.anonymousId, {
    message: "userId or anonymousId is required",
    path: ["anonymousId"],
  });

export type TrackEventInput = z.infer<typeof trackEventBodySchema> & {
  userAgent?: string | null;
  ipHash?: string | null;
};

export interface TrackedEvent {
  id: string;
  module: string;
  eventName: string;
  createdAt: string;
}

export function hashIpAddress(ipAddress: string | null | undefined, secret: string): string | null {
  if (!ipAddress) {
    return null;
  }

  return createHmac("sha256", secret).update(ipAddress).digest("hex");
}

export function getJsonByteLength(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

export function createEventTracker(db: DataTradeDatabase) {
  return async function trackEvent(input: TrackEventInput): Promise<TrackedEvent> {
    const inserted = await db
      .insert(events)
      .values({
        userId: input.userId ?? null,
        anonymousId: input.anonymousId ?? null,
        module: input.module,
        eventName: input.eventName,
        metadata: input.metadata,
        path: input.path ?? null,
        userAgent: input.userAgent ?? null,
        ipHash: input.ipHash ?? null,
      })
      .returning({
        id: events.id,
        module: events.module,
        eventName: events.eventName,
        createdAt: events.createdAt,
      });

    const event = inserted[0];
    if (!event) {
      throw new Error("EVENT_INSERT_FAILED");
    }

    return event;
  };
}
