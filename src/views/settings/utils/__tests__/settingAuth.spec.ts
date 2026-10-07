import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hasAuth: vi.fn()
}));

vi.mock("@/router/utils", () => ({ hasAuth: mocks.hasAuth }));

import { settingAuth } from "../settingAuth";

describe("settingAuth 设置页签按钮权限装配", () => {
  it("产出 partialUpdate / retrieve 两位，权限码按后缀拼接", () => {
    mocks.hasAuth.mockImplementation(
      (code: string) => code === "partialUpdate:SettingBasic"
    );

    expect(settingAuth("SettingBasic")).toEqual({
      partialUpdate: true,
      retrieve: false
    });
    expect(mocks.hasAuth).toHaveBeenCalledWith("partialUpdate:SettingBasic");
    expect(mocks.hasAuth).toHaveBeenCalledWith("retrieve:SettingBasic");
  });

  it("withTest 开启时追加 test 位（create 权限码），关闭时不出现该键", () => {
    mocks.hasAuth.mockReturnValue(true);

    const withTest = settingAuth("SmsConfig", true);
    expect(withTest).toEqual({
      partialUpdate: true,
      retrieve: true,
      test: true
    });
    expect(mocks.hasAuth).toHaveBeenCalledWith("create:SmsConfig");

    expect(settingAuth("SettingBasic")).not.toHaveProperty("test");
  });
});
