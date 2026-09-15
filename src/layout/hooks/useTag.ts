import {
  computed,
  type CSSProperties,
  getCurrentInstance,
  onMounted,
  reactive,
  ref,
  unref
} from "vue";
import type { RouteConfigs, tagsViewsType } from "../types";
import { useRoute, useRouter } from "vue-router";
import { $t, transformI18n } from "@/plugins/i18n";
import { responsiveStorageNameSpace } from "@/config";
import { useSettingStoreHook } from "@/store/modules/settings";
import { useMultiTagsStoreHook } from "@/store/modules/multiTags";
import {
  hasClass,
  isBoolean,
  isEqual,
  storageLocal,
  toggleClass
} from "@pureadmin/utils";

import Fullscreen from "~icons/ri/fullscreen-fill";
import CloseAllTags from "~icons/ri/subtract-line";
import CloseOtherTags from "~icons/ri/text-spacing";
import CloseRightTags from "~icons/ri/text-direction-l";
import CloseLeftTags from "~icons/ri/text-direction-r";
import RefreshRight from "~icons/ep/refresh-right";
import Close from "~icons/ep/close";

export function useTags() {
  const route = useRoute();
  const router = useRouter();
  const instance = getCurrentInstance();
  const pureSetting = useSettingStoreHook();

  const buttonTop = ref(0);
  const buttonLeft = ref(0);
  const translateX = ref(0);
  const visible = ref(false);
  const activeIndex = ref(-1);
  // 当前右键选中的路由信息
  const currentSelect = ref({});
  const isScrolling = ref(false);

  /** 页签风格默认为谷歌风格 */
  const tagsStyle = ref(
    storageLocal().getItem<StorageConfigs>(
      `${responsiveStorageNameSpace()}configure`
    )?.tagsStyle || "chrome"
  );
  /** 是否隐藏标签页，默认显示 */
  const showTags =
    ref(
      storageLocal().getItem<StorageConfigs>(
        `${responsiveStorageNameSpace()}configure`
      ).hideTabs
    ) ?? ref("false");
  const multiTags = computed(() => {
    return useMultiTagsStoreHook().multiTags;
  });

  const tagsViews = reactive<Array<tagsViewsType>>([
    {
      icon: RefreshRight,
      text: $t("buttons.reload"),
      divided: false,
      disabled: false,
      show: true
    },
    {
      icon: Close,
      text: $t("buttons.closeCurrentTab"),
      divided: false,
      disabled: multiTags.value.length > 1 ? false : true,
      show: true
    },
    {
      icon: CloseLeftTags,
      text: $t("buttons.closeLeftTabs"),
      divided: true,
      disabled: multiTags.value.length > 1 ? false : true,
      show: true
    },
    {
      icon: CloseRightTags,
      text: $t("buttons.closeRightTabs"),
      divided: false,
      disabled: multiTags.value.length > 1 ? false : true,
      show: true
    },
    {
      icon: CloseOtherTags,
      text: $t("buttons.closeOtherTabs"),
      divided: true,
      disabled: multiTags.value.length > 2 ? false : true,
      show: true
    },
    {
      icon: CloseAllTags,
      text: $t("buttons.closeAllTabs"),
      divided: false,
      disabled: multiTags.value.length > 1 ? false : true,
      show: true
    },
    {
      icon: Fullscreen,
      text: $t("buttons.contentFullScreen"),
      divided: true,
      disabled: false,
      show: true
    }
  ]);

  function conditionHandle(
    item: RouteConfigs,
    previous: string | boolean,
    next: string | boolean
  ) {
    const currentName = route.name || "";
    const itemName = item.name || "";

    if (isBoolean(route?.meta?.showLink) && route?.meta?.showLink === false) {
      if (Object.keys(route.query).length > 0) {
        return currentName === itemName && isEqual(route.query, item.query)
          ? previous
          : next;
      } else {
        return currentName === itemName && isEqual(route.params, item.params)
          ? previous
          : next;
      }
    } else {
      return currentName === itemName ? previous : next;
    }
  }

  const isFixedTag = computed(() => {
    return (item: RouteConfigs) => {
      return isBoolean(item?.meta?.fixedTag) && item?.meta?.fixedTag === true;
    };
  });

  const iconIsActive = computed(() => {
    return (item: RouteConfigs, index: number) => {
      if (index === 0) return;
      return conditionHandle(item, true, false);
    };
  });

  const linkIsActive = computed(() => {
    return (item: RouteConfigs) => {
      return conditionHandle(item, "is-active", "");
    };
  });

  const scheduleIsActive = computed(() => {
    return (item: RouteConfigs) => {
      return conditionHandle(item, "schedule-active", "");
    };
  });

  const getTabStyle = computed((): CSSProperties => {
    return {
      transform: `translateX(${translateX.value}px)`,
      transition: isScrolling.value ? "none" : "transform 0.5s ease-in-out"
    };
  });

  const getContextMenuStyle = computed((): CSSProperties => {
    return { left: buttonLeft.value + "px", top: buttonTop.value + "px" };
  });

  const closeMenu = () => {
    visible.value = false;
  };

  /** 鼠标移入添加激活样式 */
  /** 取标签元素（模板 ref 数组；运行时该 ref 必然存在，类型层做兜底断言） */
  function getTagEl(prefix: string, index: number): HTMLElement {
    const refs = instance?.refs as Record<string, HTMLElement[]> | undefined;
    return refs?.[prefix + index]?.[0] as HTMLElement;
  }

  function onMouseenter(index: number) {
    if (index) activeIndex.value = index;
    if (unref(tagsStyle) === "smart") {
      if (hasClass(getTagEl("schedule", index), "schedule-active")) return;
      toggleClass(true, "schedule-in", getTagEl("schedule", index));
      toggleClass(false, "schedule-out", getTagEl("schedule", index));
    } else {
      if (hasClass(getTagEl("dynamic", index), "is-active")) return;
      toggleClass(true, "card-in", getTagEl("dynamic", index));
      toggleClass(false, "card-out", getTagEl("dynamic", index));
    }
  }

  /** 鼠标移出恢复默认样式 */
  function onMouseleave(index: number) {
    activeIndex.value = -1;
    if (unref(tagsStyle) === "smart") {
      if (hasClass(getTagEl("schedule", index), "schedule-active")) return;
      toggleClass(false, "schedule-in", getTagEl("schedule", index));
      toggleClass(true, "schedule-out", getTagEl("schedule", index));
    } else {
      if (hasClass(getTagEl("dynamic", index), "is-active")) return;
      toggleClass(false, "card-in", getTagEl("dynamic", index));
      toggleClass(true, "card-out", getTagEl("dynamic", index));
    }
  }

  function onContentFullScreen() {
    if (pureSetting.hiddenSideBar) {
      pureSetting.changeSetting({ key: "hiddenSideBar", value: false });
    } else {
      pureSetting.changeSetting({ key: "hiddenSideBar", value: true });
    }
  }

  onMounted(() => {
    if (!tagsStyle.value) {
      const configure = storageLocal().getItem<StorageConfigs>(
        `${responsiveStorageNameSpace()}configure`
      );
      configure.tagsStyle = "card";
      storageLocal().setItem(
        `${responsiveStorageNameSpace()}configure`,
        configure
      );
    }
  });

  return {
    Close,
    route,
    router,
    visible,
    showTags,
    instance,
    multiTags,
    tagsStyle,
    tagsViews,
    buttonTop,
    buttonLeft,
    translateX,
    isFixedTag,
    pureSetting,
    activeIndex,
    getTabStyle,
    isScrolling,
    iconIsActive,
    linkIsActive,
    currentSelect,
    scheduleIsActive,
    getContextMenuStyle,
    $t,
    closeMenu,
    onMounted,
    onMouseenter,
    onMouseleave,
    transformI18n,
    onContentFullScreen
  };
}
