<script lang="ts" setup>
import { reactive } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "@/utils/message";

/**
 * 驳回表单：原因必填（驳回即终止申请）。
 *
 * ReDialog 只回调 `beforeSure`、不触发表单校验，必填在此显式收口：
 * `getPayload()` 返回 `null` 时由调用方保持弹窗（并复位按钮 loading）。
 * 单行「驳回」与工具栏「批量驳回」共用本组件。
 */
const { t } = useI18n();
const form = reactive({ reason: "" });

const getPayload = () => {
  const reason = form.reason.trim();
  if (!reason) {
    message(t("systemApprovalInstance.rejectReasonRequired"), {
      type: "error"
    });
    return null;
  }
  return { reason };
};

defineExpose({ getPayload });
</script>

<template>
  <el-form :model="form">
    <el-form-item prop="reason">
      <el-input
        v-model="form.reason"
        type="textarea"
        :rows="3"
        :maxlength="200"
        show-word-limit
        :placeholder="t('systemApprovalInstance.reasonPlaceholder')"
      />
    </el-form-item>
  </el-form>
</template>
