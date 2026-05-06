import { pathToFileURL } from "node:url";

import "dotenv/config";
import postgres from "postgres";

import { loadConfig } from "../config.js";

export const PROTECTED_EMAILS = new Set(["admin@datatrade.local"]);

export const SMOKE_EMAIL_PATTERNS = [
  /^agent-browser-smoke-.*@datatrade\.local$/i,
  /^admin-smoke-.*@datatrade\.local$/i,
  /^normal-phase.*@datatrade\.local$/i,
  /^admin-phase.*@datatrade\.local$/i,
  /^smoke-phase.*@datatrade\.local$/i,
  /^phase2-.*@datatrade\.local$/i,
  /^phase3-.*@datatrade\.local$/i,
  /^admin-\d+@datatrade\.local$/i,
];

interface SmokeUserRow {
  id: string;
  email: string;
}

interface CountRow {
  count: number;
}

interface IdRow {
  id: string;
}

interface DateRow {
  date: string;
}

type SqlClient = postgres.Sql | postgres.TransactionSql;

function isProductionEnvironment() {
  return process.env.APP_ENV === "production" || process.env.NODE_ENV === "production";
}

export function isProtectedEmail(email: string) {
  return PROTECTED_EMAILS.has(email.trim().toLowerCase());
}

export function isSmokeEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  return !isProtectedEmail(normalized) && SMOKE_EMAIL_PATTERNS.some((pattern) => pattern.test(normalized));
}

function assertSafeEnvironment() {
  if (isProductionEnvironment()) {
    throw new Error("Refusing to cleanup smoke data when APP_ENV or NODE_ENV is production.");
  }
}

async function tableExists(sql: SqlClient, tableName: string) {
  const rows = await sql<{ exists: boolean }[]>`
    select to_regclass(${`data_trade.${tableName}`}) is not null as exists
  `;
  return rows[0]?.exists === true;
}

async function countByUserIds(
  sql: SqlClient,
  query: (userIds: string[]) => Promise<CountRow[]>,
  userIds: string[],
) {
  if (userIds.length === 0) {
    return 0;
  }
  const rows = await query(userIds);
  return rows[0]?.count ?? 0;
}

async function deleteByUserIds(
  sql: SqlClient,
  query: (userIds: string[]) => Promise<{ count?: number }>,
  userIds: string[],
) {
  if (userIds.length === 0) {
    return 0;
  }
  const result = await query(userIds);
  return result.count ?? 0;
}

async function findSmokeUsers(sql: SqlClient) {
  return sql<SmokeUserRow[]>`
    select id::text as id, email
    from data_trade.users
    where email <> 'admin@datatrade.local'
      and (
        email like 'agent-browser-smoke-%@datatrade.local'
        or email like 'admin-smoke-%@datatrade.local'
        or email like 'normal-phase%@datatrade.local'
        or email like 'admin-phase%@datatrade.local'
        or email like 'smoke-phase%@datatrade.local'
        or email like 'phase2-%@datatrade.local'
        or email like 'phase3-%@datatrade.local'
        or email ~ '^admin-[0-9]+@datatrade\\.local$'
      )
    order by created_at asc
  `;
}

async function findIdsByUserIds(
  sql: SqlClient,
  tableName: "auth_sessions" | "projects",
  userIds: string[],
) {
  if (userIds.length === 0) {
    return [];
  }

  if (tableName === "auth_sessions") {
    return sql<IdRow[]>`
      select id::text as id
      from data_trade.auth_sessions
      where user_id = any(${sql.array(userIds)}::uuid[])
    `;
  }

  return sql<IdRow[]>`
    select id::text as id
    from data_trade.projects
    where owner_user_id = any(${sql.array(userIds)}::uuid[])
  `;
}

async function findAffectedEventDates(sql: SqlClient, userIds: string[]) {
  const userEventDates =
    userIds.length > 0
      ? await sql<DateRow[]>`
          select distinct created_at::date::text as date
          from data_trade.events
          where user_id = any(${sql.array(userIds)}::uuid[])
        `
      : [];

  const anonymousEventDates = await sql<DateRow[]>`
    select distinct created_at::date::text as date
    from data_trade.events
    where anonymous_id like 'agent-browser%'
       or anonymous_id like 'smoke%'
       or metadata::text ilike '%agent-browser-smoke-%'
       or metadata::text ilike '%admin-smoke-%'
       or metadata::text ilike '%normal-phase%'
       or metadata::text ilike '%admin-phase%'
       or metadata::text ilike '%smoke-phase%'
       or metadata::text ilike '%phase2-%@datatrade.local%'
       or metadata::text ilike '%phase3-%'
       or metadata::text ilike '%admin-%@datatrade.local%'
  `;

  return Array.from(new Set([...userEventDates, ...anonymousEventDates].map((row) => row.date)));
}

