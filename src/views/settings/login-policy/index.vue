<script lang="ts" setup>
import ReEmpty from "@/components/ReEmpty";
import { useI18n } from "vue-i18n";
import { useLoginPolicy } from "./utils/hook";

defineOptions({
  name: "SystemLoginPolicy"
});

const { t } = useI18n();

const { api, auth, addOrEditOptions, tableBarButtonsProps } = useLoginPolicy();
</script>

<template>
  <div v-if="auth.list">
    <!-- 登录访问策略：时段 / 网段 × 对象，按优先级首个命中生效；预演可见逐条匹配结果 -->
    <RePlusPage
      :api="api"
      :auth="auth"
      :selection="false"
      locale-name="systemLoginPolicy"
      :addOrEditOptions="addOrEditOptions"
      :tableBarButtonsProps="tableBarButtonsProps"
    />
  </div>
  <!-- 无列表权限时给出明确说明，而不是整页空白 -->
  <ReEmpty
    v-else
    data-testid="login-policy-no-permission"
    :description="t('setting.noPermission')"
  />
</template>
