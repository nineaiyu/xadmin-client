<script lang="ts" setup>
import dayjs from "dayjs";
import { useI18n } from "vue-i18n";
import {
  FormItemEmits,
  FormItemProps
} from "@/components/ReTableSearch/src/types";
import { ReTableSearch } from "@/components/ReTableSearch";
import { computed } from "vue";
import { getMenuListApi } from "@/api/system/menu";
import { transformI18n } from "@/plugins/i18n";

const { t } = useI18n();

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
    label: t("menu.title"),
    prop: "title",
    formatter: ({ meta }) => {
      return transformI18n(meta.title);
    },
    align: "left",
    minWidth: 300
  },
  {
    label: t("labels.id"),
    prop: "pk"
  },
  {
    label: t("menu.type"),
    prop: "menu_type_display",
    width: 90
  },
  {
    label: t("menu.componentPath"),
    prop: "path",
    width: 90
  },
  {
    label: t("labels.status"),
    prop: "is_active",
    formatter: ({ is_active }) =>
      is_active ? t("labels.active") : t("labels.inactive"),
    width: 90
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
    key: "title",
    label: t("menu.title")
  },
  {
    key: "path",
    label: t("menu.componentPath")
  }
];

const sortOptions = [
  {
    label: `${t("sorts.rank")} ${t("labels.descending")}`,
    key: "-rank"
  },
  {
    label: `${t("sorts.rank")} ${t("labels.ascending")}`,
    key: "rank"
  },
  {
    label: `${t("sorts.createdDate")} ${t("labels.descending")}`,
    key: "-created_time"
  },
  {
    label: `${t("sorts.createdDate")} ${t("labels.ascending")}`,
    key: "created_time"
  }
];
</script>

<template>
  <re-table-search
    v-model:selectValue="selectValue"
    :isTree="true"
    :getListApi="getMenuListApi"
    :showColumns="showColumns"
    :searchKeys="searchKeys"
    :sortOptions="sortOptions"
  />
</template>
