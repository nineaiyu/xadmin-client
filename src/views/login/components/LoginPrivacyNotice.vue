<script lang="ts" setup>
import { ref } from "vue";
import { useI18n } from "vue-i18n";

/** 登录页隐私提示：登录即同意；条款正文沿用注册页同一份文案 */
defineOptions({ name: "LoginPrivacyNotice" });

const { t } = useI18n();
const visible = ref(false);
</script>

<template>
  <p class="login-privacy">
    {{ t("login.privacyPrefix") }}
    <el-button link type="primary" size="small" @click="visible = true">
      {{ t("login.privacyPolicy") }}
    </el-button>
  </p>
  <el-dialog
    v-model="visible"
    :title="t('login.privacyPolicy')"
    width="560px"
    align-center
    destroy-on-close
  >
    <p class="whitespace-pre-wrap text-sm leading-6">
      {{ t("login.privacyPolicyBody") }}
    </p>
    <template #footer>
      <el-button type="primary" @click="visible = false">
        {{ t("login.confirm") }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.login-privacy {
  margin-top: var(--space-3);
  font-size: var(--font-size-xs);
  line-height: 18px;
  color: var(--el-text-color-secondary);
  text-align: center;
}
</style>
