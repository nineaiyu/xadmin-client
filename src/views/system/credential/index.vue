<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  credentialApi,
  type CredentialOverview
} from "@/api/system/credential";
import { hasAuth } from "@/router/utils";
import { isSuccess } from "@/api/types";
import { normalizeError } from "@/utils/apiError";
import { type ReadonlyColumn } from "@/components/ReReadonlyTable";
import ReEmpty from "@/components/ReEmpty";
import RePage from "@/components/RePage";
import CredentialTable from "./components/CredentialTable.vue";
import {
  filterCredentialRows,
  type CredentialRowLike
} from "./utils/credentialDisplay";

defineOptions({ name: "SystemCredential" });

const { t } = useI18n();
const loading = ref(false);
/** 加载失败原因：失败时渲染可重试空态，不把异常吞成空白页 */
const loadError = ref("");
const canView = hasAuth("overview:Credential");
const data = ref<CredentialOverview>({
  settings: [],
  system_configs: [],
  model_fields: [],
  plaintext: []
});

const plaintextCount = computed(() => data.value.plaintext?.length ?? 0);
const keyword = ref("");
const filtered = computed(() => ({
  system_configs: filterCredentialRows(
    data.value.system_configs as CredentialRowLike[],
    keyword.value
  ),
  settings: filterCredentialRows(
    data.value.settings as CredentialRowLike[],
    keyword.value
  ),
  model_fields: filterCredentialRows(
    data.value.model_fields as CredentialRowLike[],
    keyword.value
  )
}));

/** 总览一次返回全量；三张表客户端分页，避免长清单整表铺开 */
const PAGE_SIZE = 20;
const pageOf = reactive({
  system_configs: 1,
  settings: 1,
  model_fields: 1
});
type CredentialTableKey = keyof typeof pageOf;
const pageSlice = (key: CredentialTableKey) => {
  const start = (pageOf[key] - 1) * PAGE_SIZE;
  return filtered.value[key].slice(start, start + PAGE_SIZE);
};
const paged = computed(() => ({
  system_configs: pageSlice("system_configs"),
  settings: pageSlice("settings"),
  model_fields: pageSlice("model_fields")
}));
watch(keyword, () => {
  pageOf.system_configs = 1;
  pageOf.settings = 1;
  pageOf.model_fields = 1;
});

/** 动作列：可原地轮换给轮换按钮，外部签发给「去更换」入口（列集合是数据的一部分） */
const actionsColumn: ReadonlyColumn = {
  label: t("credential.action"),
  width: 120,
  align: "center",
  fixed: "right",
  slot: "actions"
};

const statusColumn: ReadonlyColumn = {
  label: t("credential.status"),
  width: 120,
  align: "center",
  slot: "status"
};

/** 上次轮换 + 建议轮换标记（仅自生成可轮换凭据行有内容） */
const rotatedColumn = computed<ReadonlyColumn>(() => ({
  label: t("credential.lastRotated"),
  minWidth: 180,
  slot: "rotated"
}));

/** 系统配置类凭据（Setting / SysConfig）：字段清单与服务端注册表同源 */
const systemConfigColumns = computed<ReadonlyColumn[]>(() => [
  { prop: "name", label: t("credential.name"), minWidth: 200 },
  { label: t("credential.fields"), minWidth: 120, slot: "fields" },
  { label: t("credential.description"), minWidth: 180, slot: "description" },
  { prop: "used_by", label: t("credential.usedBy"), minWidth: 200 },
  {
    label: t("credential.masked"),
    width: 120,
    align: "center",
    slot: "masked"
  },
  statusColumn,
  rotatedColumn.value,
  { prop: "updated_time", label: t("credential.updatedTime"), minWidth: 180 },
  actionsColumn
]);

/** 模型字段级加密：只给「字段 + 已配置数量」，不回传任何值 */
const modelFieldColumns = computed<ReadonlyColumn[]>(() => [
  { prop: "label", label: t("credential.name"), minWidth: 200 },
  { prop: "name", label: t("credential.field"), minWidth: 240 },
  { prop: "used_by", label: t("credential.usedBy"), minWidth: 200 },
  {
    prop: "configured_count",
    label: t("credential.configuredCount"),
    width: 150,
    align: "center"
  },
  statusColumn,
  rotatedColumn.value,
  { prop: "updated_time", label: t("credential.updatedTime"), minWidth: 180 },
  actionsColumn
]);

