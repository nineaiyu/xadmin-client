<script lang="ts" setup>
import { reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { type FormInstance, type FormItemRule } from "element-plus";
import dayjs from "dayjs";
import { loginPolicyApi, type LoginPolicyPreview } from "@/api/system/security";
import { isIPv4, isIPv6 } from "../utils/sampleIp";
import { message } from "@/utils/message";
import { SUCCESS_CODE } from "@/api/types";

/**
 * 登录策略命中预演：给出样例用户 / IP / 时间，逐条策略展示匹配结果与最终判定。
 *
 * 保存前预演可避免「一条 reject 把全员挡在门外」——预演不写库、不依赖当前登录用户。
 * 面板同时回显实际参与判定的样例（用户 / IP / 时间）、逐维度命中明细、
 * 未启用策略（仅展示不判定）与 require_mfa 的降级放行提示。
 */
const { t } = useI18n();

const form = reactive({ username: "", ip: "", when: "" });
const formRef = ref<FormInstance>();
const loading = ref(false);
const result = ref<LoginPolicyPreview | null>(null);

/** 动作裸值 → 可读文案 */
const ACTION_KEYS: Record<string, string> = {
  accept: "loginPolicy.actionAccept",
  reject: "loginPolicy.actionReject",
  require_mfa: "loginPolicy.actionRequireMfa",
  record: "loginPolicy.actionRecord"
};
const actionLabel = (value: string | null) => {
  const key = ACTION_KEYS[String(value ?? "")];
  return key ? t(key) : String(value ?? "-");
};

/** 动作裸值 → 语义化颜色（生效标签随动作着色，accept 命中不再是红色） */
type TagType = "success" | "danger" | "warning" | "info";
const ACTION_TAG_TYPES: Record<string, TagType> = {
  accept: "success",
  reject: "danger",
  require_mfa: "warning",
  record: "info"
};
const actionTagType = (value: string | null): TagType =>
  ACTION_TAG_TYPES[String(value ?? "")] ?? "info";

/** el-alert 的语义色联合与 el-tag 不同（error 而非 danger），分开映射 */
type AlertType = "success" | "error" | "warning" | "info";
const ACTION_ALERT_TYPES: Record<string, AlertType> = {
  accept: "success",
  reject: "error",
  require_mfa: "warning",
  record: "info"
};
const actionAlertType = (value: string | null): AlertType =>
  ACTION_ALERT_TYPES[String(value ?? "")] ?? "info";

/** 逐维度命中明细（对象 / 时段 / 网段），定位「为什么没生效」。
 *  行类型收窄为 unknown 记录：el-table 插槽行的组件类型不可直接赋给接口 */
const dimList = (row: Record<string, unknown>) => [
  {
    key: "target",
    ok: row.target_matched === true,
    label: t("loginPolicy.dimTarget")
  },
  {
    key: "time",
    ok: row.time_matched === true,
    label: t("loginPolicy.dimTime")
  },
  { key: "ip", ok: row.ip_matched === true, label: t("loginPolicy.dimIp") }
];

/** 样例 IP 严格校验（口径见 utils/sampleIp.ts，与后端 ipaddress 解析对齐） */
const validateIp = (
  _rule: unknown,
  value: string,
  callback: (_error?: Error) => void
) => {
  if (!value) return callback();
  if (isIPv4(value) || isIPv6(value)) return callback();
  return callback(new Error(t("loginPolicy.invalidIp")));
};

const rules: Record<string, FormItemRule[]> = {
  ip: [{ validator: validateIp, trigger: "blur" }]
};

const runPreview = async () => {
  const valid = await formRef.value
    ?.validate()
    .then(() => true)
    .catch(() => false);
  if (!valid) return;
  loading.value = true;
  try {
    const res = await loginPolicyApi.preview({
      username: form.username || undefined,
      ip: form.ip || undefined,
      when: form.when || undefined
    });
    if (res.code === SUCCESS_CODE) {
      result.value = res.data;
    } else {
      message(String(res.detail), { type: "error" });
    }
  } catch (error: unknown) {
    message(String((error as Error)?.message ?? error), { type: "error" });
  } finally {
    loading.value = false;
  }
};

/** 回显实际参与判定的样例：静默回退已移除，但展示实值可防「看错对象」 */
const echoLine = (data: LoginPolicyPreview) =>
  t("loginPolicy.previewEcho", {
    username: data.username ?? "-",
    ip: data.ip ?? "-",
    when: data.when ? dayjs(data.when).format("YYYY-MM-DD HH:mm:ss") : "-"
  });
</script>

<template>
  <div>
    <el-form
      ref="formRef"
      :inline="true"
      :model="form"
      :rules="rules"
      @submit.prevent="runPreview"
    >
      <el-form-item :label="t('loginPolicy.previewUser')">
        <el-input
          v-model="form.username"
          :placeholder="t('loginPolicy.previewUserTip')"
          clearable
          @keyup.enter="runPreview"
        />
      </el-form-item>
      <el-form-item :label="t('loginPolicy.previewIp')" prop="ip">
        <el-input
          v-model="form.ip"
          :placeholder="t('loginPolicy.previewIpTip')"
          clearable
          @keyup.enter="runPreview"
        />
      </el-form-item>
      <el-form-item :label="t('loginPolicy.previewWhen')">
        <el-date-picker
          v-model="form.when"
          type="datetime"
          :placeholder="t('loginPolicy.previewWhenTip')"
          value-format="YYYY-MM-DD HH:mm:ss"
          clearable
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="loading" @click="runPreview">
          {{ t("loginPolicy.previewRun") }}
        </el-button>
      </el-form-item>
    </el-form>

    <template v-if="result">
      <el-alert
        class="mb-2"
        :closable="false"
        show-icon
        :type="actionAlertType(result.action)"
        :title="
          result.matched
            ? t('loginPolicy.previewResult', {
                action: actionLabel(result.action),
                policy: result.policy
              })
            : t('loginPolicy.previewNoMatch')
        "
      />
      <!-- require_mfa 与真实登录的已知分叉：无可用二次验证方式时实际会降级放行 -->
      <el-alert
        v-if="result.action === 'require_mfa' && result.mfa_usable === false"
        class="mb-2"
        :closable="false"
        show-icon
        type="warning"
        :title="t('loginPolicy.previewMfaDegraded')"
      />
      <div class="mb-2 text-sm" style="color: var(--el-text-color-secondary)">
        {{ echoLine(result) }}
      </div>

      <el-table
        :data="result.items"
        border
        size="small"
        :row-class-name="
          ({ row }) => (row.is_active === false ? 'preview-inactive-row' : '')
        "
      >
        <el-table-column
          prop="priority"
          :label="t('loginPolicy.priority')"
          width="80"
        />
        <el-table-column
          prop="name"
          :label="t('loginPolicy.name')"
          min-width="140"
        >
          <template #default="{ row }">
            <span>{{ row.name }}</span>
            <el-tag
              v-if="row.is_active === false"
              class="ml-1"
              size="small"
              type="info"
              effect="plain"
            >
              {{ t("loginPolicy.inactive") }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('loginPolicy.action')" width="160">
          <template #default="{ row }">{{ actionLabel(row.action) }}</template>
        </el-table-column>
        <el-table-column :label="t('loginPolicy.previewMatched')" width="90">
          <template #default="{ row }">
            <el-tag :type="row.matched ? 'success' : 'info'" effect="light">
              {{ row.matched ? t("labels.yes") : t("labels.no") }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('loginPolicy.previewDims')" min-width="180">
          <template #default="{ row }">
            <el-tag
              v-for="dim in dimList(row)"
              :key="dim.key"
              class="mr-1"
              size="small"
              effect="plain"
              :type="dim.ok ? 'success' : 'info'"
            >
              {{ dim.label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('loginPolicy.previewEffective')" width="100">
          <template #default="{ row }">
            <el-tag
              v-if="row.effective"
              :type="actionTagType(row.action)"
              effect="dark"
            >
              {{ t("loginPolicy.effective") }}
            </el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </div>
</template>

<style lang="scss" scoped>
/* 未启用策略整行弱化：仅列出供评估，不参与判定 */
:deep(.preview-inactive-row td.el-table__cell) {
  color: var(--el-text-color-secondary);
}
</style>
