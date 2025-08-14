<template>
  <div class="filter-field">
    <el-tag
      v-for="(v, k) in filterTags"
      :key="k"
      :disable-transitions="true"
      :type="tagType(v)"
      closable
      size="default"
      :class="{ 'tag-editing': editingIndex === k }"
      @click="handleTagClick(v, k)"
      @close="handleTagClose(v, k)"
    >
      {{ v }}
    </el-tag>
    <component
      :is="component"
      ref="SearchInput"
      v-model.trim="filterValue"
      :fetch-suggestions="autocomplete"
      :placeholder="iPlaceholder"
      :type="inputType"
      class="search-input"
      @blur="focus = false"
      @change="handleChange"
      @focus="focus = true"
      @select="handleSelect"
      @keyup.enter.prevent="handleConfirm"
    />
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from "vue";
import { debounce } from "@pureadmin/utils";
import { useI18n } from "vue-i18n";

interface TagInputProps {
  tagType?: Function;
  autocomplete?: boolean;
  placeholder?: string;
  inputType?: string;
}

defineOptions({ name: "TagInput" });

const filterTags = defineModel<Array<any>>({ default: [] });

const props = withDefaults(defineProps<TagInputProps>(), {
  tagType: () => "info",
  autocomplete: false,
  placeholder: undefined,
  inputType: "text"
});
const emit = defineEmits<{
  change: [values: any];
}>();

const SearchInput = ref(null);
const { t } = useI18n();

const focus = ref(false);
const filterValue = ref("");
const component = ref(
  computed(() => (props.autocomplete ? "el-autocomplete" : "el-input"))
);
const iPlaceholder = computed(
  () => props.placeholder ?? t("tagInput.placeholder")
);

// 当前正在编辑的标签索引
const editingIndex = ref(-1);

// 处理标签关闭
const handleTagClose = (tag, index) => {
  filterTags.value.splice(index, 1);
  // 如果正在编辑的标签被删除，重置编辑状态
  if (editingIndex.value === index) {
    editingIndex.value = -1;
    filterValue.value = "";
  }
  // 更新后续标签的索引
  else if (editingIndex.value > index) {
    editingIndex.value--;
  }
  emit("change", filterTags.value);
};

// 处理自动完成选择
const handleSelect = item => {
  filterTags.value = item.value;
  handleConfirm();
};

// 确认添加或修改标签
const handleConfirm = () => {
  if (filterValue.value === "") return;

  // 如果正在编辑某个标签
  if (editingIndex.value >= 0) {
    // 如果新值与旧值不同，且不与其他标签重复
    if (
      filterTags.value[editingIndex.value] !== filterValue.value &&
      !filterTags.value.includes(filterValue.value)
    ) {
      filterTags.value[editingIndex.value] = filterValue.value;
      emit("change", filterTags.value);
    }
  }
  // 否则是添加新标签
  else if (!filterTags.value.includes(filterValue.value)) {
    filterTags.value.push(filterValue.value);
    emit("change", filterTags.value);
  }

  // 重置状态
  filterValue.value = "";
  editingIndex.value = -1;
  SearchInput.value.focus();
};

// 处理输入变化
const handleChange = debounce(() => {
  handleConfirm();
}, 200);

// 处理标签点击 - 进入编辑模式
const handleTagClick = (value, index) => {
  // 设置正在编辑的标签索引
  editingIndex.value = index;
  // 将标签值放入输入框
  filterValue.value = value;
  // 聚焦到输入框
  SearchInput.value.focus();
};
</script>

<style lang="scss" scoped>
.el-tag + .el-tag {
  margin-left: 4px;
}

.filter-field {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  width: 100%;
  padding: 1px 2px;
  line-height: 30px;
  border-radius: var(--el-input-border-radius, var(--el-border-radius-base));
  box-shadow: 0 0 0 1px var(--el-input-border-color, var(--el-border-color));

  & ::v-deep(.el-tag) {
    margin-top: 1px;
    font-family: sans-serif !important;
    cursor: pointer;
  }

  & ::v-deep(.el-autocomplete) {
    height: 28px;
  }
}

.search-input {
  flex: 1;

  & ::v-deep(.el-input__inner) {
    max-width: 100%;
    padding-left: 10px;
    border: none;
  }
}

.el-input ::v-deep(.el-input__inner) {
  font-size: 13px;
  border: none !important;
  box-shadow: none !important;
}

::v-deep(.el-input__wrapper) {
  box-shadow: none !important;
}

.filter-field ::v-deep(.el-input__inner) {
  height: 28px;
}

.tag-editing {
  color: var(--el-color-primary) !important;
  background-color: var(--el-color-primary-light-8) !important;
  border-color: var(--el-color-primary) !important;
}
</style>
