<script lang="ts" setup>
import { computed, reactive } from "vue";
import { useI18n } from "vue-i18n";
import type { AccountRiskHandleAction } from "@/api/system/security";

/**
 * 账号风险处置表单：选择处置动作 + 备注。
 *
 * 提交契约 `getPayload()`：返回 `{ action, remark }`；返回 `null` 表示校验未过（保持弹窗）。
 * 单行「处置」与工具栏「批量处置」共用本组件（载荷一致，仅弹窗标题不同）。
 */
const { t } = useI18n();

/** 动作清单：值为服务端枚举，展示用 i18n 文案（不依赖后端下发的英文 label） */
const ACTION_KEYS: Array<{ value: AccountRiskHandleAction; key: string }> = [
  { value: "notify", key: "accountRisk.actionNotify" },
  { value: "force_change_password", key: "accountRisk.actionForcePassword" },
  { value: "force_logout", key: "accountRisk.actionForceLogout" },
  { value: "disable", key: "accountRisk.actionDisable" },
  { value: "ignore", key: "accountRisk.actionIgnore" },
  { value: "resolve", key: "accountRisk.actionResolve" }
];
const actionOptions = computed(() =>
  ACTION_KEYS.map(item => ({ value: item.value, label: t(item.key) }))
);

const form = reactive<{ action: AccountRiskHandleAction; remark: string }>({
  action: "notify",
  remark: ""
});

const getPayload = () => ({
  action: form.action,
  remark: form.remark.trim()
});

defineExpose({ getPayload });
</script>

<template>
  <el-form :model="form" label-width="90px">
    <el-form-item :label="t('accountRisk.action')" required>
      <el-select v-model="form.action" class="w-full">
        <el-option
          v-for="item in actionOptions"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </el-select>
    </el-form-item>
    <el-form-item :label="t('accountRisk.remark')">
      <el-input
        v-model="form.remark"
        type="textarea"
        :rows="3"
        :maxlength="200"
        show-word-limit
      />
    </el-form-item>
  </el-form>
</template>
