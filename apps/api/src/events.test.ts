import { describe, expect, it } from "vitest";

import { hashIpAddress, trackEventBodySchema } from "./events.js";

describe("event utilities", () => {
  it("hashes an IP without returning the raw value", () => {
    const hash = hashIpAddress("203.0.113.7", "test-secret");

    expect(hash).toHaveLength(64);
    expect(hash).not.toContain("203.0.113.7");
  });

  it("requires either userId or anonymousId", () => {
    const parsed = trackEventBodySchema.safeParse({
      module: "sislope",
      eventName: "module_opened",
      metadata: {},
    });

    expect(parsed.success).toBe(false);
  });
});
