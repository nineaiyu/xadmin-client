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
import { getRoleListApi } from "@/api/system/role";

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
];

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
    v-model:selectValue="selectValue"
    :getListApi="getRoleListApi"
    :showColumns="showColumns"
    :searchKeys="searchKeys"
  />
</template>
