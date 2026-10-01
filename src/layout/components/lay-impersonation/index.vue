<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import UserShared from "~icons/ri/user-shared-line";
import { useUserStoreHook } from "@/store/modules/user";
import { useImpersonationExit } from "./useImpersonationExit";

defineOptions({ name: "LayImpersonation" });

/**
 * 用户模拟横幅（顶栏下方全局常驻）：模拟态由后端 userinfo 下发（impersonator），
 * 状态跟 token 走，硬刷新后不丢。点击横幅整体退出模拟——服务端为模拟发起人
 * 重签 token 后整页刷新，恢复原身份。
 */
const { t } = useI18n();
const userStore = useUserStoreHook();

/**
 * 横幅展示的被模拟用户名 = 当前登录身份（模拟态下 store 即目标用户）；
 * impersonator 载荷仅作「是否处于模拟态」的判定与追溯依据。
 */
const impersonatedName = computed(
  () => userStore.nickname || userStore.username || ""
);
const visible = computed(() => Boolean(userStore.impersonator));
const { exiting, exitImpersonation } = useImpersonationExit();
</script>

<template>
  <div
    v-if="visible"
    class="impersonation-banner"
    role="status"
    :aria-label="t('layout.impersonateExit')"
    @click="exitImpersonation"
  >
    <IconifyIconOffline :icon="UserShared" class="banner-icon" />
    <span class="banner-text">
      {{ t("layout.impersonating", { user: impersonatedName }) }}
    </span>
    <span class="banner-action" :class="{ 'is-exiting': exiting }">
      {{ t("layout.impersonateExit") }}
    </span>
  </div>
</template>

<style lang="scss" scoped>
.impersonation-banner {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: center;
  height: 32px;
  font-size: 13px;
  color: var(--el-color-warning-dark-2);
  cursor: pointer;
  user-select: none;
  background: var(--el-color-warning-light-9);
  border-bottom: 1px solid var(--el-color-warning-light-5);
  transition: filter 0.2s;

  &:hover {
    filter: brightness(0.97);
  }

  .banner-icon {
    flex-shrink: 0;
    width: 15px;
    height: 15px;
  }

  .banner-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .banner-action {
    flex-shrink: 0;
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 3px;

    &.is-exiting {
      opacity: 0.6;
    }
  }
}
</style>
