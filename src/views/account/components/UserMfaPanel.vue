<script lang="ts" setup>
/**
 * 个人 MFA 安全管理：OTP(TOTP) 绑定 / 开关 / 解绑 / 恢复码。
 * - 关闭：仅停用登录二次验证开关，密钥保留，重新开启时校验一次动态码即可（无需重新扫码）；
 *   关闭为敏感操作：未二次验证时后端返回 412，由 http 层全局验证弹窗接管后自动重发。
 * - 解绑：清除密钥（恢复码一并作废），重新开启需重新扫码；同为敏感操作。
 * - 恢复码：绑定确认成功时一次性展示；已绑定态可查剩余数量并重新生成（敏感操作）。
 * 排版对齐同页「基本资料 / 修改密码」tab：固定 label-width 的普通 el-form，
 * 操作按钮置于无 label 的尾部 form-item（与保存按钮列对齐）。
 */
import { SUCCESS_CODE } from "@/api/types";
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import { handleOperation } from "@/components/RePlusPage";
import { ReQrcode } from "./ReQrcode";
import {
  otpCloseApi,
  otpConfirmApi,
  otpDisableApi,
  otpOpenApi,
  otpStartApi,
  otpStatusApi,
  otpTestApi,
  recoveryCodesRegenerateApi,
  recoveryCodesStatusApi,
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
/** 恢复码：剩余数量（null = 未加载）与一次性展示弹窗 */
const recoveryRemaining = ref<number | null>(null);
const recoveryCodes = ref<string[]>([]);
const recoveryDialogVisible = ref(false);
const regenerateLoading = ref(false);

const recoveryRemainText = computed(() =>
  recoveryRemaining.value === null ? "-" : String(recoveryRemaining.value)
);

const statusText = () => {
  if (status.value.enabled) return t("mfa.otpEnabled");
  return status.value.bound ? t("mfa.otpClosed") : t("mfa.otpDisabled");
};

const loadRecoveryRemaining = () => {
  recoveryCodesStatusApi()
    .then(res => {
      if (res.code === SUCCESS_CODE) {
        recoveryRemaining.value = res.data.remaining;
      }
    })
    .catch(() => {});
};

const loadStatus = () => {
  statusLoading.value = true;
  otpStatusApi()
    .then(res => {
      if (res.code === SUCCESS_CODE) {
        status.value = res.data;
        if (res.data.bound) loadRecoveryRemaining();
      }
    })
    .finally(() => (statusLoading.value = false));
};

const showRecoveryCodes = (codes: string[]) => {
  recoveryCodes.value = codes;
  recoveryDialogVisible.value = true;
};

const handleStartBind = () => {
  bindLoading.value = true;
  otpStartApi()
    .then(res => {
      if (res.code === SUCCESS_CODE) {
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
      if (res.code === SUCCESS_CODE) {
        message(res.detail || t("mfa.bindSuccess"), { type: "success" });
        bindInfo.value = null;
        code.value = "";
        loadStatus();
        if (res.data?.recovery_codes?.length) {
          showRecoveryCodes(res.data.recovery_codes);
        }
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
      if (res.code === SUCCESS_CODE) {
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
      if (res.code === SUCCESS_CODE) {
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

const handleRegenerate = () => {
  regenerateLoading.value = true;
  handleOperation({
    t,
    apiReq: recoveryCodesRegenerateApi(),
    success: res => {
      loadRecoveryRemaining();
      if (res?.data?.recovery_codes?.length) {
        showRecoveryCodes(res.data.recovery_codes);
      }
    },
    requestEnd() {
      regenerateLoading.value = false;
    }
  });
};

const handleCopyCodes = async () => {
  await navigator.clipboard.writeText(recoveryCodes.value.join("\n"));
  message(t("mfa.recoveryCopied"), { type: "success" });
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

      <!-- 恢复码：已绑定即可查看剩余数量并重新生成（重新生成为敏感操作走全局验证弹窗） -->
      <el-form-item v-if="status.bound" :label="$t('mfa.recoveryRemaining')">
        <div class="flex w-full items-center gap-2">
          <el-tag type="info">{{ recoveryRemainText }}</el-tag>
          <el-button
            size="small"
            :loading="regenerateLoading"
            @click="handleRegenerate"
          >
            {{ $t("mfa.recoveryRegenerate") }}
          </el-button>
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
              <span class="text-xs text-(--el-text-color-secondary)">
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

    <el-dialog
      v-model="recoveryDialogVisible"
      :title="$t('mfa.recoveryTitle')"
      width="460px"
      append-to-body
      :close-on-click-modal="false"
    >
      <el-alert
        :title="$t('mfa.recoveryTip')"
        type="warning"
        :closable="false"
        show-icon
        class="mb-3!"
      />
      <div class="grid grid-cols-2 gap-2 font-mono">
        <span
          v-for="item in recoveryCodes"
          :key="item"
          class="rounded border border-(--el-border-color-lighter) px-2 py-1 text-center text-sm"
        >
          {{ item }}
        </span>
      </div>
      <template #footer>
        <el-button @click="handleCopyCodes">{{
          $t("mfa.recoveryCopyAll")
        }}</el-button>
        <el-button type="primary" @click="recoveryDialogVisible = false">{{
          $t("mfa.recoverySaved")
        }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>
