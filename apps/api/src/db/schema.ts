import { relations, sql } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
};

export const dataTrade = pgSchema("data_trade");

export const users = dataTrade.table(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    username: text("username"),
    displayName: text("display_name"),
    passwordHash: text("password_hash"),
    passwordHashAlgorithm: text("password_hash_algorithm"),
    status: text("status").notNull().default("active"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true, mode: "string" }),
    legacyUsuarioId: uuid("legacy_usuario_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("users_email_uq").on(table.email),
    uniqueIndex("users_username_uq").on(table.username),
    index("users_status_idx").on(table.status),
    index("users_last_login_at_idx").on(table.lastLoginAt),
  ],
);

export const organizations = dataTrade.table(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    status: text("status").notNull().default("active"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("organizations_slug_uq").on(table.slug),
    index("organizations_status_idx").on(table.status),
  ],
);

export const roles = dataTrade.table(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    displayName: text("display_name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("roles_key_uq").on(table.key)],
);

export const memberships = dataTrade.table(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("active"),
    invitedByUserId: uuid("invited_by_user_id").references(() => users.id, { onDelete: "set null" }),
    joinedAt: timestamp("joined_at", { withTimezone: true, mode: "string" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("memberships_org_user_uq").on(table.organizationId, table.userId),
    index("memberships_user_idx").on(table.userId),
    index("memberships_role_idx").on(table.roleId),
  ],
);

export const authAccounts = dataTrade.table(
  "auth_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("credentials"),
    providerAccountId: text("provider_account_id").notNull(),
    passwordHash: text("password_hash"),
    passwordHashAlgorithm: text("password_hash_algorithm"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("auth_accounts_provider_account_uq").on(table.provider, table.providerAccountId),
    index("auth_accounts_user_idx").on(table.userId),
  ],
);

export const authSessions = dataTrade.table(
  "auth_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    refreshTokenHash: text("refresh_token_hash").notNull(),
    sessionStatus: text("session_status").notNull().default("active"),
    createdByIpHash: text("created_by_ip_hash"),
    revokedByIpHash: text("revoked_by_ip_hash"),
    userAgent: text("user_agent"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: "string" }),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "string" }),
    revokeReason: text("revoke_reason"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("auth_sessions_refresh_token_hash_uq").on(table.refreshTokenHash),
    index("auth_sessions_user_idx").on(table.userId),
    index("auth_sessions_expires_at_idx").on(table.expiresAt),
  ],
);

export const modules = dataTrade.table(
  "modules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    displayName: text("display_name").notNull(),
    status: text("status").notNull().default("active"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    ...timestamps,
  },
  (table) => [uniqueIndex("modules_key_uq").on(table.key), index("modules_status_idx").on(table.status)],
);

export const userModuleAccess = dataTrade.table(
  "user_module_access",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
    accessLevel: text("access_level").notNull().default("user"),
    grantedByUserId: uuid("granted_by_user_id").references(() => users.id, { onDelete: "set null" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "string" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("user_module_access_user_module_org_uq").on(
      table.userId,
      table.moduleId,
      table.organizationId,
    ),
    index("user_module_access_module_idx").on(table.moduleId),
  ],
);

export const projects = dataTrade.table(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "set null" }),
    ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
    moduleId: uuid("module_id").references(() => modules.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    projectType: text("project_type").notNull(),
    status: text("status").notNull().default("active"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    archivedAt: timestamp("archived_at", { withTimezone: true, mode: "string" }),
    ...timestamps,
  },
  (table) => [
    index("projects_owner_idx").on(table.ownerUserId, table.createdAt),
    index("projects_org_idx").on(table.organizationId, table.createdAt),
    index("projects_module_idx").on(table.moduleId),
  ],
);

