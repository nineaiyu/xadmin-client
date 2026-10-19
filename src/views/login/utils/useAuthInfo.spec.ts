import { describe, expect, it } from "vitest";
import { nextTick, ref } from "vue";
import { useAuthInfo } from "./useAuthInfo";

describe("useAuthInfo", () => {
  it("初始为空配置且未在加载中", () => {
    const { authInfo, configLoading } = useAuthInfo();
    expect(authInfo.value).toEqual({});
    expect(configLoading.value).toBe(false);
  });

  it("onConfig 合并后端配置（增量合并，不清空既有字段）", async () => {
    const { authInfo, onConfig } = useAuthInfo();
    onConfig({ access: true, lifetime: 7 });
    await nextTick();
    expect(authInfo.value.access).toBe(true);
    expect(authInfo.value.lifetime).toBe(7);

    // 二次返回只覆盖携带的字段，其余保持
    onConfig({ encrypted: true });
    await nextTick();
    expect(authInfo.value.access).toBe(true);
    expect(authInfo.value.encrypted).toBe(true);
  });

  it("缺字段保持 undefined（调用方用 ?? 兜底，不依赖运行时默认值）", async () => {
    const { authInfo, onConfig } = useAuthInfo();
    onConfig({ access: true });
    await nextTick();
    expect(authInfo.value.password).toBeUndefined();
    expect(authInfo.value.lifetime).toBeUndefined();
    // 页面侧的天数兜底写法
    const loginDay = ref(1);
    loginDay.value = authInfo.value.lifetime ?? 1;
    expect(loginDay.value).toBe(1);
  });

  it("configLoading 可手动置位与复位（页面加载态由调用方驱动）", async () => {
    const { configLoading } = useAuthInfo();
    configLoading.value = true;
    expect(configLoading.value).toBe(true);
    configLoading.value = false;
    expect(configLoading.value).toBe(false);
  });
});
