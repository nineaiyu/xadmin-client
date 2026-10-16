<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import UserShared from "~icons/ri/user-shared-line";
import { useUserStoreHook } from "@/store/modules/user";
import { useImpersonationExit } from "./useImpersonationExit";

defineOptions({ name: "LayImpersonationDropdownItem" });

/**
 * 头像下拉菜单里的「退出模拟」项（模拟态才渲染）：
 * 与顶栏横幅同一退出链路，给不想去找横幅的用户一个就近入口。
 * 文案与「退出登录」相近但语义不同——退出模拟恢复原身份（仍保持登录态），
 * 故用警示色与图标强调区分。
 */
const { t } = useI18n();
const userStore = useUserStoreHook();
const visible = computed(() => Boolean(userStore.impersonator));
const { exiting, exitImpersonation } = useImpersonationExit();
</script>

<template>
  <el-dropdown-item
    v-if="visible"
    class="impersonation-exit-item"
    :class="{ 'is-exiting': exiting }"
    @click="exitImpersonation"
  >
    <IconifyIconOffline :icon="UserShared" style="margin: 5px" />
    {{ t("layout.impersonateExit") }}
  </el-dropdown-item>
</template>

<style lang="scss" scoped>
.impersonation-exit-item {
  color: var(--el-color-warning);

  &.is-exiting {
    pointer-events: none;
    opacity: 0.6;
  }
}
</style>
