<script lang="ts" setup>
import dayjs from "dayjs";
import { useI18n } from "vue-i18n";
import { ReTableSearch } from "@/components/ReTableSearch";
import { ref } from "vue";
import { hasGlobalAuth } from "@/router/utils";
import { searchRoleListApi } from "@/api/system/search";
import { formatColumnsLabel } from "@/views/system/hooks";

defineOptions({ name: "searchRoles" });

const emit = defineEmits<{
  (e: "change", ...args: any[]): void;
}>();

const { t, te } = useI18n();

const selectValue = defineModel({ type: Array<number> });
const showColumns = ref<TableColumnList>([
  {
    prop: "pk",
    width: 80
  },
  {
    prop: "name"
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
    minWidth: 180,
    prop: "created_time",
    formatter: ({ created_time }) =>
      dayjs(created_time).format("YYYY-MM-DD HH:mm:ss")
  }
]);
formatColumnsLabel(showColumns.value, t, te, "systemRole");

const searchKeys = [
  {
    key: "name",
    label: t("systemRole.name")
  },
  {
    key: "code",
    label: t("systemRole.code")
  }
];
</script>

<template>
  <re-table-search
    v-if="hasGlobalAuth('list:systemSearchRoles')"
    v-model="selectValue"
    :getListApi="searchRoleListApi"
    :searchKeys="searchKeys"
    :showColumns="showColumns"
    @change="
      value => {
        emit('change', value);
      }
    "
  />
</template>
