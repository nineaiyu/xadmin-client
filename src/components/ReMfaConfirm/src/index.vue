<script lang="ts" setup>
/**
 * 全局身份二次验证对话框（命令式服务，见 index.ts confirmMfa）。
 * 敏感接口返回 412（type=user_confirm_required）时由 http 层唤起，
 * 验证成功后 http 层自动重发原请求。
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
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
      if (res.code === 1000) {
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
    if (res.code === 1000) {
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
        if (res.code === 1000) {
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
        <el-form-item :label="$t('mfa.code')" prop="code">
          <el-input
            v-model="formData.code"
            :placeholder="
              activeMethod?.placeholder ?? $t('mfa.codePlaceholder')
            "
            clearable
            @keyup.enter="handleConfirm"
          />
        </el-form-item>
      </el-form>
      <el-empty
        v-else-if="!infoLoading"
        :description="$t('mfa.noAvailableMethod')"
        :image-size="80"
      />
    </div>
    <template #footer>
      <el-button @click="handleCancel">{{ $t("mfa.cancel") }}</el-button>
      <el-button
        type="primary"
        :loading="loading"
        :disabled="!methods.length"
        @click="handleConfirm"
      >
        {{ $t("mfa.verify") }}
      </el-button>
    </template>
  </el-dialog>
</template>
