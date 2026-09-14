<script lang="ts" setup>
import { SUCCESS_CODE } from "@/api/types";
import { fetchAllRows } from "@/utils/fetchAllRows";
import { h, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import {
  apiApplicationApi,
  listApplicationRows,
  type ApiApplicationCredential,
  type ApiApplicationItem,
  type CallbackProbeResult
} from "@/api/system/open";
import ApiApplicationForm from "./components/ApiApplicationForm.vue";

defineOptions({
  name: "IntegrationApiApp"
});

const { t } = useI18n();
const canCreate = hasAuth("create:IntegrationApiApp");
const canEdit = hasAuth("partialUpdate:IntegrationApiApp");
const canRegenerate = hasAuth("regenerateSecret:IntegrationApiApp");
const canTestCallback = hasAuth("testCallback:IntegrationApiApp");

const loading = ref(false);
const rows = ref<ApiApplicationItem[]>([]);

const loadAll = async () => {
  loading.value = true;
  try {
    rows.value = listApplicationRows(
      await fetchAllRows(apiApplicationApi.list)
    );
  } finally {
    loading.value = false;
  }
};

/** 一次性密钥展示（创建/重置后弹窗，关闭后不可再读） */
const credentialDialog = ref(false);
const credential = ref<ApiApplicationCredential | null>(null);
const probeResults = ref<CallbackProbeResult[]>([]);

/** 新建 / 编辑弹窗（C5：统一走 ReDialog，表单在 ApiApplicationForm 中） */
const formRef = ref<InstanceType<typeof ApiApplicationForm>>();

const openDialog = (row: ApiApplicationItem | null) => {
  formRef.value = undefined;
  addDialog({
    title: row ? t("apiApp.edit") : t("apiApp.create"),
    width: dialogSize("md"),
    draggable: true,
    destroyOnClose: true,
    closeOnClickModal: false,
    sureBtnLoading: true,
    contentRenderer: () => h(ApiApplicationForm, { ref: formRef, row }),
    beforeSure: async (done, { closeLoading }) => {
      const payload = formRef.value?.getPayload();
      if (!payload) {
        closeLoading();
        return;
      }
      // 异常归一为可读失败结果：避免请求异常时 beforeSure 抛错、弹窗 loading 悬挂
      const res = await (
        row
          ? apiApplicationApi.partialUpdate(row.pk, payload)
          : apiApplicationApi.create(payload)
      ).catch(error => ({
        code: -1,
        data: null,
        detail: String((error as { detail?: string })?.detail ?? error)
      }));
      if (res.code === SUCCESS_CODE) {
        message(t("apiApp.saveOk"), { type: "success" });
        // 先关表单弹窗（与原手写弹窗行为一致），一次性密钥弹窗紧接展示（列表/详情不回传）
        done();
        const created = res.data as unknown as
          ApiApplicationCredential | undefined;
        if (!row && created?.client_secret) {
          credential.value = created;
          credentialDialog.value = true;
        }
        await loadAll();
        return;
      }
      if (res.detail) message(String(res.detail), { type: "warning" });
      closeLoading();
    }
  });
};

const openCreate = () => openDialog(null);
const openEdit = (row: ApiApplicationItem) => openDialog(row);

const toggleActive = async (row: ApiApplicationItem) => {
  const res = await apiApplicationApi.partialUpdate(row.pk, {
    is_active: row.is_active
  });
  if (res.code !== SUCCESS_CODE) {
    row.is_active = !row.is_active;
    message(String(res.detail ?? t("apiApp.saveFailed")), { type: "warning" });
  }
};

const regenerateSecret = async (row: ApiApplicationItem) => {
  const res = await apiApplicationApi.regenerateSecret(row.pk);
  if (res.code === SUCCESS_CODE) {
    credential.value = res.data;
    credentialDialog.value = true;
    await loadAll();
  }
};

const testCallback = async (row: ApiApplicationItem) => {
  const res = await apiApplicationApi.testCallback(row.pk);
  if (res.code === SUCCESS_CODE) {
    probeResults.value = res.data?.results ?? [];
    const failed = probeResults.value.filter(item => !item.success).length;
    message(
      failed
        ? t("apiApp.callbackFailed", { count: failed })
        : t("apiApp.callbackOk"),
      { type: failed ? "warning" : "success" }
    );
  } else if (res.detail) {
    message(String(res.detail), { type: "warning" });
  }
};

const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    message(t("apiApp.copied"), { type: "success" });
  } catch {
    message(t("apiApp.copyFailed"), { type: "warning" });
  }
};

