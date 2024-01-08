<script lang="ts" setup>
import dayjs from "dayjs";
import { useI18n } from "vue-i18n";
import { ReTableSearch } from "@/components/ReTableSearch";
import { getModelLabelFieldListApi } from "@/api/system/field";

const { t } = useI18n();

const selectValue = defineModel({ type: Array<number> });
const props = defineProps({
  parent: String
});
const showColumns: TableColumnList = [
  {
    label: "ID",
    prop: "pk",
    width: 80
  },
  {
    label: t("modelField.name"),
    prop: "name"
  },
  {
    label: t("modelField.label"),
    prop: "label"
  },
  {
    label: t("sorts.updatedDate"),
    prop: "updateTime",
    formatter: ({ created_time }) =>
      dayjs(created_time).format("YYYY-MM-DD HH:mm:ss")
  }
];

const searchKeys = [
  {
    key: "name",
    label: t("modelField.name")
  },
  {
    key: "label",
    label: t("modelField.label")
  },
  {
    key: "parent",
    value: props.parent
  }
];
</script>

<template>
  <re-table-search
    v-model="selectValue"
    :getListApi="getModelLabelFieldListApi"
    :searchKeys="searchKeys"
    :showColumns="showColumns"
  />
</template>
