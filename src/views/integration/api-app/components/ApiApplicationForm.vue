<script lang="ts" setup>
import { reactive } from "vue";
import { useI18n } from "vue-i18n";
import {
  loadScopeCatalog,
  parseListText,
  type ApiApplicationItem
} from "@/api/system/open";
import ApiScopeEditor from "@/components/ApiScopeEditor/index.vue";

/**
 * API 应用表单（C5：弹窗体系收敛到 ReDialog 的 content 组件形态）。
 *
 * 组件负责「表单数据 + 载荷生成」，提交与列表刷新由页面在 `beforeSure` 中处理；
 * 名称等必填校验沿用后端口径（提交失败由页面统一提示）。
 *
 * 「接口范围」与访问令牌同款勾选器（`scope-options` 按本人权限收口，条目即锚定
 * 正则）：用户不再手填不透明的路径串，勾选即写入；未在目录中的历史/自定义条目
 * 落在编辑器「自定义」区，不会丢。
 */
defineOptions({ name: "IntegrationApiApplicationForm" });

const props = defineProps<{
  /** 编辑时的原始行（null / 缺省 = 新建） */
  row?: ApiApplicationItem | null;
}>();

const { t } = useI18n();

const form = reactive({
  name: props.row?.name ?? "",
  scopes: [...(props.row?.scopes ?? [])],
  ip_allowlist: (props.row?.ip_allowlist ?? []).join(","),
  rate_limit_per_minute: props.row?.rate_limit_per_minute ?? 0,
  callback_urls: (props.row?.callback_urls ?? []).join(","),
  token_ttl_seconds: props.row?.token_ttl_seconds ?? 7200,
  is_active: props.row?.is_active ?? true
});

/** 生成提交载荷（接口范围由勾选器给出清单，其余列表文本按逗号/换行拆分） */
const getPayload = () => ({
  name: form.name,
  scopes: form.scopes,
  ip_allowlist: parseListText(form.ip_allowlist),
  rate_limit_per_minute: Number(form.rate_limit_per_minute) || 0,
  callback_urls: parseListText(form.callback_urls),
  token_ttl_seconds: Number(form.token_ttl_seconds) || 0,
  is_active: form.is_active
});

defineExpose({ getPayload });
</script>

<template>
  <el-form label-width="130px">
    <el-form-item :label="t('apiApp.name')" required>
      <el-input v-model="form.name" data-testid="api-app-name" />
    </el-form-item>
    <el-form-item :label="t('apiApp.scopes')">
      <ApiScopeEditor v-model="form.scopes" :load-options="loadScopeCatalog" />
    </el-form-item>
    <el-form-item :label="t('apiApp.ipAllowlist')">
      <el-input
        v-model="form.ip_allowlist"
        :placeholder="t('apiApp.listPlaceholder')"
      />
    </el-form-item>
    <el-form-item :label="t('apiApp.rateLimit')">
      <el-input-number v-model="form.rate_limit_per_minute" :min="0" />
    </el-form-item>
    <el-form-item :label="t('apiApp.callbackUrls')">
      <el-input
        v-model="form.callback_urls"
        :placeholder="t('apiApp.listPlaceholder')"
      />
    </el-form-item>
    <el-form-item :label="t('apiApp.tokenTtl')">
      <el-input-number v-model="form.token_ttl_seconds" :min="0" />
    </el-form-item>
    <el-form-item :label="t('apiApp.isActive')">
      <el-switch v-model="form.is_active" />
    </el-form-item>
  </el-form>
</template>
