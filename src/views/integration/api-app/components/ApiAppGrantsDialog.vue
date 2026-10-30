<script lang="ts" setup>
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { isSuccess } from "@/api/types";
import {
  apiApplicationApi,
  type ApiApplicationGrant
} from "@/api/identity/open";
import { normalizeGrants } from "../utils/grants";
import ApiGrantEditor from "./ApiGrantEditor.vue";

/**
 * 「管理」抽屉内的资源授权编辑（独立端点，全量替换）。
 *
 * 与主表单里的授权扩展字段共用 ApiGrantEditor / normalizeGrants；区别是
 * 这里只需调整授权，不触发主记录 PATCH，关闭弹窗也不会丢失列表行。
 */
defineOptions({ name: "ApiAppGrantsDialog" });

const props = defineProps<{ applicationPk: string }>();
const { t } = useI18n();

const grants = ref<ApiApplicationGrant[]>([]);
const loading = ref(false);
const loaded = ref(false);

const load = async () => {
  loading.value = true;
  try {
    const res = await apiApplicationApi.grants(props.applicationPk);
    loaded.value = isSuccess(res);
    if (loaded.value) grants.value = res.data?.results ?? [];
  } catch {
    loaded.value = false;
  } finally {
    loading.value = false;
  }
};

onMounted(load);

/** null = 未加载成功，弹窗保持打开（绝不把已有授权覆盖为空） */
const getPayload = (): ApiApplicationGrant[] | null =>
  loaded.value ? normalizeGrants(grants.value) : null;

defineExpose({ getPayload, reload: load });
</script>

<template>
  <div v-loading="loading" class="min-h-30">
    <el-alert
      v-if="!loading && !loaded"
      class="mb-2"
      type="error"
      :closable="false"
      show-icon
      :title="t('apiApp.grant.loadFailed')"
    />
    <ApiGrantEditor v-if="loaded" v-model="grants" />
  </div>
</template>
