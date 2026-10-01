import { describe, expect, it } from "vitest";

import { formatTimeDivider, groupByTime, TIME_GROUP_GAP } from "../timeGroups";

type Row = { id: number; created_time: string };

function at(hoursAgo: number): string {
  return new Date(Date.now() - hoursAgo * 3600 * 1000).toISOString();
}

describe("formatTimeDivider", () => {
  it("returns empty label for zero time", () => {
    expect(formatTimeDivider(0, "昨天")).toBe("");
  });

  it("formats same-day label as HH:mm", () => {
    const now = new Date();
    const label = formatTimeDivider(now.getTime(), "昨天");
    expect(label).toMatch(/^\d{2}:\d{2}$/);
  });

  it("prefixes yesterday label", () => {
    const time = new Date(Date.now() - 24 * 60 * 60 * 1000).getTime();
    expect(formatTimeDivider(time, "昨天")).toMatch(/^昨天 \d{2}:\d{2}$/);
  });

  it("formats older dates as M-D HH:mm", () => {
    const time = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).getTime();
    expect(formatTimeDivider(time, "昨天")).toMatch(
      /^\d{1,2}-\d{1,2} \d{2}:\d{2}$/
    );
  });
});

describe("groupByTime", () => {
  it("inserts a divider before the first message", () => {
    const rows = groupByTime<Row>([{ id: 1, created_time: at(1) }], "昨天");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ type: "divider", key: "d-1" });
    expect(rows[1]).toMatchObject({ type: "message", key: "m-1" });
  });

  it("keeps messages within the gap in one group", () => {
    const base = Date.now();
    const rows = groupByTime<Row>(
      [
        { id: 1, created_time: new Date(base).toISOString() },
        {
          id: 2,
          created_time: new Date(base + TIME_GROUP_GAP / 2).toISOString()
        }
      ],
      "昨天"
    );
    expect(rows.filter(row => row.type === "divider")).toHaveLength(1);
  });

  it("starts a new group past the gap", () => {
    const base = Date.now();
    const rows = groupByTime<Row>(
      [
        { id: 1, created_time: new Date(base).toISOString() },
        {
          id: 2,
          created_time: new Date(base + TIME_GROUP_GAP * 2).toISOString()
        }
      ],
      "昨天"
    );
    expect(rows.filter(row => row.type === "divider")).toHaveLength(2);
  });
});
