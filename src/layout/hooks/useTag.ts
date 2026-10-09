import {
  type CSSProperties,
  getCurrentInstance,
  onMounted,
  ref,
  computed
} from "vue";
import { useRoute, useRouter } from "vue-router";
import { $t, transformI18n } from "@/plugins/i18n";
import { responsiveStorageNameSpace } from "@/config";
import { useSettingStoreHook } from "@/store/modules/settings";
import { useMultiTagsStoreHook } from "@/store/modules/multiTags";
import { storageLocal } from "@pureadmin/utils";
import Close from "~icons/ep/close";
import { createTagsPreferences, createTagsViews } from "./tagViewsConfig";
import { createTagActiveState } from "./tagActiveState";
import { createTagHoverHandlers } from "./tagHoverHandlers";

/** 标签栏状态装配：菜单项/偏好、激活态判定与 hover 动效分别见同目录三个模块 */

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

  const { tagsStyle, showTags } = createTagsPreferences();
  const multiTags = computed(() => {
    return useMultiTagsStoreHook().multiTags;
  });

  const tagsViews = createTagsViews(multiTags.value.length);

  const { isFixedTag, iconIsActive, linkIsActive, scheduleIsActive } =
    createTagActiveState(route);

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

  const { onMouseenter, onMouseleave } = createTagHoverHandlers({
    instance,
    activeIndex,
    tagsStyle
  });

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