export const palletizerRuns = dataTrade.table(
  "palletizer_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "set null" }),
    mode: text("mode").notNull(),
    inputPayload: jsonb("input_payload").$type<Record<string, unknown>>().notNull(),
    resultPayload: jsonb("result_payload").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    metrics: jsonb("metrics").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => [
    index("palletizer_runs_user_created_idx").on(table.userId, table.createdAt),
    index("palletizer_runs_project_created_idx").on(table.projectId, table.createdAt),
    index("palletizer_runs_mode_idx").on(table.mode),
  ],
);

export const mapSessions = dataTrade.table(
  "map_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    anonymousId: text("anonymous_id"),
    moduleId: uuid("module_id").references(() => modules.id, { onDelete: "set null" }),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true, mode: "string" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  },
  (table) => [
    index("map_sessions_user_started_idx").on(table.userId, table.startedAt),
    index("map_sessions_anonymous_started_idx").on(table.anonymousId, table.startedAt),
  ],
);

export const searchQueries = dataTrade.table(
  "search_queries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    anonymousId: text("anonymous_id"),
    moduleId: uuid("module_id").references(() => modules.id, { onDelete: "set null" }),
    query: text("query").notNull(),
    normalizedQuery: text("normalized_query"),
    resultCount: integer("result_count"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => [
    index("search_queries_user_created_idx").on(table.userId, table.createdAt),
    index("search_queries_module_created_idx").on(table.moduleId, table.createdAt),
  ],
);

export const uploadedFiles = dataTrade.table(
  "uploaded_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "set null" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    moduleId: uuid("module_id").references(() => modules.id, { onDelete: "set null" }),
    storageProvider: text("storage_provider").notNull(),
    storageKey: text("storage_key").notNull(),
    originalFilename: text("original_filename").notNull(),
    mimeType: text("mime_type"),
    byteSize: bigint("byte_size", { mode: "number" }),
    checksumSha256: text("checksum_sha256"),
    status: text("status").notNull().default("active"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => [
    index("uploaded_files_user_created_idx").on(table.userId, table.createdAt),
    index("uploaded_files_project_idx").on(table.projectId),
  ],
);

export const dataSources = dataTrade.table(
  "data_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    displayName: text("display_name").notNull(),
    sourceType: text("source_type").notNull(),
    status: text("status").notNull().default("active"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    ...timestamps,
  },
  (table) => [uniqueIndex("data_sources_key_uq").on(table.key), index("data_sources_status_idx").on(table.status)],
);

export const events = dataTrade.table(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    anonymousId: text("anonymous_id"),
    module: text("module").notNull(),
    eventName: text("event_name").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    path: text("path"),
    userAgent: text("user_agent"),
    ipHash: text("ip_hash"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => [
    index("events_user_created_idx").on(table.userId, table.createdAt),
    index("events_anonymous_created_idx").on(table.anonymousId, table.createdAt),
    index("events_module_name_created_idx").on(table.module, table.eventName, table.createdAt),
    index("events_created_at_idx").on(table.createdAt),
  ],
);

export const auditLogs = dataTrade.table(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    severity: text("severity").notNull().default("info"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_logs_actor_created_idx").on(table.actorUserId, table.createdAt),
    index("audit_logs_action_created_idx").on(table.action, table.createdAt),
  ],
);

export const adminNotes = dataTrade.table(
  "admin_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    targetUserId: uuid("target_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    authorUserId: uuid("author_user_id").references(() => users.id, { onDelete: "set null" }),
    note: text("note").notNull(),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => [
    index("admin_notes_target_created_idx").on(table.targetUserId, table.createdAt),
    index("admin_notes_author_created_idx").on(table.authorUserId, table.createdAt),
  ],
);

export const userFlags = dataTrade.table(
  "user_flags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: jsonb("value").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("user_flags_user_key_uq").on(table.userId, table.key),
    index("user_flags_key_idx").on(table.key),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(memberships),
  sessions: many(authSessions),
  events: many(events),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  memberships: many(memberships),
  projects: many(projects),
}));

export const modulesRelations = relations(modules, ({ many }) => ({
  access: many(userModuleAccess),
  projects: many(projects),
}));
