<script lang="ts" setup>
import { reactive } from "vue";
import { useI18n } from "vue-i18n";
import type { McpServerItem, McpServerPayload } from "@/api/ai/mcp";
import { message } from "@/utils/message";

/**
 * 外部 MCP 服务器表单（新建/编辑）。
 *
 * - 令牌明文只进不出：编辑时留空表示保持不变（auth_token_set 布尔回显状态）；
 * - 白名单工具用逗号分隔文本维护（同步后可维护精确保留名；空 = 全部禁止）。
 */
defineOptions({ name: "McpServerForm" });

const props = defineProps<{
  /** 编辑行（null / 缺省 = 新建） */
  row?: McpServerItem | null;
}>();

const { t } = useI18n();

const form = reactive({
  name: props.row?.name ?? "",
  url: props.row?.url ?? "",
  auth_header: props.row?.auth_header ?? "",
  auth_token: "",
  timeout: props.row?.timeout ?? 30,
  allowed_tools: (props.row?.allowed_tools ?? []).join(", "),
  enabled: props.row?.enabled ?? true,
  remark: props.row?.remark ?? ""
});

/** 校验并生成提交载荷；失败返回 null（调用方保持弹窗打开） */
const getPayload = (): McpServerPayload | null => {
  const name = form.name.trim();
  if (!name) {
    message(t("mcp.nameRequired"), { type: "warning" });
    return null;
  }
  const url = form.url.trim();
  if (!url) {
    message(t("mcp.urlRequired"), { type: "warning" });
    return null;
  }
  const allowed = form.allowed_tools
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
  const payload: McpServerPayload = {
    name,
    url,
    auth_header: form.auth_header.trim(),
    timeout: form.timeout,
    allowed_tools: allowed,
    enabled: form.enabled,
    remark: form.remark.trim()
  };
  // 编辑时留空 = 保持不变（不提交 auth_token 键）
  if (form.auth_token.trim() || !props.row) {
    payload.auth_token = form.auth_token.trim();
  }
  return payload;
};

defineExpose({ getPayload });
</script>

<template>
  <el-form label-width="120px">
    <el-form-item :label="t('mcp.formName')" required>
      <el-input v-model="form.name" data-testid="mcp-form-name" />
    </el-form-item>
    <el-form-item :label="t('mcp.formUrl')" required>
      <el-input
        v-model="form.url"
        data-testid="mcp-form-url"
        placeholder="https://mcp.example.com/mcp"
      />
      <div class="text-xs text-(--el-text-color-regular)">
        {{ t("mcp.formUrlTip") }}
      </div>
    </el-form-item>
    <el-form-item :label="t('mcp.formAuthHeader')">
      <el-input v-model="form.auth_header" placeholder="Authorization" />
    </el-form-item>
    <el-form-item :label="t('mcp.formAuthToken')">
      <el-input
        v-model="form.auth_token"
        type="password"
        show-password
        data-testid="mcp-form-token"
        :placeholder="
          row?.auth_token_set
            ? t('mcp.formAuthTokenLeave')
            : t('mcp.formAuthTokenPlaceholder')
        "
      />
    </el-form-item>
    <el-form-item :label="t('mcp.formTimeout')">
      <el-input-number
        v-model="form.timeout"
        :min="5"
        :max="120"
        controls-position="right"
      />
    </el-form-item>
    <el-form-item :label="t('mcp.formAllowedTools')">
      <el-input
        v-model="form.allowed_tools"
        data-testid="mcp-form-allowed"
        placeholder="echo, search"
      />
      <div class="text-xs text-(--el-text-color-regular)">
        {{ t("mcp.formAllowedToolsTip") }}
      </div>
    </el-form-item>
    <el-form-item :label="t('mcp.formEnabled')">
      <el-switch v-model="form.enabled" />
    </el-form-item>
    <el-form-item :label="t('mcp.formRemark')">
      <el-input v-model="form.remark" />
    </el-form-item>
  </el-form>
</template>
