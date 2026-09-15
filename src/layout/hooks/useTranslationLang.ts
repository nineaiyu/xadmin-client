import { useNav } from "./useNav";
import { useI18n } from "vue-i18n";
import type { routeMetaType } from "../types";
import { useRoute } from "vue-router";
import { onBeforeMount, type Ref, watch } from "vue";
import { useSiteConfigStoreHook } from "@/store/modules/siteConfig";

export function useTranslationLang(ref?: Ref) {
  const { $storage, changeTitle, handleResize } = useNav();
  const { locale, t } = useI18n();
  const route = useRoute();

  function translationCh() {
    $storage.locale = { locale: "zh" };
    locale.value = "zh";
    // 语言切换即时生效之外同步持久化（实时保存，无需手动点保存配置）
    useSiteConfigStoreHook().autoSaveSiteConfig();
    if (ref) {
      handleResize(ref.value);
    }
  }

  function translationEn() {
    $storage.locale = { locale: "en" };
    locale.value = "en";
    // 语言切换即时生效之外同步持久化（实时保存，无需手动点保存配置）
    useSiteConfigStoreHook().autoSaveSiteConfig();
    if (ref) {
      handleResize(ref.value);
    }
  }

  watch(
    () => locale.value,
    () => {
      changeTitle(route.meta as routeMetaType);
    }
  );

  onBeforeMount(() => {
    locale.value = $storage.locale?.locale ?? "zh";
  });

  return {
    t,
    route,
    locale,
    translationCh,
    translationEn
  };
}
