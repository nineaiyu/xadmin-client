import { describe, expect, it } from "vitest";
import { mergeBackendChecks } from "../messageNotifications";

describe("mergeBackendChecks", () => {
  it("保留停用渠道的历史订阅键", () => {
    const checks = mergeBackendChecks(["email", "sms"], ["email"]);
    expect(checks).toEqual({ email: true, sms: true });
  });

  it("可见渠道按当前订阅值覆盖，未订阅为 false", () => {
    const checks = mergeBackendChecks(["email"], ["email", "sms"]);
    expect(checks).toEqual({ email: true, sms: false });
  });

  it("无历史订阅时全部可见渠道为 false", () => {
    const checks = mergeBackendChecks([], ["email", "sms"]);
    expect(checks).toEqual({ email: false, sms: false });
  });
});
