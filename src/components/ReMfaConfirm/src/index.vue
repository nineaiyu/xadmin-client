<script lang="ts" setup>
/**
 * 全局身份二次验证对话框（命令式服务，见 index.ts confirmMfa）。
 * 敏感接口返回 412（type=user_confirm_required）时由 http 层唤起，
 * 验证成功后 http 层自动重发原请求。
 */
import { SUCCESS_CODE } from "@/api/types";
import { passkeyApi } from "@/api/system/security";
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import ReEmpty from "@/components/ReEmpty";
import { message } from "@/utils/message";
import {
  b64urlToBuffer,
  bufferToB64url,
  isPasskeySupported
} from "@/utils/webauthn";
import {
  mfaConfirmApi,
  mfaConfirmInfoApi,
  mfaSendCodeApi,
  type MfaMethod
} from "@/api/mfa";

defineOptions({ name: "ReMfaConfirm" });

const props = defineProps<{
  /** 验证类型：mfa / password */
  confirmType?: string;
  /** 验证成功回调（expire_at 为确认到期时间戳） */
  resolve: (_result: { expire_at: number | null }) => void;
  /** 取消回调 */
  reject: () => void;
  /** 弹窗销毁回调（动画结束后由包装层卸载组件） */
  destroy: () => void;
}>();

const { t } = useI18n();

const visible = ref(true);
const loading = ref(false);
const infoLoading = ref(false);
const methods = ref<MfaMethod[]>([]);
const currentMethod = ref<string>("");
const formData = reactive({ code: "" });
const formRef = ref();
const sendCooldown = ref(0);
let cooldownTimer: ReturnType<typeof setInterval> | null = null;

const activeMethod = computed(() =>
  methods.value.find(item => item.name === currentMethod.value)
);

/** Passkey 方式：无验证码输入，走浏览器断言（challenge → credentials.get） */
const isPasskeyMethod = computed(() => currentMethod.value === "passkey");

const rules = {
  code: [
    {
      required: true,
      message: () => t("mfa.codeRequired"),
      trigger: "blur"
    }
  ]
};

const loadMethods = () => {
  infoLoading.value = true;
  mfaConfirmInfoApi({ confirm_type: props.confirmType ?? "mfa" })
    .then(res => {
      if (res.code === SUCCESS_CODE) {
        methods.value = res.data.methods;
        currentMethod.value = res.data.methods[0]?.name ?? "";
      }
    })
    .finally(() => (infoLoading.value = false));
};

const startCooldown = (seconds: number) => {
  sendCooldown.value = seconds;
  if (cooldownTimer) clearInterval(cooldownTimer);
  cooldownTimer = setInterval(() => {
    sendCooldown.value -= 1;
    if (sendCooldown.value <= 0) {
      clearInterval(cooldownTimer!);
      cooldownTimer = null;
    }
  }, 1000);
};

const handleSendCode = () => {
  if (!currentMethod.value) return;
  mfaSendCodeApi({ method: currentMethod.value }).then(res => {
    if (res.code === SUCCESS_CODE) {
      message(res.detail || t("mfa.codeSent"), { type: "success" });
      startCooldown(60);
    } else {
      message(res.detail, { type: "warning" });
    }
  });
};

const handleCancel = () => {
  visible.value = false;
  props.reject();
};

const handleConfirm = () => {
  formRef.value?.validate((isValid: boolean) => {
    if (!isValid) return;
    loading.value = true;
    mfaConfirmApi({
      confirm_type: props.confirmType ?? "mfa",
      method: currentMethod.value,
      code: formData.code
    })
      .then(res => {
        if (res.code === SUCCESS_CODE) {
          message(res.detail || t("mfa.verifySuccess"), { type: "success" });
          visible.value = false;
          props.resolve({ expire_at: res.data?.expire_at ?? null });
        } else {
          message(res.detail, { type: "warning" });
        }
      })
      .finally(() => (loading.value = false));
  });
};

