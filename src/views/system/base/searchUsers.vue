<script lang="ts" setup>
import { hideTextAtIndex } from "@pureadmin/utils";
import dayjs from "dayjs";
import { useI18n } from "vue-i18n";
import { ReTableSearch } from "@/components/ReTableSearch";
import { ref } from "vue";
import { hasGlobalAuth } from "@/router/utils";
import { searchUserListApi } from "@/api/system/search";

const { t } = useI18n();

const selectValue = defineModel({ type: Array<number> });

const showColumns = ref<TableColumnList>([
  {
    label: "ID",
    prop: "pk",
    width: 80
  },
  {
    label: t("user.username"),
    prop: "username"
  },
  {
    label: t("user.nickname"),
    prop: "nickname"
  },
  {
    label: t("user.gender"),
    prop: "gender_display"
  },
  {
    label: t("labels.status"),
    prop: "is_active",
    formatter: ({ is_active }) =>
      is_active ? t("labels.active") : t("labels.inactive")
  },
  {
    label: t("user.dept"),
    prop: "dept_info",
    formatter: ({ dept_info }) => {
      return dept_info?.name;
    }
  },
  {
    label: t("user.mobile"),
    prop: "mobile",
    formatter: ({ mobile }) => hideTextAtIndex(mobile, { start: 3, end: 6 })
  },
  {
    label: t("user.registrationDate"),
    prop: "date_joined",
    formatter: ({ date_joined }) =>
      dayjs(date_joined).format("YYYY-MM-DD HH:mm:ss")
  }
]);

const searchKeys = [
  {
    key: "username",
    label: t("user.username")
  },
  {
    key: "nickname",
    label: t("user.nickname")
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
