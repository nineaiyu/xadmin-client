<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  credentialApi,
  type CredentialOverview
} from "@/api/system/credential";
import { hasAuth } from "@/router/utils";
import { SUCCESS_CODE } from "@/api/types";
import { type ReadonlyColumn } from "@/components/ReReadonlyTable";
import ReEmpty from "@/components/ReEmpty";
import CredentialTable from "./components/CredentialTable.vue";

defineOptions({ name: "SystemCredential" });

const { t } = useI18n();
const loading = ref(false);
const canView = hasAuth("overview:Credential");
const data = ref<CredentialOverview>({
  settings: [],
  system_configs: [],
  model_fields: [],
  plaintext: []
});

const plaintextCount = computed(() => data.value.plaintext?.length ?? 0);

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
  try {
    const res = await credentialApi.overview();
    if (res?.code === SUCCESS_CODE && res.data) {
      data.value = res.data;
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
  <div class="main">
    <!-- 无 overview 权限时给出显式说明，不渲染空表格 -->
    <ReEmpty
      v-if="!canView"
      :description="t('credential.noPermission')"
      :hint="t('credential.noPermissionHint')"
      icon="ep/lock"
    />
    <template v-else>
      <el-alert
        v-if="plaintextCount"
        class="mb-3"
        type="warning"
        show-icon
        :closable="false"
        :title="t('credential.plaintextWarn', { count: plaintextCount })"
      />
      <el-card shadow="never" class="mb-3">
        <template #header>
          <span class="font-medium">{{ t("credential.systemConfigs") }}</span>
        </template>
        <CredentialTable
          :columns="systemConfigColumns"
          :rows="data.system_configs"
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
      </el-card>

      <el-card shadow="never" class="mb-3">
        <template #header>
          <span class="font-medium">{{ t("credential.settings") }}</span>
        </template>
        <CredentialTable
          :columns="settingsColumns"
          :rows="data.settings"
          :loading="loading"
          @rotated="loadData"
        />
      </el-card>

      <el-card shadow="never">
        <template #header>
          <span class="font-medium">{{ t("credential.modelFields") }}</span>
        </template>
        <CredentialTable
          :columns="modelFieldColumns"
          :rows="data.model_fields"
          :loading="loading"
          @rotated="loadData"
        />
        <div class="mt-2 text-sm text-(--el-text-color-secondary)">
          {{ t("credential.modelFieldsHint") }}
        </div>
      </el-card>
    </template>
  </div>
</template>
