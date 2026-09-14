<script lang="ts" setup>
import { reactive } from "vue";
import { useI18n } from "vue-i18n";
import { choiceValue } from "@/utils/dict";
import { message } from "@/utils/message";
import type { ScreenItem } from "@/api/system/analysis";

/**
 * 数据大屏表单（C5：弹窗体系收敛到 ReDialog 的 content 组件形态）。
 *
 * 组件负责「表单数据 + 载荷生成」，提交与列表刷新由页面在 `beforeSure` 中处理。
 */
defineOptions({ name: "AnalysisScreenForm" });

const props = defineProps<{
  /** 编辑时的原始行（null / 缺省 = 新建） */
  row?: ScreenItem | null;
  /** 可选仪表盘（由页面加载后传入，供序列多选） */
  dashboards: { pk: string; name: string }[];
}>();

const { t } = useI18n();

const form = reactive({
  name: props.row?.name ?? "",
  dashboards: [...(props.row?.dashboards ?? [])],
  interval: props.row?.interval ?? 15,
  refresh: props.row?.refresh ?? 60,
  // visibility 序列化为 {value,label} 对象，radio 只接受标量（归一化取 value）
  visibility: (props.row ? choiceValue(props.row.visibility) : "shared") as
    "personal" | "shared"
});

/** 校验并生成提交载荷；校验失败返回 null（调用方保持弹窗打开） */
const getPayload = (): Record<string, unknown> | null => {
  if (!form.name || form.dashboards.length === 0) {
    message(t("dataScreen.required"), { type: "warning" });
    return null;
  }
  return { ...form };
};

defineExpose({ getPayload });
</script>

<template>
  <el-form label-width="100px">
    <el-form-item :label="t('dataScreen.name')" required>
      <el-input v-model="form.name" />
    </el-form-item>
    <el-form-item :label="t('dataScreen.dashboards')" required>
      <el-select v-model="form.dashboards" class="w-full" multiple filterable>
        <el-option
          v-for="item in dashboards"
          :key="item.pk"
          :value="item.pk"
          :label="item.name"
        />
      </el-select>
    </el-form-item>
    <el-form-item :label="t('dataScreen.interval')">
      <el-input-number v-model="form.interval" :min="5" :max="3600" />
    </el-form-item>
    <el-form-item :label="t('dataScreen.refresh')">
      <el-input-number v-model="form.refresh" :min="10" :max="3600" />
    </el-form-item>
    <el-form-item :label="t('dataScreen.visibilityLabel')">
      <el-radio-group v-model="form.visibility">
        <el-radio value="personal">{{ t("dataScreen.personal") }}</el-radio>
        <el-radio value="shared">{{ t("dataScreen.shared") }}</el-radio>
      </el-radio-group>
    </el-form-item>
  </el-form>
</template>