async function countSmokeEvents(sql: SqlClient, userIds: string[]) {
  const byUser = await countByUserIds(
    sql,
    (ids) => sql<CountRow[]>`
      select count(*)::int as count
      from data_trade.events
      where user_id = any(${sql.array(ids)}::uuid[])
    `,
    userIds,
  );

  const anonymousRows = await sql<CountRow[]>`
    select count(*)::int as count
    from data_trade.events
    where user_id is null
      and (
        anonymous_id like 'agent-browser%'
        or anonymous_id like 'smoke%'
        or metadata::text ilike '%agent-browser-smoke-%'
        or metadata::text ilike '%admin-smoke-%'
        or metadata::text ilike '%normal-phase%'
        or metadata::text ilike '%admin-phase%'
        or metadata::text ilike '%smoke-phase%'
        or metadata::text ilike '%phase2-%@datatrade.local%'
        or metadata::text ilike '%phase3-%'
        or metadata::text ilike '%admin-%@datatrade.local%'
      )
  `;

  return byUser + (anonymousRows[0]?.count ?? 0);
}

async function deleteSmokeEvents(sql: SqlClient, userIds: string[]) {
  const byUser = await deleteByUserIds(
    sql,
    (ids) => sql`
      delete from data_trade.events
      where user_id = any(${sql.array(ids)}::uuid[])
    `,
    userIds,
  );

  const anonymousResult = await sql`
    delete from data_trade.events
    where user_id is null
      and (
        anonymous_id like 'agent-browser%'
        or anonymous_id like 'smoke%'
        or metadata::text ilike '%agent-browser-smoke-%'
        or metadata::text ilike '%admin-smoke-%'
        or metadata::text ilike '%normal-phase%'
        or metadata::text ilike '%admin-phase%'
        or metadata::text ilike '%smoke-phase%'
        or metadata::text ilike '%phase2-%@datatrade.local%'
        or metadata::text ilike '%phase3-%'
        or metadata::text ilike '%admin-%@datatrade.local%'
      )
  `;

  return byUser + (anonymousResult.count ?? 0);
}

async function cleanupOptionalMetrics(sql: SqlClient, userIds: string[], affectedDates: string[]) {
  const result = {
    dailyUserMetrics: 0,
    dailyModuleMetrics: 0,
  };

  if (userIds.length > 0 && await tableExists(sql, "daily_user_metrics")) {
    const deleted = await sql`
      delete from data_trade.daily_user_metrics
      where user_id = any(${sql.array(userIds)}::uuid[])
    `;
    result.dailyUserMetrics = deleted.count ?? 0;
  }

  if (affectedDates.length > 0 && await tableExists(sql, "daily_module_metrics")) {
    const deleted = await sql`
      delete from data_trade.daily_module_metrics
      where date = any(${sql.array(affectedDates)}::date[])
    `;
    result.dailyModuleMetrics = deleted.count ?? 0;
  }

  return result;
}

