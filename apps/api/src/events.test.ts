import { describe, expect, it } from "vitest";

import { hashIpAddress, sanitizeMetadata, trackEventBodySchema } from "./events.js";

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

  it("sanitizes large nested metadata values", () => {
    const metadata = sanitizeMetadata({
      long: "x".repeat(3_000),
      nested: {
        value: {
          items: Array.from({ length: 150 }, (_, index) => index),
        },
      },
    });

    expect(String(metadata.long)).toHaveLength(2_000);
    expect(((metadata.nested as Record<string, unknown>).value as Record<string, unknown>).items).toHaveLength(100);
  });
});
