<script lang="ts" setup>
import { hideTextAtIndex } from "@pureadmin/utils";
import dayjs from "dayjs";
import { useI18n } from "vue-i18n";
import { ReTableSearch } from "@/components/ReTableSearch";
import { ref } from "vue";
import { hasGlobalAuth } from "@/router/utils";
import { searchUserListApi } from "@/api/system/search";
import { formatColumnsLabel } from "@/views/system/hooks";

defineOptions({ name: "searchUsers" });

const { t, te } = useI18n();

const selectValue = defineModel({ type: Array<number> });

const showColumns = ref<TableColumnList>([
  {
    prop: "pk",
    width: 80
  },
  {
    prop: "username"
  },
  {
    prop: "nickname"
  },
  {
    prop: "gender.label"
  },
  {
    prop: "is_active",
    formatter: ({ is_active }) =>
      is_active ? t("labels.active") : t("labels.inactive")
  },
  {
    prop: "dept",
    formatter: ({ dept }) => {
      return dept?.name;
    }
  },
  {
    prop: "mobile",
    formatter: ({ mobile }) => hideTextAtIndex(mobile, { start: 3, end: 6 })
  },
  {
    prop: "date_joined",
    formatter: ({ date_joined }) =>
      dayjs(date_joined).format("YYYY-MM-DD HH:mm:ss")
  }
]);
formatColumnsLabel(showColumns.value, t, te, "systemUser");

const searchKeys = [
  {
    key: "username",
    label: t("systemUser.username")
  },
  {
    key: "nickname",
    label: t("systemUser.nickname")
  }
];
</script>

<template>
  <re-table-search
    v-if="hasGlobalAuth('list:systemSearchUsers')"
    v-model="selectValue"
    :getListApi="searchUserListApi"
    :searchKeys="searchKeys"
    :showColumns="showColumns"
  />
</template>
