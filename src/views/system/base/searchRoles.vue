<script lang="ts" setup>
import dayjs from "dayjs";
import { useI18n } from "vue-i18n";
import { ReTableSearch } from "@/components/ReTableSearch";
import { getRoleListApi } from "@/api/system/role";
import { ref } from "vue";

const { t } = useI18n();

const selectValue = defineModel({ type: Array<number> });
const showColumns = ref<TableColumnList>([
  {
    label: "ID",
    prop: "pk",
    width: 80
  },
  {
    label: t("role.name"),
    prop: "name"
  },
  {
    label: t("role.code"),
    prop: "code"
  },
  {
    label: t("labels.status"),
    prop: "is_active",
    formatter: ({ is_active }) =>
      is_active ? t("labels.active") : t("labels.inactive")
  },
  {
    label: t("sorts.createdDate"),
    minWidth: 180,
    prop: "createTime",
    formatter: ({ created_time }) =>
      dayjs(created_time).format("YYYY-MM-DD HH:mm:ss")
  }
]);

const searchKeys = [
  {
    key: "name",
    label: t("role.name")
  },
  {
    key: "code",
    label: t("role.code")
  }
];
</script>

<template>
  <re-table-search
    v-model="selectValue"
    :getListApi="getRoleListApi"
    :showColumns="showColumns"
    :searchKeys="searchKeys"
  />
</template>
