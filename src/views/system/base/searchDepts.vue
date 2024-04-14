<script lang="ts" setup>
import dayjs from "dayjs";
import { useI18n } from "vue-i18n";
import { ReTableSearch } from "@/components/ReTableSearch";
import { searchDeptListApi } from "@/api/system/search";
import { ref } from "vue";
import { hasGlobalAuth } from "@/router/utils";
import { formatColumnsLabel } from "@/views/system/hooks";

defineOptions({ name: "searchDepts" });
const { t, te } = useI18n();

const selectValue = defineModel({ type: Array<number> });

const showColumns = ref<TableColumnList>([
  {
    prop: "name",
    align: "left"
  },
  {
    prop: "pk"
  },
  {
    prop: "code"
  },
  {
    prop: "is_active",
    formatter: ({ is_active }) =>
      is_active ? t("labels.active") : t("labels.inactive")
  },
  {
    prop: "user_count"
  },
  {
    prop: "auto_bind",
    formatter: ({ auto_bind }) =>
      auto_bind ? t("labels.enable") : t("labels.disable")
  },
  {
    prop: "created_time",
    formatter: ({ created_time }) =>
      dayjs(created_time).format("YYYY-MM-DD HH:mm:ss")
  }
]);
formatColumnsLabel(showColumns.value, t, te, "systemDept");

const searchKeys = [
  {
    key: "name",
    label: t("systemDept.name")
  },
  {
    key: "code",
    label: t("systemDept.code")
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
