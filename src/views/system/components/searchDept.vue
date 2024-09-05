<script lang="ts" setup>
import { reactive } from "vue";
import { hasAuth } from "@/router/utils";
import { searchDeptApi } from "@/api/system/search";
import RePlusSearch from "@/components/RePlusSearch";

defineOptions({ name: "searchDept" });

const emit = defineEmits<{
  (e: "change", ...args: any[]): void;
}>();

const selectValue = defineModel({ type: Array<object> });

const api = reactive(searchDeptApi);

const baseColumnsFormat = ({ listColumns }) => {
  listColumns.value.forEach(column => {
    if (
      ["pk", "is_active", "code", "user_count"].indexOf(column._column.key) > -1
    ) {
      column["width"] = 80;
    }
    if (column._column.key === "name") {
      column["width"] = 200;
      column["align"] = "left";
    }
  });
};
</script>

<template>
  <RePlusSearch
    v-if="hasAuth('list:systemSearchDept')"
    v-model="selectValue"
    locale-name="systemDept"
    :baseColumnsFormat="baseColumnsFormat"
    :api="api"
    :isTree="true"
    :valueProps="{
      value: 'pk',
      label: 'name'
    }"
    @change="
      value => {
        emit('change', value);
      }
    "
  />
</template>
