import { describe, expect, it } from "vitest";
import { notificationActionVisibility } from "../notificationPermissions";

/**
 * 订阅面板行内动作显隐矩阵：发送测试与编辑接收人各有独立权限位，
 * 两者都没有时操作列整体不渲染（只读角色不看到点开必 403 的入口）。
 */
const base = { list: true, partialUpdate: false, test: false };

describe("notificationActionVisibility", () => {
  it("只读角色：无操作列", () => {
    expect(notificationActionVisibility(base, true)).toEqual({
      column: false,
      test: false,
      receivers: false
    });
  });

  it("仅持 test 权限：只出现发送测试", () => {
    expect(notificationActionVisibility({ ...base, test: true }, true)).toEqual(
      { column: true, test: true, receivers: false }
    );
  });

  it("仅持 partialUpdate 且有接收人列：只出现编辑接收人", () => {
    expect(
      notificationActionVisibility({ ...base, partialUpdate: true }, true)
    ).toEqual({ column: true, test: false, receivers: true });
  });

  it("hasOperations=false（非运维面板）时编辑接收人不出现", () => {
    expect(
      notificationActionVisibility({ ...base, partialUpdate: true }, false)
        .receivers
    ).toBe(false);
  });

  it("发送测试不受 hasOperations 影响", () => {
    expect(
      notificationActionVisibility({ ...base, test: true }, false).test
    ).toBe(true);
  });
});