async function main() {
  assertSafeEnvironment();
  const config = loadConfig();
  const sql = postgres(config.databaseUrl, {
    max: 1,
    idle_timeout: 5,
    prepare: false,
  });

  try {
    const smokeUsers = await findSmokeUsers(sql);
    const userIds = smokeUsers.map((user) => user.id);
    const authSessionIds = (await findIdsByUserIds(sql, "auth_sessions", userIds)).map((row) => row.id);
    const projectIds = (await findIdsByUserIds(sql, "projects", userIds)).map((row) => row.id);
    const affectedDates = await findAffectedEventDates(sql, userIds);

    const counts = {
      users: smokeUsers.length,
      events: await countSmokeEvents(sql, userIds),
      authSessions: await countByUserIds(sql, (ids) => sql<CountRow[]>`
        select count(*)::int as count from data_trade.auth_sessions where user_id = any(${sql.array(ids)}::uuid[])
      `, userIds),
      authAccounts: await countByUserIds(sql, (ids) => sql<CountRow[]>`
        select count(*)::int as count from data_trade.auth_accounts where user_id = any(${sql.array(ids)}::uuid[])
      `, userIds),
      userModuleAccess: await countByUserIds(sql, (ids) => sql<CountRow[]>`
        select count(*)::int as count from data_trade.user_module_access where user_id = any(${sql.array(ids)}::uuid[])
      `, userIds),
      memberships: await countByUserIds(sql, (ids) => sql<CountRow[]>`
        select count(*)::int as count from data_trade.memberships
        where user_id = any(${sql.array(ids)}::uuid[]) or invited_by_user_id = any(${sql.array(ids)}::uuid[])
      `, userIds),
      auditLogs: userIds.length > 0
        ? (await sql<CountRow[]>`
            select count(*)::int as count
            from data_trade.audit_logs
            where actor_user_id = any(${sql.array(userIds)}::uuid[])
               or entity_id = any(${sql.array([...userIds, ...authSessionIds])}::text[])
          `)[0]?.count ?? 0
        : 0,
      adminNotes: await countByUserIds(sql, (ids) => sql<CountRow[]>`
        select count(*)::int as count from data_trade.admin_notes
        where target_user_id = any(${sql.array(ids)}::uuid[]) or author_user_id = any(${sql.array(ids)}::uuid[])
      `, userIds),
      userFlags: await countByUserIds(sql, (ids) => sql<CountRow[]>`
        select count(*)::int as count from data_trade.user_flags where user_id = any(${sql.array(ids)}::uuid[])
      `, userIds),
      projects: projectIds.length,
    };

    process.stdout.write(`Smoke users selected: ${counts.users}\n`);
    for (const user of smokeUsers) {
      process.stdout.write(`- ${user.email} (${user.id})\n`);
    }
    process.stdout.write(`Rows planned for cleanup: ${JSON.stringify(counts, null, 2)}\n`);
    process.stdout.write(`Affected event dates for optional aggregates: ${affectedDates.join(", ") || "none"}\n`);

    const deleted = await sql.begin(async (tx) => {
      const deletedRows = {
        uploadedFiles: projectIds.length > 0 || userIds.length > 0
          ? (await tx`
              delete from data_trade.uploaded_files
              where ${userIds.length > 0 ? tx`user_id = any(${tx.array(userIds)}::uuid[])` : tx`false`}
                 or ${projectIds.length > 0 ? tx`project_id = any(${tx.array(projectIds)}::uuid[])` : tx`false`}
            `).count ?? 0
          : 0,
        palletizerRuns: projectIds.length > 0 || userIds.length > 0
          ? (await tx`
              delete from data_trade.palletizer_runs
              where ${userIds.length > 0 ? tx`user_id = any(${tx.array(userIds)}::uuid[])` : tx`false`}
                 or ${projectIds.length > 0 ? tx`project_id = any(${tx.array(projectIds)}::uuid[])` : tx`false`}
            `).count ?? 0
          : 0,
        mapSessions: await deleteByUserIds(tx, (ids) => tx`
          delete from data_trade.map_sessions where user_id = any(${tx.array(ids)}::uuid[])
        `, userIds),
        searchQueries: await deleteByUserIds(tx, (ids) => tx`
          delete from data_trade.search_queries where user_id = any(${tx.array(ids)}::uuid[])
        `, userIds),
        adminNotes: await deleteByUserIds(tx, (ids) => tx`
          delete from data_trade.admin_notes
          where target_user_id = any(${tx.array(ids)}::uuid[]) or author_user_id = any(${tx.array(ids)}::uuid[])
        `, userIds),
        userFlags: await deleteByUserIds(tx, (ids) => tx`
          delete from data_trade.user_flags where user_id = any(${tx.array(ids)}::uuid[])
        `, userIds),
        memberships: await deleteByUserIds(tx, (ids) => tx`
          delete from data_trade.memberships
          where user_id = any(${tx.array(ids)}::uuid[]) or invited_by_user_id = any(${tx.array(ids)}::uuid[])
        `, userIds),
        userModuleAccess: await deleteByUserIds(tx, (ids) => tx`
          delete from data_trade.user_module_access where user_id = any(${tx.array(ids)}::uuid[])
        `, userIds),
        authAccounts: await deleteByUserIds(tx, (ids) => tx`
          delete from data_trade.auth_accounts where user_id = any(${tx.array(ids)}::uuid[])
        `, userIds),
        authSessions: await deleteByUserIds(tx, (ids) => tx`
          delete from data_trade.auth_sessions where user_id = any(${tx.array(ids)}::uuid[])
        `, userIds),
        events: await deleteSmokeEvents(tx, userIds),
        auditLogs: userIds.length > 0
          ? (await tx`
              delete from data_trade.audit_logs
              where actor_user_id = any(${tx.array(userIds)}::uuid[])
                 or entity_id = any(${tx.array([...userIds, ...authSessionIds])}::text[])
            `).count ?? 0
          : 0,
        projects: projectIds.length > 0
          ? (await tx`
              delete from data_trade.projects where id = any(${tx.array(projectIds)}::uuid[])
            `).count ?? 0
          : 0,
        users: await deleteByUserIds(tx, (ids) => tx`
          delete from data_trade.users
          where id = any(${tx.array(ids)}::uuid[])
            and email <> 'admin@datatrade.local'
        `, userIds),
      };

      const metrics = await cleanupOptionalMetrics(tx, userIds, affectedDates);
      return {
        ...deletedRows,
        ...metrics,
      };
    });

    process.stdout.write(`Deleted rows: ${JSON.stringify(deleted, null, 2)}\n`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
