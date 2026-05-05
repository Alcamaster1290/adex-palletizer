import { createHmac } from "node:crypto";

import { z } from "zod";

import type { DataTradeDatabase } from "./db/client.js";
import { events } from "./db/schema.js";

export const trackedEventNames = [
  "user_signed_up",
  "user_logged_in",
  "module_opened",
  "auth_panel_opened",
  "admin_dashboard_opened",
  "admin_metric_viewed",
  "palletizer_calculation_created",
  "palletizer_calculation_exported",
  "palletizer_input_changed",
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
  .strict();

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

const MAX_METADATA_DEPTH = 6;
const MAX_METADATA_KEYS_PER_OBJECT = 50;
const MAX_METADATA_ARRAY_ITEMS = 100;
const MAX_METADATA_STRING_LENGTH = 2_000;
const RESERVED_IDENTITY_METADATA_KEYS = new Set(["user_id", "userId"]);

export function containsReservedIdentityMetadata(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some((entry) => containsReservedIdentityMetadata(entry));
  }

  return Object.entries(value).some(([key, entry]) =>
    RESERVED_IDENTITY_METADATA_KEYS.has(key) || containsReservedIdentityMetadata(entry),
  );
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return value.length > MAX_METADATA_STRING_LENGTH
      ? value.slice(0, MAX_METADATA_STRING_LENGTH)
      : value;
  }

  if (Array.isArray(value)) {
    if (depth >= MAX_METADATA_DEPTH) {
      return "[max_depth]";
    }

    return value
      .slice(0, MAX_METADATA_ARRAY_ITEMS)
      .map((entry) => sanitizeValue(entry, depth + 1));
  }

  if (value && typeof value === "object") {
    if (depth >= MAX_METADATA_DEPTH) {
      return "[max_depth]";
    }

    const sanitized: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value).slice(0, MAX_METADATA_KEYS_PER_OBJECT)) {
      sanitized[key.slice(0, 160)] = sanitizeValue(entry, depth + 1);
    }
    return sanitized;
  }

  return null;
}

export function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return sanitizeValue(metadata, 0) as Record<string, unknown>;
}

export function createEventTracker(db: DataTradeDatabase) {
  return async function trackEvent(input: TrackEventInput): Promise<TrackedEvent> {
    const metadata = sanitizeMetadata(input.metadata);
    const inserted = await db
      .insert(events)
      .values({
        userId: input.userId ?? null,
        anonymousId: input.anonymousId ?? null,
        module: input.module,
        eventName: input.eventName,
        metadata,
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
