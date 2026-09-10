<script lang="ts" setup>
import { computed, h, onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElInput } from "element-plus";
import type { RecordType } from "plus-pro-components";
import type { DetailResult, ListResult } from "@/api/types";
import { addDialog } from "@/components/ReDialog";
import { message } from "@/utils/message";
import { handleOperation } from "@/components/RePlusPage";
import { personalAccessTokenApi } from "@/api/user/token";
import PatCallLogs from "./PatCallLogs.vue";
import Delete from "~icons/ep/delete";
import Document from "~icons/ep/document";
import Lock from "~icons/ep/lock";

defineOptions({ name: "AccessToken" });

const { t } = useI18n();
const loading = ref(false);
const dataList = ref<RecordType[]>([]);
const dialogVisible = ref(false);

/** 创建后明文仅展示一次：弹层 + 复制按钮，关闭即不再可见 */
const plainToken = ref("");

const form = reactive({ name: "", expired_at: null });

const columns = computed(() => [
  { prop: "name", label: t("accessToken.name") },
  { prop: "token_prefix", label: t("accessToken.prefix") },
  { prop: "scopes", label: t("accessToken.scope") },
  { prop: "is_active", label: t("accessToken.active") },
  { prop: "expired_at", label: t("accessToken.expiredAt") },
  { prop: "last_used_time", label: t("accessToken.lastUsed") },
  { prop: "created_time", label: t("accessToken.createdTime") }
]);

const fetchList = () => {
  loading.value = true;
  personalAccessTokenApi
    .list()
    .then((res: ListResult) => {
      if (res.code === 1000 && res.data) {
        dataList.value = res.data.results;
      }
    })
    .catch(() => {
      // 失败提示由 http 拦截器统一处理，这里兜住 reject
      dataList.value = [];
    })
    .finally(() => {
      loading.value = false;
    });
};

const copyToken = async () => {
  try {
    // clipboard API 仅在安全上下文（https/localhost）可用，非安全上下文降级
    if (!navigator.clipboard?.writeText)
      throw new Error("clipboard unavailable");
    await navigator.clipboard.writeText(plainToken.value);
    message(t("accessToken.copied"), { type: "success" });
  } catch {
    message(t("accessToken.copyFailed"), { type: "error" });
  }
};

const handleCreate = () => {
  handleOperation({
    t,
    apiReq: personalAccessTokenApi.create({
      name: form.name,
      expired_at: form.expired_at || null
    }),
    success: (res: DetailResult) => {
      plainToken.value = String(res.data.token ?? "");
      dialogVisible.value = true;
      form.name = "";
      form.expired_at = null;
      fetchList();
    }
  });
};

const handleRevoke = (row: RecordType) => {
  handleOperation({
    t,
    apiReq: personalAccessTokenApi.partialUpdate(row.pk, { is_active: false }),
    success: () => fetchList()
  });
};

const handleDelete = (row: RecordType) => {
  handleOperation({
    t,
    apiReq: personalAccessTokenApi.destroy(row.pk),
    success: () => fetchList()
  });
};

/** scope 编辑：多行路径前缀/正则，一行一条（空 = 不限）。SFC 内不用 JSX，用 h() */
const openScopeEditor = (row: RecordType) => {
  const scopeForm = reactive({
    scopes: (row.scopes ?? []).join("\n")
  });
  addDialog({
    title: t("accessToken.scope"),
    width: "480px",
    draggable: true,
    destroyOnClose: true,
    closeOnClickModal: false,
    contentRenderer: () =>
      h("div", null, [
        h(ElInput, {
          type: "textarea",
          rows: 6,
          modelValue: scopeForm.scopes,
          "onUpdate:modelValue": (value: string) => (scopeForm.scopes = value),
          placeholder: t("accessToken.scopePlaceholder")
        }),
        h(
          "div",
          { class: "el-form-item__help w-full! mt-1" },
          t("accessToken.scopeTip")
        )
      ]),
    beforeSure: (done, { closeLoading }) => {
      const scopes = scopeForm.scopes
        .split("\n")
        .map(item => item.trim())
        .filter(Boolean);
      handleOperation({
        t,
        apiReq: personalAccessTokenApi.partialUpdate(row.pk, { scopes }),
        success: () => {
          done();
          fetchList();
        },
        // 确定按钮 loading 收口：失败保持弹窗可重试，避免重复点击
        requestEnd: closeLoading
      });
    }
  });
};

