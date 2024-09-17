<script lang="ts" setup>
import { onMounted, ref } from "vue";

import { systemMsgSubscriptionApi } from "@/api/system/notifications";
import { handleOperation, openFormDialog } from "@/components/RePlusCRUD";
import { useI18n } from "vue-i18n";
import SearchDialog from "@/views/system/components/SearchDialog.vue";

defineOptions({
  name: "SettingNotifications"
});
const { t } = useI18n();
const tableData = ref([]);
const receiveBackends = ref([]);
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
  systemMsgSubscriptionApi.list().then(res => {
    formatCategory(res.data);
  });
  systemMsgSubscriptionApi.backends().then(res => {
    receiveBackends.value = res.data;
  });
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
    apiReq: systemMsgSubscriptionApi.patch(row.pk, {
      receive_backends: backends
    })
  });
};

const handleSaveReceivers = row => {
  openFormDialog({
    t,
    title: `修改 ${row.value} 的消息接收人`,
    rawRow: {
      component: "SearchUser",
      data: row.receivers
    },
    dialogOptions: { width: "600px" },
    form: SearchDialog,
    saveCallback: ({ formData, done, closeLoading }) => {
      handleOperation({
        t,
        apiReq: systemMsgSubscriptionApi.patch(row.pk, {
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
  <el-table :data="tableData" :stripe="true" default-expand-all row-key="pk">
    <el-table-column label="消息类型" width="230">
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
            @change="onCheckReceiveBackend(row)"
          />
          <el-checkbox v-else :disabled="true" :model-value="true" />
        </span>
      </template>
    </el-table-column>
    <el-table-column label="接收人" show-overflow-tooltip>
      <template #default="{ row }">
        <span v-if="!row.children">
          {{
            row.receivers
              .map(item => `${item.nickname}(${item.label})`)
              .join(", ")
          }}
        </span>
      </template>
    </el-table-column>
    <el-table-column label="操作" width="200">
      <template v-slot="{ row }">
        <el-button v-if="!row.children" @click="handleSaveReceivers(row)">
          修改消息接收人
        </el-button>
      </template>
    </el-table-column>
  </el-table>
</template>
