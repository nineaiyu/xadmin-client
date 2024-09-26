<script lang="ts" setup>
import { onMounted, ref } from "vue";

import { SystemMsgSubscriptionApi } from "@/api/system/notifications";
import { handleOperation, openFormDialog } from "@/components/RePlusPage";
import { useI18n } from "vue-i18n";
import SearchDialog from "@/views/system/components/SearchDialog.vue";

defineOptions({
  name: "MessageNotifications"
});

interface NotificationsProps {
  api: SystemMsgSubscriptionApi;
  auth: {
    list: boolean;
    update: boolean;
    backends: boolean;
  };
  hasReceivers?: boolean;
  hasOperations?: boolean;
}

const props = withDefaults(defineProps<NotificationsProps>(), {
  api: undefined,
  auth: () => ({
    list: false,
    update: false,
    backends: false
  }),
  hasReceivers: false,
  hasOperations: false
});

const { t } = useI18n();
const tableData = ref([]);
const receiveBackends = ref([]);
const loading = ref(false);

const formatCategory = subscriptions => {
  tableData.value = [];
  for (const category of subscriptions) {
    const subItems = [];
    const item = {
      pk: category["category"],
      value: category["category_label"],
      children: subItems
    };

    for (const item of category["children"]) {
      const backendsChecked = {};
      receiveBackends.value.forEach(backend => {
        backendsChecked[backend.value] =
          item["receive_backends"].indexOf(backend.value) > -1;
      });

      const subItem = {
        pk: item["message_type"],
        value: item["message_type_label"],
        receivers: item.receivers,
        receiveBackends: backendsChecked
      };
      subItems.push(subItem);
    }
    tableData.value.push(item);
  }
};

const getInitData = () => {
  if (props.auth.backends) {
    props.api.backends().then(res => {
      receiveBackends.value = res.data;
    });
  }
  if (props.auth.list) {
    loading.value = true;
    props.api.list().then(res => {
      formatCategory(res.data);
      loading.value = false;
    });
  }
};

onMounted(() => {
  getInitData();
});

const onCheckReceiveBackend = row => {
  const backends = [];
  for (const [name, checked] of Object.entries(row.receiveBackends)) {
    if (checked) {
      backends.push(name);
    }
  }
  handleOperation({
    t,
    apiReq: props.api.patch(row.pk, {
      receive_backends: backends
    })
  });
};

const handleSaveReceivers = row => {
  openFormDialog({
    t,
    title: t("messageNotifications.editRecipientTitle", { title: row.value }),
    rawRow: {
      component: "SearchUser",
      data: row.receivers
    },
    dialogOptions: { width: "600px" },
    form: SearchDialog,
    saveCallback: ({ formData, done, closeLoading }) => {
      handleOperation({
        t,
        apiReq: props.api.patch(row.pk, {
          users: formData.data.map(r => r.pk)
        }),
        success({ data }) {
          done();
          tableData.value.forEach(i => {
            for (const item of i.children) {
              if (item.pk === data.message_type) {
                item.receivers = data.receivers;
                break;
              }
            }
          });
        },
        requestEnd() {
          closeLoading();
        }
      });
    }
  });
};
</script>

<template>
  <el-table
    v-loading="loading"
    :data="tableData"
    :stripe="true"
    default-expand-all
    row-key="pk"
  >
    <el-table-column
      :label="t('messageNotifications.messageType')"
      min-width="200"
    >
      <template #default="{ row }">
        <span>{{ row.value }}</span>
      </template>
    </el-table-column>
    <el-table-column
      v-for="header in receiveBackends"
      :key="header.value"
      :label="header.label"
      width="80"
    >
      <template #default="{ row }">
        <span v-if="!row.children">
          <el-checkbox
            v-if="header.value !== 'site_msg'"
            v-model="row.receiveBackends[header.value]"
            :disabled="!auth.update"
            @change="onCheckReceiveBackend(row)"
          />
          <el-checkbox v-else :disabled="true" :model-value="true" />
        </span>
      </template>
    </el-table-column>
    <el-table-column
      v-if="hasReceivers"
      :label="t('messageNotifications.receivers')"
      show-overflow-tooltip
    >
      <template #default="{ row }">
        <span v-if="!row.children">
          {{ row.receivers.map(item => item.label).join(", ") }}
        </span>
      </template>
    </el-table-column>
    <el-table-column
      v-if="auth.update && hasOperations"
      :label="t('commonLabels.operation')"
      width="200"
    >
      <template v-slot="{ row }">
        <el-button v-if="!row.children" @click="handleSaveReceivers(row)">
          {{ t("messageNotifications.editRecipient") }}
        </el-button>
      </template>
    </el-table-column>
  </el-table>
</template>
