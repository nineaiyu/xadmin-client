import { describe, expect, beforeEach, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";

import { useWatermarkStore } from "../watermark";
import { defaultSiteWatermark } from "@/utils/watermark";

describe("watermark store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("store id 保持 pure-watermark", () => {
    expect(useWatermarkStore().$id).toBe("pure-watermark");
  });

  it("站点水印配置默认关闭，applyFromUserInfo 写入后 reset() 复位", () => {
    const store = useWatermarkStore();
    expect(store.siteWatermark).toEqual({ ...defaultSiteWatermark });
    // 模拟用户信息接口下发 config 后（登出/清空缓存需复位）
    store.applyFromUserInfo({
      FRONT_END_WEB_WATERMARK_ENABLED: true,
      FRONT_END_WEB_WATERMARK_TEXT: "{username}-{phone}-{time}",
      FRONT_END_WEB_WATERMARK_PATHS: "/system/user/index",
      FRONT_END_WEB_WATERMARK_FONT_SIZE: 24,
      FRONT_END_WEB_WATERMARK_OPACITY: 0.2,
      FRONT_END_WEB_WATERMARK_ROTATE: -30,
      FRONT_END_WEB_WATERMARK_COLOR: "#909399"
    });
    expect(store.siteWatermark).toEqual({
      enabled: true,
      template: "{username}-{phone}-{time}",
      paths: ["/system/user/index"],
      fontSize: 24,
      opacity: 0.2,
      rotate: -30,
      color: "#909399"
    });
    store.reset();
    expect(store.siteWatermark).toEqual({ ...defaultSiteWatermark });
  });
});