/** Passkey 确认：取挑战 → 浏览器断言 → 断言 JSON 作为 code 提交（与登录 MFA 同链路） */
const handlePasskeyConfirm = async () => {
  if (!isPasskeySupported()) {
    message(t("passkey.unsupported"), { type: "warning" });
    return;
  }
  loading.value = true;
  try {
    const challengeRes = await passkeyApi.challenge("authenticate");
    if (challengeRes.code !== SUCCESS_CODE) {
      message(challengeRes.detail, { type: "warning" });
      return;
    }
    const { challenge, rp_id } = challengeRes.data;
    const credential = (await navigator.credentials.get({
      publicKey: {
        challenge: b64urlToBuffer(challenge),
        rpId: rp_id,
        timeout: 60000,
        userVerification: "preferred"
      }
    })) as PublicKeyCredential | null;
    if (!credential) {
      message(t("passkey.failed"), { type: "warning" });
      return;
    }
    const response = credential.response as AuthenticatorAssertionResponse;
    const payload = {
      credential_id: credential.id,
      client_data_json: bufferToB64url(response.clientDataJSON),
      authenticator_data: bufferToB64url(response.authenticatorData),
      signature: bufferToB64url(response.signature)
    };
    const res = await mfaConfirmApi({
      confirm_type: props.confirmType ?? "mfa",
      method: "passkey",
      code: JSON.stringify(payload)
    });
    if (res.code === SUCCESS_CODE) {
      message(res.detail || t("mfa.verifySuccess"), { type: "success" });
      visible.value = false;
      props.resolve({ expire_at: res.data?.expire_at ?? null });
    } else {
      message(res.detail, { type: "warning" });
    }
  } catch {
    // 用户取消系统弹窗或验证失败：停留弹窗可重试
  } finally {
    loading.value = false;
  }
};

const handleVerify = () => {
  if (isPasskeyMethod.value) {
    handlePasskeyConfirm();
    return;
  }
  handleConfirm();
};

onMounted(loadMethods);
onBeforeUnmount(() => {
  if (cooldownTimer) clearInterval(cooldownTimer);
});

const emit = defineEmits<{ destroy: [] }>();
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="$t('mfa.confirmTitle')"
    width="440px"
    append-to-body
    destroy-on-close
    :close-on-click-modal="false"
    @close="handleCancel"
    @closed="emit('destroy')"
  >
    <div v-loading="infoLoading">
      <el-alert
        :title="$t('mfa.confirmTip')"
        type="warning"
        :closable="false"
        show-icon
        class="mb-4!"
      />
      <el-form
        v-if="methods.length"
        ref="formRef"
        :rules="rules"
        :model="formData"
      >
        <el-form-item :label="$t('mfa.method')">
          <el-radio-group v-model="currentMethod">
            <el-radio
              v-for="item in methods"
              :key="item.name"
              :value="item.name"
            >
              {{ item.display_name }}
            </el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="activeMethod?.challenge_required">
          <el-button
            type="primary"
            link
            :disabled="sendCooldown > 0"
            @click="handleSendCode"
          >
            {{
              sendCooldown > 0
                ? $t("mfa.resendAfter", { seconds: sendCooldown })
                : $t("mfa.sendCode")
            }}
          </el-button>
        </el-form-item>
        <el-form-item v-if="isPasskeyMethod">
          <el-alert
            :title="$t('passkey.loginTip')"
            type="info"
            :closable="false"
            show-icon
          />
        </el-form-item>
        <el-form-item v-else :label="$t('mfa.code')" prop="code">
          <el-input
            v-model="formData.code"
            :placeholder="
              activeMethod?.placeholder ?? $t('mfa.codePlaceholder')
            "
            clearable
            @keyup.enter="handleVerify"
          />
        </el-form-item>
      </el-form>
      <ReEmpty
        v-else-if="!infoLoading"
        :description="$t('mfa.noAvailableMethod')"
        size="small"
      />
    </div>
    <template #footer>
      <el-button @click="handleCancel">{{ $t("mfa.cancel") }}</el-button>
      <el-button
        type="primary"
        :loading="loading"
        :disabled="!methods.length"
        @click="handleVerify"
      >
        {{ $t("mfa.verify") }}
      </el-button>
    </template>
  </el-dialog>
</template>
