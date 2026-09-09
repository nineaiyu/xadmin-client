<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import type { DetailResult, ListResult } from "@/api/types";
import { message } from "@/utils/message";
import { handleOperation } from "@/components/RePlusPage";
import { personalAccessTokenApi } from "@/api/user/token";
import Delete from "~icons/ep/delete";

defineOptions({ name: "AccessToken" });

const { t } = useI18n();
const loading = ref(false);
const dataList = ref([]);
const dialogVisible = ref(false);

/** 创建后明文仅展示一次：弹层 + 复制按钮，关闭即不再可见 */
const plainToken = ref("");

const form = reactive({ name: "", expired_at: null });

const columns = computed(() => [
  { prop: "name", label: t("accessToken.name") },
  { prop: "token_prefix", label: t("accessToken.prefix") },
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
      dataList.value = res.data.results;
    })
    .finally(() => {
      loading.value = false;
    });
};

const copyToken = async () => {
  await navigator.clipboard.writeText(plainToken.value);
  message(t("accessToken.copied"), { type: "success" });
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

const handleRevoke = row => {
  handleOperation({
    t,
    apiReq: personalAccessTokenApi.partialUpdate(row.pk, { is_active: false }),
    success: () => fetchList()
  });
};

const handleDelete = row => {
  handleOperation({
    t,
    apiReq: personalAccessTokenApi.destroy(row.pk),
    success: () => fetchList()
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
        <template v-else #default="{ row }">
          {{ row[column.prop] ?? "—" }}
        </template>
      </el-table-column>
      <el-table-column :label="t('labels.operate')" width="130" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="row.is_active"
            type="warning"
            link
            @click="handleRevoke(row)"
          >
            {{ t("accessToken.revoke") }}
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
