import "dotenv/config";

import { sql } from "drizzle-orm";
import { pathToFileURL } from "node:url";
import { z } from "zod";

import { createDatabase, type DataTradeDatabase } from "../db/client.js";

const dateStringSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "Invalid date.");

export const aggregateMetricsRangeSchema = z
  .object({
    from: dateStringSchema.optional(),
    to: dateStringSchema.optional(),
  })
  .strict()
  .refine((value) => {
    if (!value.from || !value.to) {
      return true;
    }

    return value.from <= value.to;
  }, {
    message: "from must be before or equal to to",
    path: ["from"],
  });

export interface AggregateMetricsInput {
  from?: string;
  to?: string;
}

export interface AggregateMetricsResult {
  from: string;
  to: string;
  events_read: number;
  module_rows: number;
  user_rows: number;
}

export interface EventMetricInput {
  user_id: string | null;
  anonymous_id: string | null;
  module: string;
  event_name: string;
  created_at: string | Date;
}

export interface DailyModuleMetric {
  date: string;
  module_code: string;
  events_count: number;
  unique_users: number;
  anonymous_users: number;
  sessions_count: number;
  calculations_count: number;
  errors_count: number;
}

export interface DailyUserMetric {
  date: string;
  user_id: string;
  events_count: number;
  modules_used_count: number;
  sessions_count: number;
  last_event_at: string;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function dateStringFrom(value: string | Date): string {
  return (value instanceof Date ? value.toISOString() : value).slice(0, 10);
}

function dateTimeStringFrom(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

function normalizeRange(input: AggregateMetricsInput): { from: string; to: string } {
  const parsed = aggregateMetricsRangeSchema.parse(input);
  const to = parsed.to ?? todayDateString();
  const from = parsed.from ?? addDays(new Date(`${to}T00:00:00.000Z`), -29).toISOString().slice(0, 10);

  aggregateMetricsRangeSchema.parse({ from, to });
  return { from, to };
}

export function getRangeDays(from: string, to: string): number {
  const fromDate = new Date(`${from}T00:00:00.000Z`).getTime();
  const toDate = new Date(`${to}T00:00:00.000Z`).getTime();
  return Math.floor((toDate - fromDate) / 86_400_000) + 1;
}

export function summarizeDailyMetrics(events: EventMetricInput[]): {
  moduleMetrics: DailyModuleMetric[];
  userMetrics: DailyUserMetric[];
} {
  const moduleBuckets = new Map<string, {
    date: string;
    module_code: string;
    events_count: number;
    userIds: Set<string>;
    anonymousIds: Set<string>;
    sessions_count: number;
    calculations_count: number;
    errors_count: number;
  }>();
  const userBuckets = new Map<string, {
    date: string;
    user_id: string;
    events_count: number;
    modules: Set<string>;
    sessions_count: number;
    last_event_at: string;
  }>();

  for (const event of events) {
    const date = dateStringFrom(event.created_at);
    const createdAt = dateTimeStringFrom(event.created_at);
    const moduleKey = `${date}:${event.module}`;
    const moduleBucket = moduleBuckets.get(moduleKey) ?? {
      date,
      module_code: event.module,
      events_count: 0,
      userIds: new Set<string>(),
      anonymousIds: new Set<string>(),
      sessions_count: 0,
      calculations_count: 0,
      errors_count: 0,
    };

    moduleBucket.events_count += 1;
    if (event.user_id) {
      moduleBucket.userIds.add(event.user_id);
    }
    if (event.anonymous_id) {
      moduleBucket.anonymousIds.add(event.anonymous_id);
    }
    if (event.event_name === "session_started") {
      moduleBucket.sessions_count += 1;
    }
    if (event.event_name === "palletizer_calculation_created") {
      moduleBucket.calculations_count += 1;
    }
    if (event.event_name === "api_error") {
      moduleBucket.errors_count += 1;
    }
    moduleBuckets.set(moduleKey, moduleBucket);

    if (event.user_id) {
      const userKey = `${date}:${event.user_id}`;
      const userBucket = userBuckets.get(userKey) ?? {
        date,
        user_id: event.user_id,
        events_count: 0,
        modules: new Set<string>(),
        sessions_count: 0,
        last_event_at: createdAt,
      };

      userBucket.events_count += 1;
      userBucket.modules.add(event.module);
      if (event.event_name === "session_started") {
        userBucket.sessions_count += 1;
      }
      if (createdAt > userBucket.last_event_at) {
        userBucket.last_event_at = createdAt;
      }
      userBuckets.set(userKey, userBucket);
    }
  }

  return {
    moduleMetrics: [...moduleBuckets.values()]
      .map((bucket) => ({
        date: bucket.date,
        module_code: bucket.module_code,
        events_count: bucket.events_count,
        unique_users: bucket.userIds.size,
        anonymous_users: bucket.anonymousIds.size,
        sessions_count: bucket.sessions_count,
        calculations_count: bucket.calculations_count,
        errors_count: bucket.errors_count,
      }))
      .sort((left, right) => `${left.date}:${left.module_code}`.localeCompare(`${right.date}:${right.module_code}`)),
    userMetrics: [...userBuckets.values()]
      .map((bucket) => ({
        date: bucket.date,
        user_id: bucket.user_id,
        events_count: bucket.events_count,
        modules_used_count: bucket.modules.size,
        sessions_count: bucket.sessions_count,
        last_event_at: bucket.last_event_at,
      }))
      .sort((left, right) => `${left.date}:${left.user_id}`.localeCompare(`${right.date}:${right.user_id}`)),
  };
}

async function fetchEvents(db: DataTradeDatabase, from: string, to: string): Promise<EventMetricInput[]> {
  const rows = await db.execute(sql`
    SELECT user_id, anonymous_id, module, event_name, created_at
    FROM data_trade.events
    WHERE created_at >= ${from}::date
      AND created_at < (${to}::date + interval '1 day')
    ORDER BY created_at ASC
  `);

  return rows as unknown as EventMetricInput[];
}

async function upsertModuleMetric(db: DataTradeDatabase, metric: DailyModuleMetric) {
  await db.execute(sql`
    INSERT INTO data_trade.daily_module_metrics (
      date,
      module_code,
      events_count,
      unique_users,
      anonymous_users,
      sessions_count,
      calculations_count,
      errors_count,
      updated_at
    )
    VALUES (
      ${metric.date}::date,
      ${metric.module_code},
      ${metric.events_count},
      ${metric.unique_users},
      ${metric.anonymous_users},
      ${metric.sessions_count},
      ${metric.calculations_count},
      ${metric.errors_count},
      now()
    )
    ON CONFLICT (date, module_code)
    DO UPDATE SET
      events_count = EXCLUDED.events_count,
      unique_users = EXCLUDED.unique_users,
      anonymous_users = EXCLUDED.anonymous_users,
      sessions_count = EXCLUDED.sessions_count,
      calculations_count = EXCLUDED.calculations_count,
      errors_count = EXCLUDED.errors_count,
      updated_at = now()
  `);
}

async function upsertUserMetric(db: DataTradeDatabase, metric: DailyUserMetric) {
  await db.execute(sql`
    INSERT INTO data_trade.daily_user_metrics (
      date,
      user_id,
      events_count,
      modules_used_count,
      sessions_count,
      last_event_at,
      updated_at
    )
    VALUES (
      ${metric.date}::date,
      ${metric.user_id},
      ${metric.events_count},
      ${metric.modules_used_count},
      ${metric.sessions_count},
      ${metric.last_event_at},
      now()
    )
    ON CONFLICT (date, user_id)
    DO UPDATE SET
      events_count = EXCLUDED.events_count,
      modules_used_count = EXCLUDED.modules_used_count,
      sessions_count = EXCLUDED.sessions_count,
      last_event_at = EXCLUDED.last_event_at,
      updated_at = now()
  `);
}

export async function aggregateDailyMetrics(
  db: DataTradeDatabase,
  input: AggregateMetricsInput = {},
): Promise<AggregateMetricsResult> {
  const range = normalizeRange(input);
  const events = await fetchEvents(db, range.from, range.to);
  const summary = summarizeDailyMetrics(events);

  for (const metric of summary.moduleMetrics) {
    await upsertModuleMetric(db, metric);
  }
  for (const metric of summary.userMetrics) {
    await upsertUserMetric(db, metric);
  }

  return {
    ...range,
    events_read: events.length,
    module_rows: summary.moduleMetrics.length,
    user_rows: summary.userMetrics.length,
  };
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to aggregate metrics.");
  }

  const connection = createDatabase(databaseUrl);
  try {
    const result = await aggregateDailyMetrics(connection.db, {
      from: process.env.METRICS_FROM,
      to: process.env.METRICS_TO,
    });
    process.stdout.write(`Aggregated Data Trade metrics from ${result.from} to ${result.to}.\n`);
    process.stdout.write(`Events read: ${result.events_read}.\n`);
    process.stdout.write(`Module rows upserted: ${result.module_rows}.\n`);
    process.stdout.write(`User rows upserted: ${result.user_rows}.\n`);
  } finally {
    await connection.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
