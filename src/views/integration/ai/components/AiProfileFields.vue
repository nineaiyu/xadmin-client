<script lang="ts" setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { PlusForm } from "plus-pro-components";
import type { PlusColumn, RecordType } from "plus-pro-components";
import { useBaseColumns } from "@/components/RePlusPage";
import type { PageColumn } from "@/components/RePlusPage";
import {
  measureRenderedLabelWidth,
  resolveAdaptiveLabelWidth
} from "@/components/RePlusPage/src/utils/adaptiveLabelWidth";
import type { AiProfileItem } from "@/api/ai/ai";
import { aiProfileApi } from "@/api/ai/ai";
import {
  buildAiProfilePayload,
  createAiProfileForm,
  type AiProfileFormModel,
  type AiProfilePurpose
} from "../utils/aiProfileForm";
import { message } from "@/utils/message";

/**
 * AI 档案表单（框架列驱动形态）：与「添加用户」同源——表单由后端
 * search-columns 元数据经 `useBaseColumns` 转换为 PlusForm 列，
 * label 置右 + 固定宽度右对齐、两列排布；字段 help_text 自动渲染为
 * label 旁问号（tooltip），无需页面手写提示。
 *
 * 保留的原定制（随表单模型收敛在此，不散落模板）：
 * - 新建必填 api_key、编辑留空沿用原密钥（后端语义 payload 不带上）；
 * - 采样 / 行为参数未配置（null）回退推荐默认值；
 * - embedding 用途隐藏采样组与 persona / context_limit。
 */
defineOptions({ name: "AiProfileFields" });

const props = defineProps<{
  /** 编辑时的原始行（undefined = 新建） */
  row?: AiProfileItem;
}>();

const { t } = useI18n();
const isEdit = computed(() => Boolean(props.row));

const { getColumnData } = useBaseColumns("aiConfig");

// 表单数据以 RecordType 承载（框架表单 v-model 口径；与 SettingItem 一致），
// 模型侧读写统一走档案表单模型（字段与后端 AiProfile 一一对应）
const formData = reactive<RecordType>(
  createAiProfileForm(props.row) as RecordType
);
const addOrEditRules = ref<RecordType>({});
const rawColumns = ref<PageColumn[]>([]);

/** embedding 用途不适用的字段（与后端档案语义一致：只留连接 + 超时/重试） */
const HIDDEN_FOR_EMBEDDING = [
  "temperature",
  "max_tokens",
  "top_p",
  "frequency_penalty",
  "presence_penalty",
  "stop",
  "seed",
  "context_limit",
  "persona"
];

/**
 * 表单可见字段白名单（顺序即渲染顺序）：search-columns 会把序列化器全部
 * 字段都带下来（含 pk / api_key_set / capabilities / probed_at / creator /
 * created_time / updated_time 等只读或系统字段），必须显式收窄并排序——
 * 后端序列化器顺序是「pk 开头 + 模型字段序」，与表单分组阅读顺序不一致
 * （name/purpose 相邻、连接组在前、行为组收尾），故按本清单重排。
 * 字段集与 AiProfileForm 时代一致：连接 7 项 + 采样 7 项 + 行为 4 项。
 */
const VISIBLE_FIELDS = [
  // 连接配置
  "name",
  "purpose",
  "base_url",
  "api_key",
  "model",
  "is_active",
  // 采样参数
  "temperature",
  "max_tokens",
  "top_p",
  "frequency_penalty",
  "presence_penalty",
  "stop",
  "seed",
  // 行为参数
  "timeout",
  "max_retries",
  "context_limit",
  "persona",
  // 备注收尾（自由文本，与配置无先后依赖）
  "remark"
];

const isEmbedding = computed(() => formData["purpose"] === "embedding");

/**
 * 关键控件的 data-testid（E2E 定位锚点）：框架列经 fieldProps 透传给控件，
 * EP 组件根元素携带（与 e2e/README 陷阱表口径一致：el-switch / el-input 上
 * 的 data-testid 会冒泡到根元素，getByTestId(...).click() 可用）。
 */
const FIELD_TEST_IDS: Record<string, string> = {
  name: "ai-profile-name",
  purpose: "ai-profile-purpose"
};

/** 输入框占位提示（框架表单列无 placeholder 概念，按字段补齐） */
const FIELD_PLACEHOLDERS: Record<string, string> = {
  base_url: "https://api.deepseek.com/v1",
  model: "deepseek-chat",
  api_key: t("aiConfig.apiKeyHint")
};

/**
 * 半宽字段（两列栅格，与框架 boolean 列同口径 colProps：md/lg/xl=12）：
 * 短控件（数字框 / 开关 / 短文本）两列排布；长文本（接口地址 / 备注 /
 * 人设）与下拉留整行，避免控件被压成窄条。
 */
const HALF_WIDTH_FIELDS = [
  "name",
  "purpose",
  "api_key",
  "model",
  "is_active",
  "temperature",
  "max_tokens",
  "top_p",
  "frequency_penalty",
  "presence_penalty",
  "seed",
  "timeout",
  "max_retries",
  "context_limit"
];

