<script lang="ts" setup>
import { reactive } from "vue";
import { useI18n } from "vue-i18n";
import { choiceValue } from "@/utils/dict";
import { message } from "@/utils/message";
import type { DashboardItem } from "@/api/system/datasets";

/**
 * 仪表盘表单（C5：弹窗体系收敛到 ReDialog 的 content 组件形态）。
 *
 * 新建（row 缺省）与设置（row 非空：重命名 / 可见性）双模式，载荷同构。
 */
defineOptions({ name: "DashboardCreateForm" });

const props = defineProps<{
  /** 编辑既有仪表盘（设置弹窗）：预填名称与可见性 */
  row?: DashboardItem | null;
}>();

const { t } = useI18n();

const form = reactive({
  name: props.row?.name ?? "",
  // visibility 序列化为 {value,label} 对象，radio 只接受标量（归一化取 value）
  visibility: (props.row ? choiceValue(props.row.visibility) : "personal") as
    "personal" | "shared"
});

/** 校验并生成提交载荷；校验失败返回 null（调用方保持弹窗打开并给出提示） */
const getPayload = (): {
  name: string;
  visibility: "personal" | "shared";
} | null => {
  if (!form.name) {
    message(t("dashboard.dashName"), { type: "warning" });
    return null;
  }
  return { ...form };
};

defineExpose({ getPayload });
</script>

<template>
  <el-form label-width="90px">
    <el-form-item :label="t('dashboard.dashName')">
      <el-input v-model="form.name" />
    </el-form-item>
    <el-form-item :label="t('dashboard.visibility')">
      <el-radio-group v-model="form.visibility">
        <el-radio value="personal">{{ t("dashboard.personal") }}</el-radio>
        <el-radio value="shared">{{ t("dashboard.shared") }}</el-radio>
      </el-radio-group>
    </el-form-item>
  </el-form>
</template>
