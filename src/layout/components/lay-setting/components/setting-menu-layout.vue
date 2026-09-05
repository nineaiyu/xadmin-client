<script lang="ts" setup>
// 系统设置面板：导航模式（垂直/水平/混合）设置区块
import { ref, unref, watch, type Ref } from "vue";
import { debounce, useGlobal } from "@pureadmin/utils";
import { useNav } from "@/layout/hooks/useNav";
import { useDataThemeChange } from "@/layout/hooks/useDataThemeChange";
import { useMenuLayout } from "../hooks/useMenuLayout";
import { pClass } from "../hooks/useSectionClass";

const { device, t } = useNav();
const { $storage } = useGlobal<GlobalPropertiesApi>();
const { layoutTheme, toggleClass } = useDataThemeChange();
const { setMenuLayout } = useMenuLayout();

const mixRef = ref();
const verticalRef = ref();
const horizontalRef = ref();

function setFalse(Doms: Ref<HTMLElement | undefined>[]): () => void {
  Doms.forEach(v => {
    toggleClass(false, "is-select", unref(v));
  });
  // 既有 `debounce(setFalse([...]), 50)` 调用要求传入函数（其包装器实际被丢弃），补空函数以满足签名
  return () => {};
}

watch($storage, ({ layout }) => {
  switch (layout["layout"]) {
    case "vertical":
      toggleClass(true, "is-select", unref(verticalRef));
      debounce(setFalse([horizontalRef]), 50);
      debounce(setFalse([mixRef]), 50);
      break;
    case "horizontal":
      toggleClass(true, "is-select", unref(horizontalRef));
      debounce(setFalse([verticalRef]), 50);
      debounce(setFalse([mixRef]), 50);
      break;
    case "mix":
      toggleClass(true, "is-select", unref(mixRef));
      debounce(setFalse([verticalRef]), 50);
      debounce(setFalse([horizontalRef]), 50);
      break;
  }
});
</script>

<template>
  <p :class="['mt-5!', pClass]">{{ t("layout.menuLayout") }}</p>
  <ul class="pure-theme">
    <li
      ref="verticalRef"
      v-tippy="{
        content: t('layout.leftMode'),
        zIndex: 41000
      }"
      :class="layoutTheme.layout === 'vertical' ? 'is-select' : ''"
      @click="setMenuLayout('vertical')"
    >
      <div />
      <div />
    </li>
    <li
      v-if="device !== 'mobile'"
      ref="horizontalRef"
      v-tippy="{
        content: t('layout.topMode'),
        zIndex: 41000
      }"
      :class="layoutTheme.layout === 'horizontal' ? 'is-select' : ''"
      @click="setMenuLayout('horizontal')"
    >
      <div />
      <div />
    </li>
    <li
      v-if="device !== 'mobile'"
      ref="mixRef"
      v-tippy="{
        content: t('layout.mixedMode'),
        zIndex: 41000
      }"
      :class="layoutTheme.layout === 'mix' ? 'is-select' : ''"
      @click="setMenuLayout('mix')"
    >
      <div />
      <div />
    </li>
  </ul>
</template>

<style lang="scss" scoped>
.pure-theme {
  display: flex;
  gap: 12px;

  li {
    position: relative;
    width: 46px;
    height: 36px;
    overflow: hidden;
    cursor: pointer;
    background: #f0f2f5;
    border-radius: 4px;
    box-shadow: 0 1px 2.5px 0 rgb(0 0 0 / 18%);

    &:nth-child(1) {
      div {
        &:nth-child(1) {
          width: 30%;
          height: 100%;
          background: #1b2a47;
        }

        &:nth-child(2) {
          position: absolute;
          top: 0;
          right: 0;
          width: 70%;
          height: 30%;
          background: #fff;
          box-shadow: 0 0 1px #888;
        }
      }
    }

    &:nth-child(2) {
      div {
        &:nth-child(1) {
          width: 100%;
          height: 30%;
          background: #1b2a47;
          box-shadow: 0 0 1px #888;
        }
      }
    }

    &:nth-child(3) {
      div {
        &:nth-child(1) {
          width: 100%;
          height: 30%;
          background: #1b2a47;
          box-shadow: 0 0 1px #888;
        }

        &:nth-child(2) {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 30%;
          height: 70%;
          background: #fff;
          box-shadow: 0 0 1px #888;
        }
      }
    }
  }
}

.is-select {
  border: 2px solid var(--el-color-primary);
}
</style>
