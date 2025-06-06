<script lang="ts" setup>
import { h, reactive } from "vue";
import { hasAuth } from "@/router/utils";
import { searchMenuApi } from "@/api/system/search";
import RePlusSearch from "@/components/RePlusSearch";
import { transformI18n } from "@/plugins/i18n";

defineOptions({ name: "SearchMenu" });

const emit = defineEmits<{
  change: [...args: any[]];
}>();

const selectValue = defineModel<object | object[] | string>();
const { multiple = true } = defineProps<{ multiple?: boolean }>();

const api = reactive(searchMenuApi);
const baseColumnsFormat = ({ listColumns }) => {
  listColumns.value.forEach(column => {
    if (["pk", "is_active", "method"].indexOf(column._column.key) > -1) {
      column["width"] = 80;
    }
    if (column._column.key === "title") {
      column["width"] = 200;
      column["align"] = "left";
      column["cellRenderer"] = ({ row }) => {
        return h("span", transformI18n(row?.title));
      };
    }
  });
};
</script>

<template>
  <RePlusSearch
    v-if="hasAuth('list:SearchMenu')"
    v-model="selectValue"
    :multiple="multiple"
    locale-name="systemMenu"
    :baseColumnsFormat="baseColumnsFormat"
    :api="api"
    :isTree="true"
    :valueProps="{
      value: 'pk',
      label: row => {
        return transformI18n(row.title);
      }
    }"
    @change="
      value => {
        emit('change', value);
      }
    "
  />
</template>
