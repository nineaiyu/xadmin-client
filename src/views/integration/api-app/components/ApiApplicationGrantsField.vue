<script lang="ts" setup>
import { onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { isSuccess } from "@/api/types";
import {
  apiApplicationApi,
  type ApiApplicationGrant
} from "@/api/identity/open";
import ApiGrantEditor from "./ApiGrantEditor.vue";

/**
 * 元数据表单里的「资源授权」扩展字段。
 *
 * 授权规则是独立端点（`{pk}/grants`，全量替换），不是主记录序列化字段：
 * - 编辑态挂载时拉取现有规则；**拉取失败时上抛 loaded=false，提交侧跳过授权保存**
 *   （绝不把规则覆盖为空——那会把白名单模式退回兼容模式，等于放宽权限）；
 * - 新建态无 pk，规则为空清单（兼容模式），直接视为已加载。
 */
defineOptions({ name: "ApiApplicationGrantsField" });

const props = defineProps<{
  /** 编辑行主键（新建时为空） */
  pk?: string;
  /** 表单当前值（由框架写入/读取） */
  modelValue?: ApiApplicationGrant[];
}>();

const emit = defineEmits<{
  "update:modelValue": [value: ApiApplicationGrant[]];
  loaded: [ok: boolean];
}>();

const { t } = useI18n();
const grants = ref<ApiApplicationGrant[]>(props.modelValue ?? []);
const loading = ref(false);
const loaded = ref(true);

watch(
  () => props.modelValue,
  value => {
    if (value !== grants.value) grants.value = value ?? [];
  }
);

watch(
  grants,
  value => {
    emit("update:modelValue", value);
  },
  { deep: true }
);

onMounted(async () => {
  if (!props.pk) {
    emit("loaded", true);
    return;
  }
  loading.value = true;
  try {
    const res = await apiApplicationApi.grants(props.pk);
    if (isSuccess(res)) {
      grants.value = res.data?.results ?? [];
      loaded.value = true;
    } else {
      loaded.value = false;
    }
  } catch {
    loaded.value = false;
  } finally {
    loading.value = false;
    emit("loaded", loaded.value);
  }
});
</script>

<template>
  <div v-loading="loading" class="w-full">
    <el-alert
      v-if="!loaded"
      :title="t('apiApp.grant.loadFailed')"
      :closable="false"
      show-icon
      type="warning"
      class="mb-2"
    />
    <ApiGrantEditor v-model="grants" />
  </div>
</template>
