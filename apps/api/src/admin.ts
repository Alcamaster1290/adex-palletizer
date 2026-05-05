import { sql, type SQL } from "drizzle-orm";
import { z } from "zod";

import type { DataTradeDatabase } from "./db/client.js";
import { trackedEventNames, trackedModules } from "./events.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  offset: z.coerce.number().int().min(0).default(0),
});

const dateTimeQuerySchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid datetime.")
  .transform((value) => new Date(value).toISOString());

const dateRangeQuerySchema = z.object({
  from: dateTimeQuerySchema.optional(),
  to: dateTimeQuerySchema.optional(),
});

export const adminUsersQuerySchema = paginationSchema.strict();

export const adminUserActivityParamsSchema = z.object({
  id: z.uuid(),
});

export const adminEventsQuerySchema = paginationSchema
  .extend({
    module: z.enum(trackedModules).optional(),
    event_name: z.enum(trackedEventNames).optional(),
    user_id: z.uuid().optional(),
    anonymous_id: z.string().trim().min(1).max(160).optional(),
  })
  .merge(dateRangeQuerySchema)
  .strict();

export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>;
export type AdminEventsQuery = z.infer<typeof adminEventsQuerySchema>;
export type AdminUserActivityParams = z.infer<typeof adminUserActivityParamsSchema>;

export interface AdminOverview {
  total_users: number;
  active_users_24h: number;
  active_users_7d: number;
  active_users_30d: number;
  total_events: number;
  events_24h: number;
  events_7d: number;
  events_30d: number;
  total_modules: number;
  top_module_by_events: string | null;
  latest_event_at: string | null;
}

export interface AdminService {
  getOverview(): Promise<AdminOverview>;
  listUsers(query: AdminUsersQuery): Promise<unknown>;
  getUserActivity(params: AdminUserActivityParams): Promise<unknown>;
  listEvents(query: AdminEventsQuery): Promise<unknown>;
  getModulesUsage(): Promise<unknown>;
  getRetention(): Promise<unknown>;
  getErrors(): Promise<unknown>;
}

async function queryRows<T extends Record<string, unknown>>(
  db: DataTradeDatabase,
  query: SQL,
): Promise<T[]> {
  const result = await db.execute(query);
  return result as T[];
}

async function queryFirst<T extends Record<string, unknown>>(
  db: DataTradeDatabase,
  query: SQL,
): Promise<T | null> {
  const rows = await queryRows<T>(db, query);
  return rows[0] ?? null;
}

function numberValue(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "string") {
    return Number(value);
  }

  return 0;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isoString(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    return value;
  }

  return null;
}

function eventFilterSql(query: AdminEventsQuery): SQL {
  const filters: SQL[] = [sql`TRUE`];

  if (query.module) {
    filters.push(sql`e.module = ${query.module}`);
  }
  if (query.event_name) {
    filters.push(sql`e.event_name = ${query.event_name}`);
  }
  if (query.user_id) {
    filters.push(sql`e.user_id = ${query.user_id}`);
  }
  if (query.anonymous_id) {
    filters.push(sql`e.anonymous_id = ${query.anonymous_id}`);
  }
  if (query.from) {
    filters.push(sql`e.created_at >= ${query.from}`);
  }
  if (query.to) {
    filters.push(sql`e.created_at <= ${query.to}`);
  }

  return sql.join(filters, sql` AND `);
}

function mapEventRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    user_id: stringValue(row.user_id),
    anonymous_id: stringValue(row.anonymous_id),
    module: String(row.module),
    event_name: String(row.event_name),
    metadata: row.metadata ?? {},
    path: stringValue(row.path),
    created_at: isoString(row.created_at),
  };
}