const settingsColumns = computed<ReadonlyColumn[]>(() => [
  { prop: "name", label: t("credential.name"), minWidth: 200 },
  { prop: "category", label: t("credential.category"), width: 140 },
  { prop: "used_by", label: t("credential.usedBy"), minWidth: 200 },
  {
    label: t("credential.masked"),
    width: 120,
    align: "center",
    slot: "masked"
  },
  statusColumn,
  { prop: "updated_time", label: t("credential.updatedTime"), minWidth: 180 },
  actionsColumn
]);

async function loadData() {
  if (!canView) return;
  loading.value = true;
  loadError.value = "";
  try {
    const res = await credentialApi.overview().catch(normalizeError);
    if (isSuccess(res) && res.data) {
      data.value = res.data;
    } else {
      loadError.value = String(
        (res as { detail?: unknown }).detail ?? t("credential.loadFailed")
      );
    }
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadData();
});
</script>

<template>
  <RePage>
    <!-- 无 overview 权限时给出显式说明，不渲染空表格 -->
    <ReEmpty
      v-if="!canView"
      :description="t('credential.noPermission')"
      :hint="t('credential.noPermissionHint')"
      icon="ep/lock"
    />
    <ReEmpty
      v-else-if="loadError"
      :description="t('credential.loadFailed')"
      :hint="loadError"
      icon="ep/warning"
    >
      <el-button type="primary" @click="loadData">
        {{ t("credential.retry") }}
      </el-button>
    </ReEmpty>
    <template v-else>
      <el-alert
        v-if="plaintextCount"
        class="mb-3"
        type="warning"
        show-icon
        :closable="false"
        :title="t('credential.plaintextWarn', { count: plaintextCount })"
      />
      <div class="mb-3 flex items-center gap-3">
        <el-input
          v-model="keyword"
          class="max-w-90"
          clearable
          :placeholder="t('credential.searchPlaceholder')"
        />
        <span
          v-if="
            keyword &&
            !filtered.system_configs.length &&
            !filtered.settings.length &&
            !filtered.model_fields.length
          "
          class="text-sm text-(--el-text-color-secondary)"
        >
          {{ t("credential.noMatch") }}
        </span>
      </div>
      <el-card shadow="never" class="mb-3">
        <template #header>
          <span class="font-medium">{{ t("credential.systemConfigs") }}</span>
        </template>
        <CredentialTable
          :columns="systemConfigColumns"
          :rows="paged.system_configs"
          :loading="loading"
          @rotated="loadData"
        >
          <template #fields="{ row }">
            {{ (row.fields ?? []).join("、") }}
          </template>
          <template #description="{ row }">
            <span class="text-(--el-text-color-secondary)">
              {{ row.description || "—" }}
            </span>
          </template>
        </CredentialTable>
        <el-pagination
          v-if="filtered.system_configs.length > PAGE_SIZE"
          v-model:current-page="pageOf.system_configs"
          :page-size="PAGE_SIZE"
          :total="filtered.system_configs.length"
          layout="total, prev, pager, next"
          size="small"
          class="mt-2 justify-end"
        />
      </el-card>

      <el-card shadow="never" class="mb-3">
        <template #header>
          <span class="font-medium">{{ t("credential.settings") }}</span>
        </template>
        <CredentialTable
          :columns="settingsColumns"
          :rows="paged.settings"
          :loading="loading"
          @rotated="loadData"
        />
        <el-pagination
          v-if="filtered.settings.length > PAGE_SIZE"
          v-model:current-page="pageOf.settings"
          :page-size="PAGE_SIZE"
          :total="filtered.settings.length"
          layout="total, prev, pager, next"
          size="small"
          class="mt-2 justify-end"
        />
      </el-card>

      <el-card shadow="never">
        <template #header>
          <span class="font-medium">{{ t("credential.modelFields") }}</span>
        </template>
        <CredentialTable
          :columns="modelFieldColumns"
          :rows="paged.model_fields"
          :loading="loading"
          @rotated="loadData"
        />
        <el-pagination
          v-if="filtered.model_fields.length > PAGE_SIZE"
          v-model:current-page="pageOf.model_fields"
          :page-size="PAGE_SIZE"
          :total="filtered.model_fields.length"
          layout="total, prev, pager, next"
          size="small"
          class="mt-2 justify-end"
        />
        <div class="mt-2 text-sm text-(--el-text-color-secondary)">
          {{ t("credential.modelFieldsHint") }}
        </div>
      </el-card>
    </template>
  </RePage>
</template>
