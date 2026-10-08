<script lang="ts" setup>
import { onMounted, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import { loginPolicyApi } from "@/api/system/security";
import { SUCCESS_CODE } from "@/api/types";
import type { RecordType } from "plus-pro-components";

/**
 * 登录访问策略编辑表单。
 *
 * 目标对象与动作的选项单源在后端 choices 端点（挂载时拉取），
 * `getPayload()` 返回 null 表示校验未通过（父级拦截提交，保持弹窗打开）。
 */
const props = defineProps<{ row?: RecordType }>();
const { t } = useI18n();

type OptionItem = { value: string; label: string };

const fallbackTargetTypeOptions: OptionItem[] = [
  { value: "all", label: t("loginPolicy.targetAll") },
  { value: "role", label: t("loginPolicy.targetRole") },
  { value: "user", label: t("loginPolicy.targetUser") }
];
const fallbackActionOptions: OptionItem[] = [
  { value: "accept", label: t("loginPolicy.actionAccept") },
  { value: "reject", label: t("loginPolicy.actionReject") },
  { value: "require_mfa", label: t("loginPolicy.actionRequireMfa") },
  { value: "record", label: t("loginPolicy.actionRecord") }
];
const targetTypeOptions = ref<OptionItem[]>(fallbackTargetTypeOptions);
const actionOptions = ref<OptionItem[]>(fallbackActionOptions);

/** 选项元数据在后端（i18n 清单仅作拉取失败时的兜底，不做双源维护） */
onMounted(async () => {
  try {
    const res = await loginPolicyApi.choices();
    if (res.code !== SUCCESS_CODE || !res.choices_dict) return;
    const { target_type: targetType, action } = res.choices_dict;
    if (Array.isArray(targetType) && targetType.length) {
      targetTypeOptions.value = targetType.map(item => ({
        value: String(item.value),
        label: String(item.label ?? item.value)
      }));
    }
    if (Array.isArray(action) && action.length) {
      actionOptions.value = action.map(item => ({
        value: String(item.value),
        label: String(item.label ?? item.value)
      }));
    }
  } catch {
    // 拉取失败保持前端回落清单（网络级异常由 http 拦截器统一提示）
  }
});

const weekdayOptions = [1, 2, 3, 4, 5, 6, 7].map(value => ({
  value,
  label: t(`loginPolicy.weekday${value}`)
}));

const form = reactive({
  name: "",
  priority: 100,
  is_active: true,
  target_type: "all",
  target_value: "",
  weekdays: [] as number[],
  start_time: "",
  end_time: "",
  ip_ranges: "",
  action: "reject",
  remark: ""
});

const pickScalar = (raw: unknown) => {
  if (raw && typeof raw === "object" && "value" in (raw as RecordType)) {
    return (raw as { value: unknown }).value;
  }
  return raw;
};

watch(
  () => props.row,
  row => {
    if (!row) return;
    form.name = String(row.name ?? "");
    form.priority = Number(row.priority ?? 100);
    form.is_active = row.is_active !== false;
    form.target_type = String(pickScalar(row.target_type) ?? "all");
    form.target_value = String(row.target_value ?? "");
    form.weekdays = Array.isArray(row.weekdays) ? row.weekdays.map(Number) : [];
    form.start_time = row.start_time ? String(row.start_time).slice(0, 8) : "";
    form.end_time = row.end_time ? String(row.end_time).slice(0, 8) : "";
    form.ip_ranges = String(row.ip_ranges ?? "");
    form.action = String(pickScalar(row.action) ?? "reject");
    form.remark = String(row.remark ?? "");
  },
  { immediate: true }
);

function getPayload(): RecordType | null {
  // 三类前置校验各自给出具体原因（父级对 null 不再弹笼统提示）
  if (!form.name.trim()) {
    message(t("loginPolicy.nameRequired"), { type: "warning" });
    return null;
  }
  // 时段必须成对（后端同口径校验，前端提前拦截避免无谓请求）；
  // start_time > end_time 表示跨天窗口（如 22:00-06:00），后端按跨天语义判定
  if (Boolean(form.start_time) !== Boolean(form.end_time)) {
    message(t("loginPolicy.timePairInvalid"), { type: "warning" });
    return null;
  }
  if (form.target_type !== "all" && !form.target_value.trim()) {
    message(t("loginPolicy.targetValueRequired"), { type: "warning" });
    return null;
  }
  return {
    name: form.name.trim(),
    priority: Number(form.priority) || 100,
    is_active: form.is_active,
    target_type: form.target_type,
    target_value: form.target_value.trim(),
    weekdays: form.weekdays,
    start_time: form.start_time || null,
    end_time: form.end_time || null,
    ip_ranges: form.ip_ranges,
    action: form.action,
    remark: form.remark
  };
}

defineExpose({ getPayload });
</script>

<template>
  <el-form label-width="100px" @submit.prevent>
    <el-form-item :label="t('loginPolicy.name')" required>
      <el-input v-model="form.name" maxlength="64" show-word-limit />
    </el-form-item>
    <el-form-item :label="t('loginPolicy.priority')">
      <el-input-number v-model="form.priority" :min="1" :max="9999" />
      <span class="ml-2 text-sm text-(--el-text-color-secondary)">{{
        t("loginPolicy.priorityTip")
      }}</span>
    </el-form-item>
    <el-form-item :label="t('loginPolicy.isActive')">
      <el-switch v-model="form.is_active" />
    </el-form-item>
    <el-form-item :label="t('loginPolicy.targetType')">
      <el-select v-model="form.target_type" class="w-full">
        <el-option
          v-for="item in targetTypeOptions"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </el-select>
    </el-form-item>
    <el-form-item
      v-if="form.target_type !== 'all'"
      :label="t('loginPolicy.targetValue')"
      required
    >
      <el-input
        v-model="form.target_value"
        :placeholder="
          form.target_type === 'role'
            ? t('loginPolicy.rolePlaceholder')
            : t('loginPolicy.userPlaceholder')
        "
      />
    </el-form-item>
    <el-form-item :label="t('loginPolicy.weekdays')">
      <el-select v-model="form.weekdays" multiple collapse-tags class="w-full">
        <el-option
          v-for="item in weekdayOptions"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </el-select>
    </el-form-item>
    <el-form-item :label="t('loginPolicy.timeRange')">
      <el-time-picker
        v-model="form.start_time"
        value-format="HH:mm:ss"
        :placeholder="t('loginPolicy.startTime')"
        class="mr-2"
      />
      <el-time-picker
        v-model="form.end_time"
        value-format="HH:mm:ss"
        :placeholder="t('loginPolicy.endTime')"
      />
    </el-form-item>
    <el-form-item :label="t('loginPolicy.ipRanges')">
      <el-input
        v-model="form.ip_ranges"
        type="textarea"
        :rows="3"
        :placeholder="t('loginPolicy.ipPlaceholder')"
      />
    </el-form-item>
    <el-form-item :label="t('loginPolicy.action')">
      <el-select v-model="form.action" class="w-full">
        <el-option
          v-for="item in actionOptions"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </el-select>
    </el-form-item>
    <el-form-item :label="t('loginPolicy.remark')">
      <el-input v-model="form.remark" maxlength="255" />
    </el-form-item>
  </el-form>
</template>
