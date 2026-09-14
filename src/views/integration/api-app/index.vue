<script lang="ts" setup>
import { SUCCESS_CODE } from "@/api/types";
import { fetchAllRows } from "@/utils/fetchAllRows";
import { computed, onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import {
  apiApplicationApi,
  listApplicationRows,
  parseListText,
  type ApiApplicationCredential,
  type ApiApplicationItem,
  type CallbackProbeResult
} from "@/api/system/open";

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

const dialog = ref(false);
const submitLoading = ref(false);
const editingPk = ref<string | null>(null);
const form = reactive({
  name: "",
  scopes: "",
  ip_allowlist: "",
  rate_limit_per_minute: 0,
  callback_urls: "",
  token_ttl_seconds: 7200,
  is_active: true,
  description: ""
});

/** 一次性密钥展示（创建/重置后弹窗，关闭后不可再读） */
const credentialDialog = ref(false);
const credential = ref<ApiApplicationCredential | null>(null);
const probeResults = ref<CallbackProbeResult[]>([]);

const dialogTitle = computed(() =>
  editingPk.value ? t("apiApp.edit") : t("apiApp.create")
);

const openCreate = () => {
  editingPk.value = null;
  Object.assign(form, {
    name: "",
    scopes: "",
    ip_allowlist: "",
    rate_limit_per_minute: 0,
    callback_urls: "",
    token_ttl_seconds: 7200,
    is_active: true,
    description: ""
  });
  dialog.value = true;
};

const openEdit = (row: ApiApplicationItem) => {
  editingPk.value = row.pk;
  Object.assign(form, {
    name: row.name,
    scopes: (row.scopes ?? []).join(","),
    ip_allowlist: (row.ip_allowlist ?? []).join(","),
    rate_limit_per_minute: row.rate_limit_per_minute ?? 0,
    callback_urls: (row.callback_urls ?? []).join(","),
    token_ttl_seconds: row.token_ttl_seconds ?? 7200,
    is_active: row.is_active,
    description: ""
  });
  dialog.value = true;
};

const buildPayload = () => ({
  name: form.name,
  scopes: parseListText(form.scopes),
  ip_allowlist: parseListText(form.ip_allowlist),
  rate_limit_per_minute: Number(form.rate_limit_per_minute) || 0,
  callback_urls: parseListText(form.callback_urls),
  token_ttl_seconds: Number(form.token_ttl_seconds) || 0,
  is_active: form.is_active
});

const submit = async () => {
  submitLoading.value = true;
  try {
    const res = editingPk.value
      ? await apiApplicationApi.partialUpdate(editingPk.value, buildPayload())
      : await apiApplicationApi.create(buildPayload());
    if (res.code === SUCCESS_CODE) {
      message(t("apiApp.saveOk"), { type: "success" });
      dialog.value = false;
      const created = res.data as unknown as
        ApiApplicationCredential | undefined;
      // 创建响应携带一次性明文密钥：直接弹窗展示（列表/详情不回传）
      if (!editingPk.value && created?.client_secret) {
        credential.value = created;
        credentialDialog.value = true;
      }
      await loadAll();
    } else if (res.detail) {
      message(String(res.detail), { type: "warning" });
    }
  } finally {
    submitLoading.value = false;
  }
};

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

    <el-dialog v-model="dialog" :title="dialogTitle" width="560px">
      <el-form label-width="130px">
        <el-form-item :label="t('apiApp.name')" required>
          <el-input v-model="form.name" data-testid="api-app-name" />
        </el-form-item>
        <el-form-item :label="t('apiApp.scopes')">
          <el-input
            v-model="form.scopes"
            :placeholder="t('apiApp.scopesPlaceholder')"
          />
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
      <template #footer>
        <el-button @click="dialog = false">{{ t("apiApp.cancel") }}</el-button>
        <el-button
          type="primary"
          :loading="submitLoading"
          data-testid="api-app-submit"
          @click="submit"
        >
          {{ t("apiApp.confirm") }}
        </el-button>
      </template>
    </el-dialog>

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