export function createAdminService(db: DataTradeDatabase): AdminService {
  return {
    async getOverview() {
      const row = await queryFirst<Record<string, unknown>>(db, sql`
        SELECT
          (SELECT COUNT(*) FROM data_trade.users u WHERE u.deleted_at IS NULL)::int AS total_users,
          (
            SELECT COUNT(DISTINCT e.user_id)
            FROM data_trade.events e
            WHERE e.user_id IS NOT NULL
              AND e.created_at >= now() - interval '24 hours'
          )::int AS active_users_24h,
          (
            SELECT COUNT(DISTINCT e.user_id)
            FROM data_trade.events e
            WHERE e.user_id IS NOT NULL
              AND e.created_at >= now() - interval '7 days'
          )::int AS active_users_7d,
          (
            SELECT COUNT(DISTINCT e.user_id)
            FROM data_trade.events e
            WHERE e.user_id IS NOT NULL
              AND e.created_at >= now() - interval '30 days'
          )::int AS active_users_30d,
          (SELECT COUNT(*) FROM data_trade.events)::int AS total_events,
          (
            SELECT COUNT(*)
            FROM data_trade.events e
            WHERE e.created_at >= now() - interval '24 hours'
          )::int AS events_24h,
          (
            SELECT COUNT(*)
            FROM data_trade.events e
            WHERE e.created_at >= now() - interval '7 days'
          )::int AS events_7d,
          (
            SELECT COUNT(*)
            FROM data_trade.events e
            WHERE e.created_at >= now() - interval '30 days'
          )::int AS events_30d,
          (
            SELECT COUNT(*)
            FROM data_trade.modules m
            WHERE m.status = 'active'
          )::int AS total_modules,
          (
            SELECT e.module
            FROM data_trade.events e
            GROUP BY e.module
            ORDER BY COUNT(*) DESC, e.module ASC
            LIMIT 1
          ) AS top_module_by_events,
          (SELECT MAX(e.created_at) FROM data_trade.events e) AS latest_event_at
      `);

      return {
        total_users: numberValue(row?.total_users),
        active_users_24h: numberValue(row?.active_users_24h),
        active_users_7d: numberValue(row?.active_users_7d),
        active_users_30d: numberValue(row?.active_users_30d),
        total_events: numberValue(row?.total_events),
        events_24h: numberValue(row?.events_24h),
        events_7d: numberValue(row?.events_7d),
        events_30d: numberValue(row?.events_30d),
        total_modules: numberValue(row?.total_modules),
        top_module_by_events: stringValue(row?.top_module_by_events),
        latest_event_at: isoString(row?.latest_event_at),
      };
    },

    async listUsers({ limit, offset }) {
      const [totalRow, userRows] = await Promise.all([
        queryFirst<Record<string, unknown>>(db, sql`
          SELECT COUNT(*)::int AS total
          FROM data_trade.users u
          WHERE u.deleted_at IS NULL
        `),
        queryRows<Record<string, unknown>>(db, sql`
          SELECT
            u.id,
            u.email,
            u.display_name AS name,
            CASE
              WHEN EXISTS (
                SELECT 1
                FROM data_trade.user_module_access uma
                INNER JOIN data_trade.modules m ON m.id = uma.module_id
                WHERE uma.user_id = u.id
                  AND uma.revoked_at IS NULL
                  AND m.key = 'admin'
                  AND uma.access_level = 'admin'
              )
              THEN 'admin'
              ELSE 'user'
            END AS role,
            u.created_at,
            (
              SELECT MAX(value)
              FROM (
                VALUES
                  (u.last_login_at),
                  ((SELECT MAX(s.last_seen_at) FROM data_trade.auth_sessions s WHERE s.user_id = u.id)),
                  ((SELECT MAX(e.created_at) FROM data_trade.events e WHERE e.user_id = u.id))
              ) AS last_seen(value)
            ) AS last_seen_at,
            (SELECT COUNT(*) FROM data_trade.events e WHERE e.user_id = u.id)::int AS event_count,
            (SELECT COUNT(DISTINCT e.module) FROM data_trade.events e WHERE e.user_id = u.id)::int AS module_count
          FROM data_trade.users u
          WHERE u.deleted_at IS NULL
          ORDER BY u.created_at DESC
          LIMIT ${limit}
          OFFSET ${offset}
        `),
      ]);

      return {
        users: userRows.map((row) => ({
          id: String(row.id),
          email: String(row.email),
          name: stringValue(row.name),
          role: String(row.role),
          created_at: isoString(row.created_at),
          last_seen_at: isoString(row.last_seen_at),
          event_count: numberValue(row.event_count),
          module_count: numberValue(row.module_count),
        })),
        total: numberValue(totalRow?.total),
        limit,
        offset,
      };
    },

    async getUserActivity({ id }) {
      const [userRow, latestEvents, moduleRows, eventNameRows] = await Promise.all([
        queryFirst<Record<string, unknown>>(db, sql`
          SELECT id, email, display_name AS name, last_login_at
          FROM data_trade.users
          WHERE id = ${id}
            AND deleted_at IS NULL
          LIMIT 1
        `),
        queryRows<Record<string, unknown>>(db, sql`
          SELECT id, user_id, anonymous_id, module, event_name, metadata, path, created_at
          FROM data_trade.events
          WHERE user_id = ${id}
          ORDER BY created_at DESC
          LIMIT 25
        `),
        queryRows<Record<string, unknown>>(db, sql`
          SELECT
            e.module AS module_code,
            COALESCE(m.display_name, e.module) AS module_name,
            COUNT(*)::int AS events_count,
            MAX(e.created_at) AS last_event_at
          FROM data_trade.events e
          LEFT JOIN data_trade.modules m ON m.key = e.module
          WHERE e.user_id = ${id}
          GROUP BY e.module, m.display_name
          ORDER BY events_count DESC, module_code ASC
        `),
        queryRows<Record<string, unknown>>(db, sql`
          SELECT event_name, COUNT(*)::int AS events_count
          FROM data_trade.events
          WHERE user_id = ${id}
          GROUP BY event_name
          ORDER BY events_count DESC, event_name ASC
        `),
      ]);

      const latestTrackingEventAt = latestEvents[0]?.created_at ?? null;

      return {
        user: userRow
          ? {
              id: String(userRow.id),
              email: String(userRow.email),
              name: stringValue(userRow.name),
            }
          : null,
        latest_events: latestEvents.map(mapEventRow),
        modules_used: moduleRows.map((row) => ({
          module_code: String(row.module_code),
          module_name: String(row.module_name),
          events_count: numberValue(row.events_count),
          last_event_at: isoString(row.last_event_at),
        })),
        last_login_at: isoString(userRow?.last_login_at),
        latest_tracking_event_at: isoString(latestTrackingEventAt),
        event_name_counts: eventNameRows.map((row) => ({
          event_name: String(row.event_name),
          events_count: numberValue(row.events_count),
        })),
      };
    },

    async listEvents(query) {
      const where = eventFilterSql(query);
      const [totalRow, eventRows] = await Promise.all([
        queryFirst<Record<string, unknown>>(db, sql`
          SELECT COUNT(*)::int AS total
          FROM data_trade.events e
          WHERE ${where}
        `),
        queryRows<Record<string, unknown>>(db, sql`
          SELECT id, user_id, anonymous_id, module, event_name, metadata, path, created_at
          FROM data_trade.events e
          WHERE ${where}
          ORDER BY e.created_at DESC
          LIMIT ${query.limit}
          OFFSET ${query.offset}
        `),
      ]);

      return {
        events: eventRows.map(mapEventRow),
        total: numberValue(totalRow?.total),
        limit: query.limit,
        offset: query.offset,
      };
    },

    async getModulesUsage() {
      const moduleRows = await queryRows<Record<string, unknown>>(db, sql`
        SELECT
          e.module AS module_code,
          COALESCE(m.display_name, e.module) AS module_name,
          COUNT(*)::int AS events_count,
          COUNT(DISTINCT e.user_id) FILTER (WHERE e.user_id IS NOT NULL)::int AS unique_users,
          COUNT(DISTINCT e.anonymous_id) FILTER (WHERE e.anonymous_id IS NOT NULL)::int AS anonymous_users,
          MAX(e.created_at) AS last_event_at
        FROM data_trade.events e
        LEFT JOIN data_trade.modules m ON m.key = e.module
        GROUP BY e.module, m.display_name
        ORDER BY events_count DESC, module_code ASC
      `);

      return {
        modules: moduleRows.map((row) => ({
          module_code: String(row.module_code),
          module_name: String(row.module_name),
          events_count: numberValue(row.events_count),
          unique_users: numberValue(row.unique_users),
          anonymous_users: numberValue(row.anonymous_users),
          last_event_at: isoString(row.last_event_at),
        })),
      };
    },

    async getRetention() {
      const row = await queryFirst<Record<string, unknown>>(db, sql`
        SELECT
          (
            SELECT COUNT(*)
            FROM data_trade.users u
            WHERE u.deleted_at IS NULL
              AND u.created_at >= now() - interval '7 days'
          )::int AS new_users_7d,
          (
            SELECT COUNT(DISTINCT e.user_id)
            FROM data_trade.events e
            INNER JOIN data_trade.users u ON u.id = e.user_id
            WHERE e.created_at >= now() - interval '7 days'
              AND u.created_at < now() - interval '7 days'
              AND u.deleted_at IS NULL
          )::int AS returning_users_7d,
          (
            SELECT COUNT(*)
            FROM data_trade.users u
            WHERE u.deleted_at IS NULL
              AND u.created_at >= now() - interval '30 days'
          )::int AS new_users_30d,
          (
            SELECT COUNT(DISTINCT e.user_id)
            FROM data_trade.events e
            INNER JOIN data_trade.users u ON u.id = e.user_id
            WHERE e.created_at >= now() - interval '30 days'
              AND u.created_at < now() - interval '30 days'
              AND u.deleted_at IS NULL
          )::int AS returning_users_30d,
          (
            SELECT COUNT(DISTINCT e.user_id)
            FROM data_trade.events e
            WHERE e.user_id IS NOT NULL
              AND e.created_at >= now() - interval '7 days'
          )::int AS active_users_7d,
          (
            SELECT COUNT(DISTINCT e.user_id)
            FROM data_trade.events e
            WHERE e.user_id IS NOT NULL
              AND e.created_at >= now() - interval '30 days'
          )::int AS active_users_30d
      `);

      const activeUsers7d = numberValue(row?.active_users_7d);
      const activeUsers30d = numberValue(row?.active_users_30d);

      return {
        new_users_7d: numberValue(row?.new_users_7d),
        returning_users_7d: numberValue(row?.returning_users_7d),
        new_users_30d: numberValue(row?.new_users_30d),
        returning_users_30d: numberValue(row?.returning_users_30d),
        stickiness_7d_30d: activeUsers30d === 0 ? 0 : activeUsers7d / activeUsers30d,
      };
    },

    async getErrors() {
      const errorRows = await queryRows<Record<string, unknown>>(db, sql`
        SELECT
          e.module,
          e.path,
          NULLIF(e.metadata ->> 'code', '') AS code,
          NULLIF(e.metadata ->> 'message', '') AS message,
          DATE_TRUNC('day', e.created_at)::date AS event_date,
          COUNT(*)::int AS events_count,
          MAX(e.created_at) AS last_event_at
        FROM data_trade.events e
        WHERE e.event_name = 'api_error'
        GROUP BY e.module, e.path, code, message, event_date
        ORDER BY last_event_at DESC
        LIMIT 100
      `);

      return {
        errors: errorRows.map((row) => ({
          module: String(row.module),
          path: stringValue(row.path),
          code: stringValue(row.code),
          message: stringValue(row.message),
          event_date: isoString(row.event_date),
          events_count: numberValue(row.events_count),
          last_event_at: isoString(row.last_event_at),
        })),
      };
    },
  };
}