/** 调用记录弹窗：内容组件自发起请求（近似口径说明见弹窗内提示） */
const openCallLogs = (row: RecordType) => {
  addDialog({
    title: `${t("accessToken.callLogs")} - ${row.name}`,
    width: "720px",
    draggable: true,
    destroyOnClose: true,
    closeOnClickModal: false,
    contentRenderer: () => h(PatCallLogs, { pk: row.pk })
  });
};

onMounted(fetchList);
</script>

<template>
  <div class="max-w-215">
    <h3 class="my-8!">{{ t("accessToken.title") }}</h3>
    <el-alert
      type="info"
      :closable="false"
      :title="t('accessToken.tip')"
      class="mb-4"
    />
    <el-form inline class="mb-4">
      <el-form-item :label="t('accessToken.name')">
        <el-input
          v-model="form.name"
          :placeholder="t('accessToken.nameRule')"
          maxlength="128"
          class="w-200px!"
        />
      </el-form-item>
      <el-form-item :label="t('accessToken.expiredAt')">
        <el-date-picker
          v-model="form.expired_at"
          type="datetime"
          value-format="YYYY-MM-DDTHH:mm:ss"
          :placeholder="t('accessToken.neverExpire')"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :disabled="!form.name" @click="handleCreate">
          {{ t("accessToken.create") }}
        </el-button>
      </el-form-item>
    </el-form>

    <el-table v-loading="loading" :data="dataList" size="default" border>
      <el-table-column
        v-for="column in columns"
        :key="column.prop"
        :prop="column.prop"
        :label="column.label"
      >
        <template v-if="column.prop === 'is_active'" #default="{ row }">
          <el-tag :type="row.is_active ? 'success' : 'danger'" size="small">
            {{ row.is_active ? t("labels.enable") : t("labels.disable") }}
          </el-tag>
        </template>
        <template v-else-if="column.prop === 'scopes'" #default="{ row }">
          <el-tag v-if="(row.scopes ?? []).length" size="small" type="info">
            {{ t("accessToken.scopeCount", { n: row.scopes.length }) }}
          </el-tag>
          <span v-else>{{ t("accessToken.scopeUnrestricted") }}</span>
        </template>
        <template v-else #default="{ row }">
          {{ row[column.prop] ?? "—" }}
        </template>
      </el-table-column>
      <el-table-column
        :label="t('labels.operations')"
        width="170"
        fixed="right"
      >
        <template #default="{ row }">
          <el-button
            v-if="row.is_active"
            type="warning"
            link
            @click="handleRevoke(row)"
          >
            {{ t("accessToken.revoke") }}
          </el-button>
          <el-button
            type="primary"
            link
            :title="t('accessToken.scope')"
            @click="openScopeEditor(row)"
          >
            <IconifyIconOffline :icon="Lock" />
          </el-button>
          <el-button
            type="primary"
            link
            :title="t('accessToken.callLogs')"
            @click="openCallLogs(row)"
          >
            <IconifyIconOffline :icon="Document" />
          </el-button>
          <el-button type="danger" link @click="handleDelete(row)">
            <IconifyIconOffline :icon="Delete" />
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog
      v-model="dialogVisible"
      :title="t('accessToken.createdTitle')"
      width="520px"
      @closed="plainToken = ''"
    >
      <el-alert
        type="warning"
        :closable="false"
        :title="t('accessToken.onceTip')"
        class="mb-3"
      />
      <code class="block break-all rounded bg-gray-100 p-2 dark:bg-gray-800">
        {{ plainToken }}
      </code>
      <template #footer>
        <el-button type="primary" @click="copyToken">
          {{ t("accessToken.copy") }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>
