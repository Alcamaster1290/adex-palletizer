import { describe, expect, it } from "vitest";

import { getRangeDays, summarizeDailyMetrics } from "./aggregate.js";

const userA = "00000000-0000-0000-0000-000000000001";
const userB = "00000000-0000-0000-0000-000000000002";

describe("daily metrics aggregation", () => {
  it("creates correct daily module and user metrics", () => {
    const summary = summarizeDailyMetrics([
      {
        user_id: userA,
        anonymous_id: null,
        module: "adex_palletizer",
        event_name: "session_started",
        created_at: "2026-05-04T10:00:00.000Z",
      },
      {
        user_id: userA,
        anonymous_id: null,
        module: "adex_palletizer",
        event_name: "palletizer_calculation_created",
        created_at: "2026-05-04T10:05:00.000Z",
      },
      {
        user_id: userB,
        anonymous_id: "anon-1",
        module: "adex_palletizer",
        event_name: "api_error",
        created_at: "2026-05-04T11:00:00.000Z",
      },
      {
        user_id: null,
        anonymous_id: "anon-1",
        module: "sislope",
        event_name: "module_opened",
        created_at: "2026-05-05T09:00:00.000Z",
      },
    ]);

    expect(summary.moduleMetrics).toEqual([
      {
        date: "2026-05-04",
        module_code: "adex_palletizer",
        events_count: 3,
        unique_users: 2,
        anonymous_users: 1,
        sessions_count: 1,
        calculations_count: 1,
        errors_count: 1,
      },
      {
        date: "2026-05-05",
        module_code: "sislope",
        events_count: 1,
        unique_users: 0,
        anonymous_users: 1,
        sessions_count: 0,
        calculations_count: 0,
        errors_count: 0,
      },
    ]);
    expect(summary.userMetrics).toEqual([
      {
        date: "2026-05-04",
        user_id: userA,
        events_count: 2,
        modules_used_count: 1,
        sessions_count: 1,
        last_event_at: "2026-05-04T10:05:00.000Z",
      },
      {
        date: "2026-05-04",
        user_id: userB,
        events_count: 1,
        modules_used_count: 1,
        sessions_count: 0,
        last_event_at: "2026-05-04T11:00:00.000Z",
      },
    ]);
  });

  it("is idempotent for the same event inputs", () => {
    const events = [
      {
        user_id: userA,
        anonymous_id: null,
        module: "api",
        event_name: "module_opened",
        created_at: "2026-05-04T10:00:00.000Z",
      },
    ];

    expect(summarizeDailyMetrics(events)).toEqual(summarizeDailyMetrics(events));
  });

  it("calculates inclusive date ranges", () => {
    expect(getRangeDays("2026-05-01", "2026-05-01")).toBe(1);
    expect(getRangeDays("2026-05-01", "2026-05-31")).toBe(31);
  });
});
