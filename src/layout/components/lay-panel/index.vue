<script lang="ts" setup>
import { emitter } from "@/utils/mitt";
import { onClickOutside } from "@vueuse/core";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useDataThemeChange } from "@/layout/hooks/useDataThemeChange";
import CloseIcon from "~icons/ep/close";
import { useI18n } from "vue-i18n";
import { useSiteConfigStoreHook } from "@/store/modules/siteConfig";

const target = ref(null);
const show = ref<Boolean>(false);
const { t } = useI18n();
const {
  pkg: { version }
} = __APP_INFO__;

const iconClass = computed(() => {
  return [
    "w-[22px]",
    "h-[22px]",
    "flex",
    "justify-center",
    "items-center",
    "outline-hidden",
    "rounded-[4px]",
    "cursor-pointer",
    "transition-colors",
    "hover:bg-[#0000000f]",
    "dark:hover:bg-[#ffffff1f]",
    "dark:hover:text-[#ffffffd9]"
  ];
});

const { onReset } = useDataThemeChange();

const { saveSiteConfig, resetSiteConfig } = useSiteConfigStoreHook();

onClickOutside(target, (event: any) => {
  if (event.clientX > target.value.offsetLeft) return;
  show.value = false;
});

onMounted(() => {
  emitter.on("openPanel", () => {
    show.value = true;
  });
});

onBeforeUnmount(() => {
  // 解绑`openPanel`公共事件，防止多次触发
  emitter.off("openPanel");
});
</script>

<template>
  <div :class="{ show }">
    <div class="right-panel-background" />
    <div ref="target" class="right-panel bg-bg_color">
      <div
        class="project-configuration border-0 border-b-[1px] border-solid border-[var(--pure-border-color)]"
      >
        <el-badge
          :value="version"
          class="item"
          :offset="[12, 5]"
          type="primary"
        >
          <h4 class="dark:text-white">{{ t("layout.settings") }}</h4>
        </el-badge>
        <span
          v-tippy="{
            content: t('buttons.close'),
            placement: 'bottom-start',
            zIndex: 41000
          }"
          :class="iconClass"
        >
          <IconifyIconOffline
            :icon="CloseIcon"
            class="dark:text-white"
            height="18px"
            width="18px"
            @click="show = !show"
          />
        </span>
      </div>
      <el-scrollbar>
        <slot />
      </el-scrollbar>

      <div
        class="flex justify-end p-3 border-0 border-t-[1px] border-solid border-[var(--pure-border-color)]"
      >
        <el-button
          v-tippy="{
            content: t('layout.saveConfigTip'),
            placement: 'top-start',
            zIndex: 41000
          }"
          bg
          text
          type="success"
          @click="saveSiteConfig"
        >
          {{ t("layout.saveConfig") }}
        </el-button>
        <el-button
          v-tippy="{
            content: t('layout.resetConfigTip'),
            placement: 'top-start',
            zIndex: 41000
          }"
          bg
          text
          type="primary"
          @click="resetSiteConfig"
        >
          {{ t("layout.resetConfig") }}
        </el-button>
        <el-button
          v-tippy="{
            content: t('layout.cleanOut'),
            placement: 'top-start',
            zIndex: 41000
          }"
          bg
          text
          type="danger"
          @click="onReset"
        >
          {{ t("layout.clearCache") }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.el-scrollbar) {
  height: calc(100vh - 110px);
}

.right-panel-background {
  position: fixed;
  top: 0;
  left: 0;
  z-index: -1;
  background: rgb(0 0 0 / 20%);
  opacity: 0;
  transition: opacity 0.3s cubic-bezier(0.7, 0.3, 0.1, 1);
}

.right-panel {
  position: fixed;
  top: 0;
  right: 0;
  z-index: 40000;
  width: 100%;
  max-width: 280px;
  box-shadow: 0 0 15px 0 rgb(0 0 0 / 5%);
  transform: translate(100%);
  transition: all 0.25s cubic-bezier(0.7, 0.3, 0.1, 1);
}

.show {
  transition: all 0.3s cubic-bezier(0.7, 0.3, 0.1, 1);

  .right-panel-background {
    z-index: 20000;
    width: 100%;
    height: 100%;
    opacity: 1;
  }

  .right-panel {
    transform: translate(0);
  }
}

.project-configuration {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
}
</style>
