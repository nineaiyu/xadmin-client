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
  <!-- 必须 append-to-body：外层 Motion 容器残留 transform，会把 position:fixed
       的遮罩压进这一行（弹窗被裁成 19px 高的白条）。与 Register.vue 同一约束。 -->
  <el-dialog
    v-model="visible"
    :title="t('login.privacyPolicy')"
    width="560px"
    align-center
    destroy-on-close
    append-to-body
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
