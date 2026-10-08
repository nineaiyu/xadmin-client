import { describe, expect, it } from "vitest";

import { formatDateTime, formatFileSize } from "./format";

/** 按被测口径从同一时刻推导本地时区期望值，保证用例与运行时区无关 */
const localText = (iso: string) => {
  const date = new Date(iso);
  const pad = (num: number) => String(num).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
};

describe("formatDateTime", () => {
  it("空值返回空串", () => {
    expect(formatDateTime(null)).toBe("");
    expect(formatDateTime(undefined)).toBe("");
    expect(formatDateTime("")).toBe("");
  });

  it("非 ISO 文本原样返回", () => {
    expect(formatDateTime("2026/03/05")).toBe("2026/03/05");
    expect(formatDateTime("abc")).toBe("abc");
  });

  it("ISO 文本（含微秒与 Z）转为本地 YYYY-MM-DD HH:mm:ss", () => {
    const iso = "2026-03-05T06:07:08.123456Z";
    expect(formatDateTime(iso)).toBe(localText("2026-03-05T06:07:08.123Z"));
    expect(formatDateTime(iso)).toMatch(
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/
    );
  });

  it("带时区偏移与无毫秒的 ISO 文本同样处理", () => {
    const iso = "2026-03-05T06:07:08+08:00";
    expect(formatDateTime(iso)).toBe(localText(iso));
  });

  it("形似 ISO 但无法解析的文本原样返回", () => {
    const text = "2026-13-99T99:99:99Z";
    expect(formatDateTime(text)).toBe(text);
  });
});

describe("formatFileSize", () => {
  it("空值与 0 返回空串（占位由调用方决定）", () => {
    expect(formatFileSize(null)).toBe("");
    expect(formatFileSize(undefined)).toBe("");
    expect(formatFileSize(0)).toBe("");
  });

  it("B / KB / MB 分档并保留一位小数", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(1024)).toBe("1.0 KB");
    expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
    expect(formatFileSize(1024 * 1024 * 1.5)).toBe("1.5 MB");
  });

  it("边界值与字符串数字", () => {
    expect(formatFileSize(1023)).toBe("1023 B");
    expect(formatFileSize(1024 * 1024 - 1)).toBe("1024.0 KB");
    expect(formatFileSize(Number("2048"))).toBe("2.0 KB");
  });
});
