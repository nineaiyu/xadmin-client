import { afterEach, describe, expect, it } from "vitest";

import { responsiveStorageNameSpace } from "@/config";
import { checkUpdatesEnabled, setCheckUpdatesEnabled } from "../autoUpdate";

const STORAGE_KEY = `${responsiveStorageNameSpace()}check-updates-enabled`;

afterEach(() => {
  localStorage.clear();
});

describe("自动检查更新（本地偏好）", () => {
  it("无存储时默认开启（与历史行为一致）", () => {
    expect(checkUpdatesEnabled()).toBe(true);
  });

  it("关闭后读回 false，重新开启后读回 true", () => {
    setCheckUpdatesEnabled(false);
    expect(checkUpdatesEnabled()).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("false");

    setCheckUpdatesEnabled(true);
    expect(checkUpdatesEnabled()).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("true");
  });
});