/** 框架列 → PlusForm 列（白名单收窄 + 按白名单排序 + prop/colProps/testid/placeholder 透传） */
const formColumns = computed<PlusColumn[]>(() => {
  const visible = rawColumns.value.filter(column =>
    VISIBLE_FIELDS.includes(column.prop as string)
  );
  return VISIBLE_FIELDS.map(prop => {
    const column = visible.find(item => item.prop === prop);
    if (!column) return null;
    if (isEmbedding.value && HIDDEN_FOR_EMBEDDING.includes(prop)) return null;
    const testId = FIELD_TEST_IDS[prop];
    const placeholder = FIELD_PLACEHOLDERS[prop];
    const fieldProps: Record<string, unknown> = {
      ...(column.fieldProps ?? {})
    };
    if (testId) fieldProps["data-testid"] = testId;
    if (placeholder) fieldProps.placeholder = placeholder;
    const colProps = HALF_WIDTH_FIELDS.includes(prop)
      ? { xs: 24, sm: 24, md: 12, lg: 12, xl: 12 }
      : { xs: 24, sm: 24 };
    return {
      ...column,
      prop: String(column["prop"] ?? ""),
      fieldProps,
      colProps
    } as PlusColumn;
  }).filter((column): column is PlusColumn => column !== null);
});

/**
 * 标签宽度：与弹窗表单（AddOrEdit）同一套自适应口径——按当前列最长标签
 * （含 label 后问号图标占位）离屏估算首帧初值，渲染后实测校正，保证中文
 * 标签不折行且控件列起点对齐（框架默认 80px 下 6 字以上中文必折行）。
 */
const labelWidth = ref("112px");
const formRef = ref<{ formEl?: HTMLElement } | null>(null);

watch(
  formColumns,
  columns => {
    labelWidth.value = resolveAdaptiveLabelWidth(columns);
    nextTick(async () => {
      const host = formRef.value?.formEl;
      if (!host) return;
      const measured = measureRenderedLabelWidth(host);
      if (measured) labelWidth.value = measured;
    });
  },
  { immediate: true }
);

const loadColumns = async () => {
  await getColumnData(
    aiProfileApi.columns,
    null,
    ({ addOrEditColumns, addOrEditDefaultValue, addOrEditRules: rules }) => {
      rawColumns.value = addOrEditColumns.value;
      addOrEditRules.value = rules.value;
      // 框架默认值仅在新建时兜底：编辑态以行数据为准（fillFromRow 已回填）
      if (!isEdit.value) {
        Object.assign(formData, createAiProfileForm());
        Object.assign(formData, addOrEditDefaultValue.value);
      }
    }
  );
};

/** 编辑回填：api_key 恒空（后端不回传明文，留空 = 沿用原密钥） */
const fillFromRow = () => {
  if (props.row) {
    Object.assign(formData, createAiProfileForm(props.row));
  }
};

onMounted(async () => {
  fillFromRow();
  await loadColumns();
});

/** 表单当前值 → 档案表单模型（框架 RecordType → 模型逐字段收窄） */
const readProfile = (): AiProfileFormModel =>
  ({
    ...createAiProfileForm(),
    name: String(formData["name"] ?? ""),
    base_url: String(formData["base_url"] ?? ""),
    api_key: String(formData["api_key"] ?? ""),
    model: String(formData["model"] ?? ""),
    temperature: (formData["temperature"] as number | null) ?? null,
    max_tokens: (formData["max_tokens"] as number | null) ?? null,
    top_p: (formData["top_p"] as number | null) ?? null,
    frequency_penalty: (formData["frequency_penalty"] as number | null) ?? null,
    presence_penalty: (formData["presence_penalty"] as number | null) ?? null,
    stop: String(formData["stop"] ?? ""),
    seed: (formData["seed"] as number | null) ?? null,
    timeout: Number(formData["timeout"] ?? 60),
    max_retries: Number(formData["max_retries"] ?? 2),
    context_limit: Number(formData["context_limit"] ?? 20),
    persona: String(formData["persona"] ?? ""),
    purpose: (formData["purpose"] as AiProfilePurpose) ?? "chat",
    is_active: Boolean(formData["is_active"]),
    remark: String(formData["remark"] ?? "")
  }) as AiProfileFormModel;

/** 校验并生成提交载荷；校验失败返回 null（调用方保持弹窗打开） */
const getPayload = (): Record<string, unknown> | null => {
  const form = readProfile();
  if (!form.name.trim() || !form.base_url.trim() || !form.model.trim()) {
    message(t("aiConfig.required"), { type: "warning" });
    return null;
  }
  if (!isEdit.value && !form.api_key.trim()) {
    message(t("aiConfig.apiKeyRequired"), { type: "warning" });
    return null;
  }
  return buildAiProfilePayload(form, isEdit.value);
};

defineExpose({ getPayload });
</script>

<template>
  <PlusForm
    ref="formRef"
    :model-value="formData"
    :columns="formColumns"
    :rules="addOrEditRules"
    label-position="right"
    :label-width="labelWidth"
    :row-props="{ gutter: 24 }"
    :has-footer="false"
    @update:model-value="value => Object.assign(formData, value)"
  />
</template>
