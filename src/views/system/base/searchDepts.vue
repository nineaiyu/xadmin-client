<script lang="ts" setup>
import { hideTextAtIndex } from "@pureadmin/utils";
import dayjs from "dayjs";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
import {
  FormItemEmits,
  FormItemProps
} from "@/components/ReTableSearch/src/types";
import { ReTableSearch } from "@/components/ReTableSearch";
import { computed } from "vue";
import { getDeptListApi } from "@/api/system/dept";

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
    label: t("dept.name"),
    prop: "name"
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
];

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
    v-model:selectValue="selectValue"
    :isTree="true"
    :getListApi="getDeptListApi"
    :showColumns="showColumns"
    :searchKeys="searchKeys"
  />
</template>
