<script lang="ts" setup>
/**
 * 个人 MFA 安全管理：OTP(TOTP) 绑定 / 开关 / 解绑。
 * - 关闭：仅停用登录二次验证开关，密钥保留，重新开启时校验一次动态码即可（无需重新扫码）；
 *   关闭为敏感操作：未二次验证时后端返回 412，由 http 层全局验证弹窗接管后自动重发。
 * - 解绑：清除密钥，重新开启需重新扫码；同为敏感操作。
 * 排版对齐同页「基本资料 / 修改密码」tab：固定 label-width 的普通 el-form，
 * 操作按钮置于无 label 的尾部 form-item（与保存按钮列对齐）。
 */
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import { handleOperation } from "@/components/RePlusPage";
import { ReQrcode } from "@/components/ReQrcode";
import {
  otpCloseApi,
  otpConfirmApi,
  otpDisableApi,
  otpOpenApi,
  otpStartApi,
  otpStatusApi,
  otpTestApi,
  type OtpStartResult,
  type OtpStatus
} from "@/api/mfa";

defineOptions({
  name: "EditUserMfa"
});

const { t } = useI18n();

const statusLoading = ref(true);
const status = ref<OtpStatus>({
  enabled: false,
  bound: false,
  phone: "",
  email: ""
});
/** 绑定流程中：非空显示二维码确认步骤 */
const bindInfo = ref<OtpStartResult["data"] | null>(null);
const bindLoading = ref(false);
/** 已绑定状态下的动态码输入：校验自检（两种状态）与重新开启（关闭状态）共用 */
const verifyCode = ref("");
const openLoading = ref(false);
const testLoading = ref(false);
const code = ref("");

const statusText = () => {
  if (status.value.enabled) return t("mfa.otpEnabled");
  return status.value.bound ? t("mfa.otpClosed") : t("mfa.otpDisabled");
};

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

const handleClose = () => {
  handleOperation({
    t,
    apiReq: otpCloseApi(),
    success() {
      loadStatus();
    }
  });
};

const handleOpen = () => {
  if (!verifyCode.value) {
    message(t("mfa.codeRequired"), { type: "warning" });
    return;
  }
  openLoading.value = true;
  otpOpenApi({ code: verifyCode.value })
    .then(res => {
      if (res.code === 1000) {
        message(res.detail || t("mfa.otpEnabled"), { type: "success" });
        verifyCode.value = "";
        loadStatus();
      } else {
        message(res.detail, { type: "warning" });
      }
    })
    .finally(() => (openLoading.value = false));
};

const handleTest = () => {
  if (!verifyCode.value) {
    message(t("mfa.codeRequired"), { type: "warning" });
    return;
  }
  testLoading.value = true;
  otpTestApi({ code: verifyCode.value })
    .then(res => {
      if (res.code === 1000) {
        message(res.detail || t("mfa.testSuccess"), { type: "success" });
      } else {
        message(res.detail, { type: "warning" });
      }
    })
    .finally(() => (testLoading.value = false));
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
    <el-form label-width="110px">
      <el-form-item :label="$t('mfa.otpStatus')">
        <div class="w-full">
          <el-tag :type="status.enabled ? 'success' : 'info'">
            {{ statusText() }}
          </el-tag>
          <el-alert
            :title="
              status.enabled
                ? $t('mfa.otpEnabledTip')
                : status.bound
                  ? $t('mfa.otpClosedTip')
                  : $t('mfa.otpDisabledTip')
            "
            :type="status.enabled ? 'info' : 'warning'"
            :closable="false"
            show-icon
            class="mt-2! w-full!"
          />
        </div>
      </el-form-item>

      <!-- 未绑定：发起绑定 → 扫码 → 输码确认 -->
      <template v-if="!status.bound">
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
            <div class="flex flex-col gap-1">
              <ReQrcode :text="bindInfo.uri" :width="160" />
              <span class="text-xs text-gray-400">
                {{ $t("mfa.manualEntry") }}：{{ bindInfo.secret }}
              </span>
            </div>
          </el-form-item>
          <el-form-item :label="$t('mfa.code')">
            <el-input
              v-model="code"
              class="w-55!"
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

      <!-- 已绑定且开启：动态码可校验自检 / 关闭开关（保留密钥）/ 解绑（清除密钥），
           关闭与解绑均为敏感操作走全局验证弹窗 -->
      <template v-else-if="status.enabled">
        <el-form-item :label="$t('mfa.code')">
          <el-input
            v-model="verifyCode"
            class="w-55!"
            :placeholder="$t('mfa.codePlaceholder')"
            clearable
            @keyup.enter="handleTest"
          />
        </el-form-item>
        <el-form-item>
          <el-button :loading="testLoading" @click="handleTest">{{
            $t("mfa.testKey")
          }}</el-button>
          <el-popconfirm
            :title="$t('mfa.closeConfirmTip')"
            width="260"
            @confirm="handleClose"
          >
            <template #reference>
              <el-button type="warning" plain>{{
                $t("mfa.closeMfa")
              }}</el-button>
            </template>
          </el-popconfirm>
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
      </template>

      <!-- 已绑定但开关关闭：动态码可校验自检 / 重新开启（无需重新扫码）/ 解绑 -->
      <template v-else>
        <el-form-item :label="$t('mfa.code')">
          <el-input
            v-model="verifyCode"
            class="w-55!"
            :placeholder="$t('mfa.codePlaceholder')"
            clearable
            @keyup.enter="handleOpen"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="openLoading" @click="handleOpen">
            {{ $t("mfa.openMfa") }}
          </el-button>
          <el-button :loading="testLoading" @click="handleTest">{{
            $t("mfa.testKey")
          }}</el-button>
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
      </template>
    </el-form>
  </div>
</template>