onMounted(loadAll);
</script>

<template>
  <div class="pr-[1%]">
    <!-- pr-[1%]：内容宽度对齐 RePlusPage 的 w-99/100（右侧留 1%），
         根元素自带 layout 注入的 main-content（24px 外边距），不能再设百分比宽度（会溢出） -->
    <el-card shadow="never">
      <div class="mb-3 flex-bc gap-2">
        <span class="font-semibold">{{ t("apiApp.title") }}</span>
        <el-button
          v-if="canCreate"
          type="primary"
          data-testid="api-app-create"
          @click="openCreate"
        >
          {{ t("apiApp.create") }}
        </el-button>
      </div>
      <el-alert
        class="mb-3"
        :closable="false"
        type="info"
        :title="t('apiApp.tip')"
      />
      <el-table v-loading="loading" :data="rows" data-testid="api-app-table">
        <el-table-column
          prop="name"
          :label="t('apiApp.name')"
          min-width="140"
        />
        <el-table-column
          prop="client_id"
          :label="t('apiApp.clientId')"
          min-width="220"
          show-overflow-tooltip
        />
        <el-table-column
          :label="t('apiApp.scopes')"
          min-width="200"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <el-tag
              v-for="scope in (row as ApiApplicationItem).scopes"
              :key="scope"
              size="small"
              class="mr-1"
            >
              {{ scope }}
            </el-tag>
            <span v-if="!(row as ApiApplicationItem).scopes?.length">
              {{ t("apiApp.unlimited") }}
            </span>
          </template>
        </el-table-column>
        <el-table-column
          prop="rate_limit_per_minute"
          :label="t('apiApp.rateLimit')"
          width="130"
        />
        <el-table-column :label="t('apiApp.isActive')" width="90">
          <template #default="{ row }">
            <el-switch
              v-if="canEdit"
              v-model="(row as ApiApplicationItem).is_active"
              @change="toggleActive(row as ApiApplicationItem)"
            />
            <el-tag
              v-else
              size="small"
              :type="(row as ApiApplicationItem).is_active ? 'success' : 'info'"
            >
              {{
                (row as ApiApplicationItem).is_active
                  ? t("apiApp.on")
                  : t("apiApp.off")
              }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('apiApp.actions')" width="220" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="canRegenerate"
              link
              type="primary"
              @click="regenerateSecret(row as ApiApplicationItem)"
            >
              {{ t("apiApp.regenerate") }}
            </el-button>
            <el-button
              v-if="canTestCallback"
              link
              type="success"
              @click="testCallback(row as ApiApplicationItem)"
            >
              {{ t("apiApp.testCallback") }}
            </el-button>
            <el-button
              v-if="canEdit"
              link
              type="primary"
              @click="openEdit(row as ApiApplicationItem)"
            >
              {{ t("apiApp.edit") }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="credentialDialog"
      :title="t('apiApp.credentialTitle')"
      width="620px"
    >
      <el-alert
        class="mb-3"
        :closable="false"
        type="warning"
        :title="t('apiApp.credentialTip')"
      />
      <div v-if="credential" class="space-y-2 text-sm">
        <div class="flex items-center gap-2">
          <span class="w-32 shrink-0">{{ t("apiApp.clientId") }}</span>
          <el-input :model-value="credential.client_id" readonly />
          <el-button
            link
            type="primary"
            @click="copyText(credential.client_id)"
          >
            {{ t("apiApp.copy") }}
          </el-button>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-32 shrink-0">{{ t("apiApp.clientSecret") }}</span>
          <el-input
            :model-value="credential.client_secret"
            readonly
            data-testid="api-app-secret"
          />
          <el-button
            link
            type="primary"
            @click="copyText(credential.client_secret)"
          >
            {{ t("apiApp.copy") }}
          </el-button>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-32 shrink-0">{{ t("apiApp.callbackSecret") }}</span>
          <el-input :model-value="credential.callback_secret" readonly />
          <el-button
            link
            type="primary"
            @click="copyText(credential.callback_secret)"
          >
            {{ t("apiApp.copy") }}
          </el-button>
        </div>
      </div>
      <template #footer>
        <el-button type="primary" @click="credentialDialog = false">
          {{ t("apiApp.confirm") }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>
