<script lang="ts" setup>
import { reactive, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { RecordType } from "plus-pro-components";

/**
 * 登录访问策略编辑表单。
 *
 * 目标对象与动作由前端给选项（后端为 LabeledChoiceField，回显为 {value,label}），
 * `getPayload()` 返回 null 表示校验未通过（父级拦截提交，保持弹窗打开）。
 */
const props = defineProps<{ row?: RecordType }>();
const { t } = useI18n();

const targetTypeOptions = [
  { value: "all", label: t("loginPolicy.targetAll") },
  { value: "role", label: t("loginPolicy.targetRole") },
  { value: "user", label: t("loginPolicy.targetUser") }
];
const actionOptions = [
  { value: "accept", label: t("loginPolicy.actionAccept") },
  { value: "reject", label: t("loginPolicy.actionReject") },
  { value: "require_mfa", label: t("loginPolicy.actionRequireMfa") },
  { value: "record", label: t("loginPolicy.actionRecord") }
];
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
  if (!form.name.trim()) return null;
  // 时段必须成对（后端同口径校验，前端提前拦截避免无谓请求）
  if (Boolean(form.start_time) !== Boolean(form.end_time)) return null;
  if (form.target_type !== "all" && !form.target_value.trim()) return null;
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
