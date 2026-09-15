import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick } from "vue";
import { useTranslationLang } from "./useTranslationLang";

/** vi.mock 工厂共享桩：站点配置自动保存 / 语言与 storage */
const mocks = vi.hoisted(() => ({
  autoSaveSiteConfig: vi.fn(),
  storage: { locale: { locale: "zh" } } as Record<string, unknown>,
  changeTitle: vi.fn(),
  handleResize: vi.fn()
}));

vi.mock("@/store/modules/siteConfig", () => ({
  useSiteConfigStoreHook: () => ({
    autoSaveSiteConfig: mocks.autoSaveSiteConfig
  })
}));

vi.mock("./useNav", () => ({
  useNav: () => ({
    $storage: mocks.storage,
    changeTitle: mocks.changeTitle,
    handleResize: mocks.handleResize
  })
}));

vi.mock("vue-i18n", async () => {
  const { ref } = await import("vue");
  const locale = ref("zh");
  return {
    useI18n: () => ({ locale, t: (key: string) => key })
  };
});

vi.mock("vue-router", () => ({
  useRoute: () => ({ meta: {} })
}));

function mountHook() {
  let api: ReturnType<typeof useTranslationLang> | null = null;
  const Comp = defineComponent({
    setup() {
      api = useTranslationLang();
      return () => h("div");
    }
  });
  createApp(Comp).mount(document.createElement("div"));
  return api!;
}

beforeEach(() => {
  mocks.autoSaveSiteConfig.mockClear();
});

describe("useTranslationLang 语言切换实时持久化", () => {
  it("切中文：更新本地语言并触发站点配置自动保存", async () => {
    const api = mountHook();
    await nextTick();
    api.translationCh();
    expect(mocks.storage.locale).toEqual({ locale: "zh" });
    expect(api.locale.value).toBe("zh");
    expect(mocks.autoSaveSiteConfig).toHaveBeenCalledTimes(1);
  });

  it("切英文：更新本地语言并触发站点配置自动保存", async () => {
    const api = mountHook();
    await nextTick();
    api.translationEn();
    expect(mocks.storage.locale).toEqual({ locale: "en" });
    expect(api.locale.value).toBe("en");
    expect(mocks.autoSaveSiteConfig).toHaveBeenCalledTimes(1);
  });
});
