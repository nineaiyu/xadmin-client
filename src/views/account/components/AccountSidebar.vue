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
 *
 * 返回入口 / 名片 / 页签的行高与左侧内边距同源（48px + 菜单级 padding），
 * 三段内容左右对齐成同一列。
 */
defineProps<{
  /** 当前激活页签 key */
  currentPane: string;
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
  <el-menu :default-active="currentPane" class="pure-account-settings-menu">
    <div class="account-sidebar__back" @click="router.go(-1)">
      <IconifyIconOffline :icon="leftLine" />
      <span class="ml-2">{{ t("account.back") }}</span>
    </div>
    <div class="account-sidebar__profile">
      <el-avatar :size="48" :src="userinfoStore.avatar ?? avatar" />
      <div class="account-sidebar__identity">
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

<style lang="scss" scoped>
.account-sidebar__back {
  display: flex;
  gap: 4px;
  align-items: center;
  height: 48px;
  padding: 0 var(--el-menu-base-level-padding);
  font-size: 14px;
  color: var(--pure-theme-menu-text);
  cursor: pointer;
  transition: color 0.2s;
}

.account-sidebar__back:hover {
  color: var(--pure-theme-menu-title-hover);
}

.account-sidebar__profile {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 12px var(--el-menu-base-level-padding) 16px;
}

.account-sidebar__identity {
  display: flex;
  flex-direction: column;
  min-width: 0;
  max-width: 100px;
}
</style>
