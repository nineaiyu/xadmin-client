<script lang="ts" setup>
/**
 * 全局身份二次验证对话框（命令式服务，见 index.ts confirmMfa）。
 * 敏感接口返回 412（type=user_confirm_required）时由 http 层唤起，
 * 验证成功后 http 层自动重发原请求。
 * 验证交互（方式选择 / 发码冷却 / 动态码与 Passkey 提交）与登录 MFA
 * 共用 `useMfaVerify`，本组件只保留对话框布局与表单校验。
 */
import { SUCCESS_CODE } from "@/api/types";
import { passkeyApi } from "@/api/system/security";
import { onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import ReEmpty from "@/components/ReEmpty";
import { message } from "@/utils/message";
import { useMfaVerify } from "@/hooks/useMfaVerify";
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
const infoLoading = ref(false);
const methods = ref<MfaMethod[]>([]);
const formRef = ref();

const {
  loading,
  code,
  currentMethod,
  activeMethod,
  isPasskey: isPasskeyMethod,
  sendCooldown,
  handleSendCode,
  submitCode,
  submitPasskey
} = useMfaVerify({
  methods,
  sendCode: method => mfaSendCodeApi({ method }),
  verify: (method, value) =>
    mfaConfirmApi({
      confirm_type: props.confirmType ?? "mfa",
      method,
      code: value
    }),
  passkeyChallenge: () => passkeyApi.challenge("authenticate"),
  onSuccess: res => {
    message(res.detail || t("mfa.verifySuccess"), { type: "success" });
    visible.value = false;
    props.resolve({ expire_at: res.data?.expire_at ?? null });
  }
});

// el-form 校验契约：model 持 code（reactive 对 ref 属性自动解包），
// rules 的 prop="code" 与提交读取同一份值
const formData = reactive({ code });

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
      }
    })
    .finally(() => (infoLoading.value = false));
};

const handleCancel = () => {
  visible.value = false;
  props.reject();
};

const handleVerify = () => {
  // Passkey 走浏览器断言（无表单字段）；其余先过表单校验再提交动态码
  if (isPasskeyMethod.value) {
    submitPasskey();
    return;
  }
  formRef.value?.validate((isValid: boolean) => {
    if (!isValid) return;
    submitCode();
  });
};

onMounted(loadMethods);

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
