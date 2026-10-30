import { describe, expect, it } from "vitest";
import {
  canForceLogout,
  onlineSessionsQuery,
  parsePolicyResult,
  showSessionManage
} from "../loginLogActions";

describe("登录日志行操作口径", () => {
  it("只有 WS 在线会话才显示强退", () => {
    expect(canForceLogout({ logout: true }, { online: true })).toBe(true);
    expect(canForceLogout({ logout: true }, { online: false })).toBe(false);
    expect(canForceLogout({ logout: true }, { online: -1 })).toBe(false);
    expect(canForceLogout({ logout: false }, { online: true })).toBe(false);
  });

  it("非在线行改给会话管理入口，且需要在线会话页权限", () => {
    expect(showSessionManage(true, { online: -1 })).toBe(true);
    expect(showSessionManage(true, { online: false })).toBe(true);
    expect(showSessionManage(true, { online: true })).toBe(false);
    expect(showSessionManage(false, { online: -1 })).toBe(false);
  });

  it("会话管理带上用户主键作为筛选参数", () => {
    expect(onlineSessionsQuery({ creator: { pk: 12 } })).toEqual({
      creator_id: "12"
    });
    expect(onlineSessionsQuery({ creator: { pk: "uuid" } })).toEqual({
      creator_id: "uuid"
    });
    expect(onlineSessionsQuery({ creator: null })).toEqual({});
    expect(onlineSessionsQuery(undefined)).toEqual({});
  });

  it("策略结果拆成动作与原因", () => {
    expect(parsePolicyResult("reject:ip not allowed")).toEqual({
      action: "reject",
      reason: "ip not allowed"
    });
    expect(parsePolicyResult("require_mfa")).toEqual({
      action: "require_mfa",
      reason: ""
    });
    expect(parsePolicyResult("")).toEqual({ action: "", reason: "" });
  });
});
