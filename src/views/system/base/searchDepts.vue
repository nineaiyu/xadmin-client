<script lang="ts" setup>
import dayjs from "dayjs";
import { useI18n } from "vue-i18n";
import { ReTableSearch } from "@/components/ReTableSearch";
import { searchDeptListApi } from "@/api/system/search";
import { ref } from "vue";
import { hasGlobalAuth } from "@/router/utils";

const { t } = useI18n();

const selectValue = defineModel({ type: Array<number> });

const showColumns = ref<TableColumnList>([
  {
    label: t("dept.name"),
    prop: "name",
    align: "left",
    minWidth: 300
  },
  {
    label: t("labels.id"),
    prop: "pk"
  },
  {
    label: t("dept.code"),
    prop: "code"
  },
  {
    label: t("labels.status"),
    prop: "is_active",
    formatter: ({ is_active }) =>
      is_active ? t("labels.active") : t("labels.inactive")
  },
  {
    label: t("dept.userCount"),
    prop: "user_count"
  },
  {
    label: t("dept.autoBind"),
    prop: "mobile",
    formatter: ({ auto_bind }) =>
      auto_bind ? t("labels.enable") : t("labels.disable")
  },
  {
    label: t("sorts.createdDate"),
    prop: "createTime",
    formatter: ({ created_time }) =>
      dayjs(created_time).format("YYYY-MM-DD HH:mm:ss")
  }
]);

const searchKeys = [
  {
    key: "name",
    label: t("dept.name")
  },
  {
    key: "code",
    label: t("dept.code")
  }
];
</script>

<template>
  <re-table-search
    v-if="hasGlobalAuth('list:systemSearchDepts')"
    v-model="selectValue"
    :getListApi="searchDeptListApi"
    :isTree="true"
    :searchKeys="searchKeys"
    :showColumns="showColumns"
  />
</template>
