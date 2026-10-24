<script lang="ts" setup>
import { computed, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { isSuccess } from "@/api/types";
import { useConfirm } from "@/hooks/useConfirm";
import {
  mcpServerApi,
  type McpCallResult,
  type McpServerItem,
  type McpToolSnapshot
} from "@/api/ai/mcp";
import { message } from "@/utils/message";
import { normalizeError } from "@/utils/apiError";

defineOptions({ name: "McpCallPanel" });

/**
 * MCP 工具调用测试面板（自 McpToolsDrawer 拆出，行数门禁）。
 *
 * - 工具参数表单优先按 input_schema 生成控件（enum → 下拉、boolean → 开关、
 *   number → 数字输入、object/array → JSON 文本），无 schema 时回落整段 JSON 编辑；
 * - 可写工具（read_only=false）可能修改外部系统数据：执行前二次确认；
 * - 调用仅白名单工具可用（服务端 fail-closed，本面板只做表单与展示）。
 */
const props = defineProps<{
  server: McpServerItem;
  tools: McpToolSnapshot[];
  /** 当前选中的工具名（父层工具表「调用」按钮设置） */
  toolName: string;
}>();

const { t } = useI18n();
const confirm = useConfirm();

const calling = ref(false);
const callArguments = ref("{}");
const callResult = ref<McpCallResult | null>(null);

/** 从 input_schema 派生出的简单表单字段（object 顶层 properties） */
type SchemaField = {
  name: string;
  type: string;
  description?: string;
  required: boolean;
  enum?: string[];
  defaultValue?: unknown;
};

const selectedTool = computed(
  () => props.tools.find(item => item.name === props.toolName) ?? null
);

const schemaFields = computed<SchemaField[]>(() => {
  const schema = selectedTool.value?.input_schema as
    Record<string, unknown> | undefined;
  if (!schema || typeof schema !== "object") return [];
  const properties = schema.properties as
    Record<string, Record<string, unknown>> | undefined;
  if (!properties || typeof properties !== "object") return [];
  const required = Array.isArray(schema.required)
    ? (schema.required as string[])
    : [];
  return Object.entries(properties).map(([name, raw]) => {
    const def: Record<string, unknown> =
      raw && typeof raw === "object" ? raw : {};
    return {
      name,
      type: String(def.type || "string"),
      description:
        typeof def.description === "string" ? def.description : undefined,
      required: required.includes(name),
      enum: Array.isArray(def.enum) ? def.enum.map(String) : undefined,
      defaultValue: def.default
    };
  });
});

/** 表单值：boolean/number 直接存，object/array 存 JSON 字符串 */
const callArgs = reactive<Record<string, unknown>>({});

const setArg = (name: string, value: unknown) => {
  callArgs[name] = value;
};

const defaultValueOf = (field: SchemaField) => {
  if (field.defaultValue !== undefined) return field.defaultValue;
  return field.type === "boolean" ? false : "";
};

const resetCallArgs = () => {
  for (const key of Object.keys(callArgs)) delete callArgs[key];
  for (const field of schemaFields.value) {
    callArgs[field.name] = defaultValueOf(field);
  }
};

// 换工具 = 换表单：清空参数与上次结果，按新 schema 重置默认值
watch(
  () => props.toolName,
  () => {
    callArguments.value = "{}";
    callResult.value = null;
    resetCallArgs();
  }
);

/** 组装调用参数：有 schema 时按表单取值，否则解析 JSON 文本 */
const parseArguments = (): Record<string, unknown> | null => {
  if (!schemaFields.value.length) {
    try {
      const parsed = JSON.parse(callArguments.value || "{}");
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
      )
        throw new Error("not an object");
      return parsed as Record<string, unknown>;
    } catch {
      message(t("mcp.callInvalidJson"), { type: "warning" });
      return null;
    }
  }
  const payload: Record<string, unknown> = {};
  for (const field of schemaFields.value) {
    const raw = callArgs[field.name];
    if (raw === "" || raw === undefined || raw === null) {
      if (field.required) {
        message(t("mcp.argRequired", { name: field.name }), {
          type: "warning"
        });
        return null;
      }
      continue;
    }
    if (field.type === "number" || field.type === "integer") {
      const value = Number(raw);
      if (!Number.isFinite(value)) {
        message(t("mcp.argInvalidNumber", { name: field.name }), {
          type: "warning"
        });
        return null;
      }
      payload[field.name] = value;
      continue;
    }
    if (field.type === "boolean") {
      payload[field.name] = Boolean(raw);
      continue;
    }
    if (field.type === "object" || field.type === "array") {
      try {
        payload[field.name] = JSON.parse(String(raw));
      } catch {
        message(t("mcp.callInvalidJson"), { type: "warning" });
        return null;
      }
      continue;
    }
    payload[field.name] = raw;
  }
  return payload;
};

