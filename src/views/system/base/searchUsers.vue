<script lang="ts" setup>
import { hideTextAtIndex } from "@pureadmin/utils";
import dayjs from "dayjs";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
import {
  FormItemEmits,
  FormItemProps
} from "@/components/ReTableSearch/src/types";
import { getUserListApi } from "@/api/system/user";
import { ReTableSearch } from "@/components/ReTableSearch";
import { computed } from "vue";

const props = withDefaults(defineProps<FormItemProps>(), {
  selectValue: () => []
});

const emit = defineEmits<FormItemEmits>();

const selectValue = computed({
  get() {
    return props.selectValue;
  },
  set(val: Array<number>) {
    emit("update:selectValue", val);
  }
});

const showColumns: TableColumnList = [
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
    prop: "dept_info"
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
];

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
    v-model:selectValue="selectValue"
    :getListApi="getUserListApi"
    :showColumns="showColumns"
    :searchKeys="searchKeys"
  />
</template>
