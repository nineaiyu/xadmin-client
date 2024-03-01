<script lang="ts" setup>
import { getTopMenu } from "@/router/utils";
import { useNav } from "@/layout/hooks/useNav";

const props = defineProps({
  collapse: Boolean
});

const { title, getLogo } = useNav();
</script>

<template>
  <div :class="{ collapses: props.collapse }" class="sidebar-logo-container">
    <transition name="sidebarLogoFade">
      <router-link
        v-if="props.collapse"
        key="props.collapse"
        :title="title"
        :to="getTopMenu()?.path ?? '/'"
        class="sidebar-logo-link"
      >
        <img :src="getLogo()" alt="logo" />
        <span class="sidebar-title">{{ title }}</span>
      </router-link>
      <router-link
        v-else
        key="expand"
        :title="title"
        :to="getTopMenu()?.path ?? '/'"
        class="sidebar-logo-link"
      >
        <img :src="getLogo()" alt="logo" />
        <span class="sidebar-title">{{ title }}</span>
      </router-link>
    </transition>
  </div>
</template>

<style lang="scss" scoped>
.sidebar-logo-container {
  position: relative;
  width: 100%;
  height: 48px;
  overflow: hidden;

  .sidebar-logo-link {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    height: 100%;
    padding-left: 10px;

    img {
      display: inline-block;
      height: 32px;
    }

    .sidebar-title {
      display: inline-block;
      height: 32px;
      margin: 2px 0 0 12px;
      overflow: hidden;
      font-size: 18px;
      font-weight: 600;
      line-height: 32px;
      color: $subMenuActiveText;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}
</style>
