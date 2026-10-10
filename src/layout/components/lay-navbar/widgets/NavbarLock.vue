<script lang="ts" setup>
// 顶栏「锁屏」按钮（遮罩 + 口令解锁，见 lay-lock）
import { useNav } from "@/layout/hooks/useNav";
import { useLockScreen } from "@/layout/hooks/useLockScreen";
import LockIcon from "~icons/ri/lock-2-line";

const { t } = useNav();
const { lock } = useLockScreen();
</script>

<template>
  <span
    id="header-lock"
    class="navbar-bg-hover hover:[&>svg]:animate-scale-bounce"
    role="button"
    tabindex="0"
    :title="t('layout.lockScreen')"
    :aria-label="t('layout.lockScreen')"
    @click="lock"
    @keydown.enter.prevent="lock"
    @keydown.space.prevent="lock"
  >
    <IconifyIconOffline :icon="LockIcon" />
  </span>
</template>
