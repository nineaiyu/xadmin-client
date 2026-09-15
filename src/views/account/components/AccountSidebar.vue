<script lang="ts" setup>
import { useRouter } from "vue-router";
import type { Component } from "vue";
import { ReText } from "@/components/ReText";
import { useUserStoreHook } from "@/store/modules/user";
import { useI18n } from "vue-i18n";
import avatar from "@/assets/avatar.png";
import leftLine from "~icons/ri/arrow-left-s-line";

/**
 * 账户设置侧栏内容（返回入口 + 用户名片 + 页签导航）。
 * 桌面端作为分栏容器 paneL 的内容、移动端作为 el-aside 的内容复用。
 */
defineProps<{
  /** 当前激活页签 key */
  witchPane: string;
  /** 页签清单（key/label/icon/auth 由父级按权限计算） */
  panes: Array<{ key: string; label: string; icon: Component; auth: boolean }>;
}>();

const emit = defineEmits<{
  switchPane: [key: string];
}>();

const router = useRouter();
const userinfoStore = useUserStoreHook();
const { t } = useI18n();
</script>

<template>
  <el-menu :default-active="witchPane" class="pure-account-settings-menu">
    <div
      class="h-12.5! text-(--pure-theme-menu-text) cursor-pointer text-sm transition-all duration-300 ease-in-out hover:scale-105 will-change-transform transform-gpu origin-center hover:text-base! hover:text-(--pure-theme-menu-title-hover)!"
      @click="router.go(-1)"
    >
      <div class="h-full flex items-center px-(--el-menu-base-level-padding)">
        <IconifyIconOffline :icon="leftLine" />
        <span class="ml-2">{{ t("account.back") }}</span>
      </div>
    </div>
    <div class="flex items-center ml-8 my-4">
      <el-avatar :size="48" :src="userinfoStore.avatar ?? avatar" />
      <div class="ml-4 flex flex-col max-w-25">
        <ReText class="font-bold self-baseline!">
          {{ userinfoStore.nickname }}
        </ReText>
        <ReText class="self-baseline!" type="info">
          {{ userinfoStore.username }}
        </ReText>
      </div>
    </div>
    <el-menu-item
      v-for="item in panes.filter(item => item.auth)"
      :key="item.key"
      :index="item.key"
      @click="emit('switchPane', item.key)"
    >
      <div class="flex items-center z-10">
        <el-icon>
          <IconifyIconOffline :icon="item.icon" />
        </el-icon>
        <span>{{ item.label }}</span>
      </div>
    </el-menu-item>
  </el-menu>
</template>
