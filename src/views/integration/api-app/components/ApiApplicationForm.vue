<script lang="ts" setup>
import { onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { SUCCESS_CODE } from "@/api/types";
import {
  apiApplicationApi,
  loadScopeCatalog,
  parseListText,
  type ApiApplicationGrant,
  type ApiApplicationItem
} from "@/api/system/open";
import ApiScopeEditor from "@/components/ApiScopeEditor/index.vue";
import ApiGrantEditor from "./ApiGrantEditor.vue";

/**
 * API 应用表单（C5：弹窗体系收敛到 ReDialog 的 content 组件形态）。
 *
 * 组件负责「表单数据 + 载荷生成」，提交与列表刷新由页面在 `beforeSure` 中处理；
 * 名称等必填校验沿用后端口径（提交失败由页面统一提示）。
 *
 * 「接口范围」与访问令牌同款勾选器（`scope-options` 按本人权限收口，条目即锚定
 * 正则）：用户不再手填不透明的路径串，勾选即写入；未在目录中的历史/自定义条目
 * 落在编辑器「自定义」区，不会丢。
 *
 * 「资源授权」为独立端点（`{pk}/grants`，全量替换）：编辑态进入时拉取现有规则，
 * **拉取失败时 getGrants 返回 null、页面跳过授权保存**（绝不把规则覆盖为空——
 * 那会把白名单模式退回兼容模式，等于放宽权限）。
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
  daily_quota: props.row?.daily_quota ?? 0,
  quota_alert_percent: props.row?.quota_alert_percent ?? 80,
  is_active: props.row?.is_active ?? true
});

/** 资源授权规则（独立端点读写；编辑态异步加载） */
const grants = ref<ApiApplicationGrant[]>([]);
const grantsLoaded = ref(!props.row?.pk);
const grantsLoading = ref(false);
const grantEditorRef = ref<InstanceType<typeof ApiGrantEditor>>();

onMounted(async () => {
  if (!props.row?.pk) return;
  grantsLoading.value = true;
  try {
    const res = await apiApplicationApi.grants(props.row.pk);
    if (res.code === SUCCESS_CODE) {
      grants.value = res.data?.results ?? [];
      grantsLoaded.value = true;
    }
  } catch {
    grantsLoaded.value = false;
  } finally {
    grantsLoading.value = false;
  }
});

/** 生成提交载荷（接口范围由勾选器给出清单，其余列表文本按逗号/换行拆分） */
const getPayload = () => ({
  name: form.name,
  scopes: form.scopes,
  ip_allowlist: parseListText(form.ip_allowlist),
  rate_limit_per_minute: Number(form.rate_limit_per_minute) || 0,
  callback_urls: parseListText(form.callback_urls),
  token_ttl_seconds: Number(form.token_ttl_seconds) || 0,
  daily_quota: Number(form.daily_quota) || 0,
  quota_alert_percent: Number(form.quota_alert_percent) || 80,
  is_active: form.is_active
});

/** 资源授权载荷：null = 未加载成功（页面跳过保存，避免误清空） */
const getGrants = (): ApiApplicationGrant[] | null => {
  if (!grantsLoaded.value) return null;
  return grantEditorRef.value?.normalize() ?? [];
};

defineExpose({ getPayload, getGrants });
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
    <el-form-item :label="t('apiApp.dailyQuota')">
      <el-input-number v-model="form.daily_quota" :min="0" />
    </el-form-item>
    <el-form-item :label="t('apiApp.quotaAlertPercent')">
      <el-input-number v-model="form.quota_alert_percent" :min="1" :max="100" />
    </el-form-item>
    <el-form-item :label="t('apiApp.grant.title')">
      <div v-loading="grantsLoading" class="w-full">
        <el-alert
          v-if="!grantsLoaded"
          :title="t('apiApp.grant.loadFailed')"
          type="warning"
          :closable="false"
          show-icon
          class="mb-2"
        />
        <ApiGrantEditor ref="grantEditorRef" v-model="grants" />
      </div>
    </el-form-item>
    <el-form-item :label="t('apiApp.isActive')">
      <el-switch v-model="form.is_active" />
    </el-form-item>
  </el-form>
</template>