const runCall = async () => {
  const args = parseArguments();
  if (!args) return;
  // 可写工具（read_only=false）可能修改外部系统数据：执行前必须二次确认
  if (selectedTool.value?.read_only === false) {
    const ok = await confirm(t("mcp.writeConfirm", { name: props.toolName }), {
      title: t("mcp.writeConfirmTitle"),
      confirmButtonClass: "el-button--danger"
    });
    if (!ok) return;
  }
  calling.value = true;
  try {
    const res = await mcpServerApi
      .call(props.server.pk, props.toolName, args)
      .catch(normalizeError);
    if (isSuccess(res)) {
      callResult.value = res.data as McpCallResult;
    } else {
      callResult.value = {
        tool: props.toolName,
        is_error: true,
        text: String(res.detail ?? "")
      };
    }
  } finally {
    calling.value = false;
  }
};
</script>

<template>
  <div>
    <div class="mb-2 font-medium">
      {{ t("mcp.callTitle", { name: toolName || "-" }) }}
    </div>
    <el-form
      v-if="schemaFields.length"
      label-width="140px"
      data-testid="mcp-call-form"
    >
      <el-form-item
        v-for="field in schemaFields"
        :key="field.name"
        :label="field.name"
        :required="field.required"
      >
        <el-select
          v-if="field.enum?.length"
          class="w-full"
          :data-testid="`mcp-arg-${field.name}`"
          :model-value="String(callArgs[field.name] ?? '')"
          @update:model-value="value => setArg(field.name, value)"
        >
          <el-option
            v-for="option in field.enum"
            :key="option"
            :label="option"
            :value="option"
          />
        </el-select>
        <el-switch
          v-else-if="field.type === 'boolean'"
          :data-testid="`mcp-arg-${field.name}`"
          :model-value="Boolean(callArgs[field.name])"
          @update:model-value="value => setArg(field.name, value)"
        />
        <el-input-number
          v-else-if="field.type === 'number' || field.type === 'integer'"
          class="w-full"
          :data-testid="`mcp-arg-${field.name}`"
          :model-value="Number(callArgs[field.name] ?? 0)"
          @update:model-value="value => setArg(field.name, value ?? 0)"
        />
        <el-input
          v-else-if="field.type === 'object' || field.type === 'array'"
          :data-testid="`mcp-arg-${field.name}`"
          :model-value="String(callArgs[field.name] ?? '')"
          type="textarea"
          :rows="2"
          :placeholder="t('mcp.argsJsonTip')"
          @update:model-value="value => setArg(field.name, value)"
        />
        <el-input
          v-else
          :data-testid="`mcp-arg-${field.name}`"
          :model-value="String(callArgs[field.name] ?? '')"
          @update:model-value="value => setArg(field.name, value)"
        />
        <div
          v-if="field.description"
          class="text-xs text-(--el-text-color-secondary)"
        >
          {{ field.description }}
        </div>
      </el-form-item>
    </el-form>
    <el-input
      v-else
      v-model="callArguments"
      type="textarea"
      :rows="3"
      data-testid="mcp-call-arguments"
      :placeholder="t('mcp.callArgumentsTip')"
    />
    <div class="mt-2 flex items-center gap-2">
      <el-button
        type="primary"
        size="small"
        :disabled="!toolName"
        :loading="calling"
        data-testid="mcp-call-run"
        @click="runCall"
      >
        {{ t("mcp.callRun") }}
      </el-button>
      <span class="text-xs text-(--el-text-color-regular)">
        {{ t("mcp.whitelistTip") }}
      </span>
    </div>
    <div v-if="callResult" class="mt-3" data-testid="mcp-call-result">
      <div
        class="mb-1 text-xs"
        :class="
          callResult.is_error
            ? 'text-(--el-color-danger)'
            : 'text-(--el-color-success)'
        "
      >
        {{ callResult.is_error ? t("mcp.callFailed") : t("mcp.callSuccess") }}
      </div>
      <pre
        class="max-h-60 overflow-auto rounded bg-(--el-fill-color-light) p-2 text-xs break-all whitespace-pre-wrap"
        >{{ callResult.text || "-" }}</pre>
    </div>
  </div>
</template>
