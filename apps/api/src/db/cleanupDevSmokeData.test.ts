import { describe, expect, it } from "vitest";

import { isProtectedEmail, isSmokeEmail } from "./cleanupDevSmokeData.js";

describe("cleanupDevSmokeData guards", () => {
  it("matches only known local smoke email patterns", () => {
    expect(isSmokeEmail("agent-browser-smoke-123@datatrade.local")).toBe(true);
    expect(isSmokeEmail("admin-smoke-run@datatrade.local")).toBe(true);
    expect(isSmokeEmail("normal-phase2@datatrade.local")).toBe(true);
    expect(isSmokeEmail("admin-phase4@datatrade.local")).toBe(true);
    expect(isSmokeEmail("smoke-phase5@datatrade.local")).toBe(true);
    expect(isSmokeEmail("phase2-1777934674394@datatrade.local")).toBe(true);
    expect(isSmokeEmail("phase3-demo@datatrade.local")).toBe(true);
    expect(isSmokeEmail("admin-1777934674394@datatrade.local")).toBe(true);

    expect(isSmokeEmail("cliente@datatrade.local")).toBe(false);
    expect(isSmokeEmail("admin-local@datatrade.local")).toBe(false);
    expect(isSmokeEmail("agent-browser-smoke-123@empresa.com")).toBe(false);
  });

  it("never treats the local seed admin as smoke data", () => {
    expect(isProtectedEmail("admin@datatrade.local")).toBe(true);
    expect(isSmokeEmail("admin@datatrade.local")).toBe(false);
  });
});
