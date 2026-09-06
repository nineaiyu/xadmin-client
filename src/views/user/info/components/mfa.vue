<script lang="ts" setup>
/**
 * 个人 MFA 安全管理：OTP(TOTP) 绑定 / 解绑。
 * 解绑为敏感操作：未二次验证时后端返回 412，由 http 层全局验证弹窗接管后自动重发。
 */
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import { handleOperation } from "@/components/RePlusPage";
import { ReQrcode } from "@/components/ReQrcode";
import {
  otpConfirmApi,
  otpDisableApi,
  otpStartApi,
  otpStatusApi,
  type OtpStartResult,
  type OtpStatus
} from "@/api/mfa";

defineOptions({
  name: "EditUserMfa"
});

const { t } = useI18n();

const statusLoading = ref(true);
const status = ref<OtpStatus>({ enabled: false, phone: "", email: "" });
/** 绑定流程中：非空显示二维码确认步骤 */
const bindInfo = ref<OtpStartResult["data"] | null>(null);
const bindLoading = ref(false);
const code = ref("");

const loadStatus = () => {
  statusLoading.value = true;
  otpStatusApi()
    .then(res => {
      if (res.code === 1000) {
        status.value = res.data;
      }
    })
    .finally(() => (statusLoading.value = false));
};

const handleStartBind = () => {
  bindLoading.value = true;
  otpStartApi()
    .then(res => {
      if (res.code === 1000) {
        bindInfo.value = res.data;
      } else {
        message(res.detail, { type: "warning" });
      }
    })
    .finally(() => (bindLoading.value = false));
};

const handleConfirmBind = () => {
  if (!code.value) {
    message(t("mfa.codeRequired"), { type: "warning" });
    return;
  }
  bindLoading.value = true;
  otpConfirmApi({ code: code.value })
    .then(res => {
      if (res.code === 1000) {
        message(res.detail || t("mfa.bindSuccess"), { type: "success" });
        bindInfo.value = null;
        code.value = "";
        loadStatus();
      } else {
        message(res.detail, { type: "warning" });
      }
    })
    .finally(() => (bindLoading.value = false));
};

const handleDisable = () => {
  handleOperation({
    t,
    apiReq: otpDisableApi(),
    success() {
      loadStatus();
    }
  });
};

onMounted(loadStatus);
</script>

<template>
  <div v-loading="statusLoading">
    <el-form label-width="auto" size="large">
      <el-form-item :label="$t('mfa.otpStatus')">
        <el-tag :type="status.enabled ? 'success' : 'info'">
          {{ status.enabled ? $t("mfa.otpEnabled") : $t("mfa.otpDisabled") }}
        </el-tag>
      </el-form-item>
      <el-form-item v-if="status.enabled" :label="' '">
        <el-alert
          :title="$t('mfa.otpEnabledTip')"
          type="info"
          :closable="false"
          show-icon
          class="w-full!"
        />
      </el-form-item>
      <el-form-item v-else-if="!bindInfo" :label="' '">
        <el-alert
          :title="$t('mfa.otpDisabledTip')"
          type="warning"
          :closable="false"
          show-icon
          class="w-full!"
        />
      </el-form-item>

      <!-- 未绑定：发起绑定 → 扫码 → 输码确认 -->
      <template v-if="!status.enabled">
        <el-form-item v-if="!bindInfo">
          <el-button
            type="primary"
            :loading="bindLoading"
            @click="handleStartBind"
          >
            {{ $t("mfa.startBind") }}
          </el-button>
        </el-form-item>
        <template v-else>
          <el-form-item :label="$t('mfa.scanTip')">
            <div class="flex flex-col items-center gap-2">
              <ReQrcode :text="bindInfo.uri" :width="180" />
              <span class="text-xs text-gray-400">
                {{ $t("mfa.manualEntry") }}：{{ bindInfo.secret }}
              </span>
            </div>
          </el-form-item>
          <el-form-item :label="$t('mfa.code')">
            <el-input
              v-model="code"
              :placeholder="$t('mfa.codePlaceholder')"
              clearable
              @keyup.enter="handleConfirmBind"
            />
          </el-form-item>
          <el-form-item>
            <el-button
              type="primary"
              :loading="bindLoading"
              @click="handleConfirmBind"
            >
              {{ $t("mfa.confirmBind") }}
            </el-button>
            <el-button @click="bindInfo = null">{{
              $t("mfa.cancelBind")
            }}</el-button>
          </el-form-item>
        </template>
      </template>

      <!-- 已绑定：解绑（敏感操作，未验证时走全局验证弹窗） -->
      <el-form-item v-if="status.enabled">
        <el-popconfirm
          :title="$t('mfa.disableConfirmTip')"
          width="260"
          @confirm="handleDisable"
        >
          <template #reference>
            <el-button type="danger" plain>{{
              $t("mfa.disableBind")
            }}</el-button>
          </template>
        </el-popconfirm>
      </el-form-item>
    </el-form>
  </div>
</template>
