import Sortable from "sortablejs";
import { transformI18n } from "@/plugins/i18n";
import { useEpThemeStoreHook } from "@/store/modules/epTheme";
import {
  computed,
  defineComponent,
  getCurrentInstance,
  nextTick,
  type PropType,
  ref,
  unref,
  watch
} from "vue";
import {
  cloneDeep,
  delay,
  getKeyList,
  isBoolean,
  isFunction
} from "@pureadmin/utils";

import Fullscreen from "~icons/ri/fullscreen-fill";
import ExitFullscreen from "~icons/ri/fullscreen-exit-fill";
import DragIcon from "@/assets/table-bar/drag.svg?component";
import ExpandIcon from "@/assets/table-bar/expand.svg?component";
import RefreshIcon from "@/assets/table-bar/refresh.svg?component";
import SettingIcon from "@/assets/table-bar/settings.svg?component";
import CollapseIcon from "@/assets/table-bar/collapse.svg?component";
import { useI18n } from "vue-i18n";

const props = {
  /** 头部最左边的标题 */
  title: {
    type: String,
    default: "列表"
  },
  /** 对于树形表格，如果想启用展开和折叠功能，传入当前表格的ref即可 */
  tableRef: {
    type: Object as PropType<any>
  },
  /** 需要展示的列 */
  columns: {
    type: Array as PropType<TableColumnList>,
    default: () => []
  },
  isExpandAll: {
    type: Boolean,
    default: true
  },
  tableKey: {
    type: [String, Number] as PropType<string | number>,
    default: "0"
  }
};

export default defineComponent({
  name: "PureTableBar",
  props,
  emits: ["refresh", "fullscreen", "change"],
  setup(props, { emit, slots, attrs }) {
    const size = ref("default");
    const loading = ref(false);
    const checkAll = ref(true);
    const isFullscreen = ref(false);
    const isIndeterminate = ref(false);
    const instance = getCurrentInstance()!;
    const isExpandAll = ref(props.isExpandAll);
    const filterColumns = computed(() => {
      return cloneDeep(props?.columns).filter(column =>
        isBoolean(column?.hide)
          ? !column.hide
          : !(isFunction(column?.hide) && column?.hide())
      );
    });
    const checkedColumns = ref(
      getKeyList(cloneDeep(filterColumns.value ?? []), "label")
    );
    const checkColumnList = ref(
      getKeyList(cloneDeep(props?.columns ?? []), "label")
    );
    const dynamicColumns = ref(cloneDeep(props?.columns));
    const { t } = useI18n();

    const getDropdownItemStyle = computed(() => {
      return s => {
        return {
          background:
            s === size.value ? useEpThemeStoreHook().epThemeColor : "",
          color: s === size.value ? "#fff" : "var(--el-text-color-primary)"
        };
      };
    });

    const iconClass = computed(() => {
      return [
        "text-black",
        "dark:text-white",
        "duration-100",
        "hover:text-primary!",
        "cursor-pointer",
        "outline-hidden"
      ];
    });

    const topClass = computed(() => {
      return [
        "flex",
        "justify-between",
        "pt-[3px]",
        "px-[11px]",
        "border-b-[1px]",
        "border-b-solid",
        "border-[#dcdfe6]",
        "dark:border-[#303030]"
      ];
    });

    const renderClass = computed(() => {
      return [
        "w-99/100",
        "px-2",
        "pb-2",
        "bg-bg_color",
        isFullscreen.value
          ? ["w-full!", "h-full!", "z-2002", "fixed", "inset-0"]
          : "mt-2"
      ];
    });

    function onReFresh() {
      loading.value = true;
      emit("refresh");
      delay(500).then(() => (loading.value = false));
    }

    function onExpand() {
      isExpandAll.value = !isExpandAll.value;
      toggleRowExpansionAll(props.tableRef.data, isExpandAll.value);
    }

    function onFullscreen() {
      isFullscreen.value = !isFullscreen.value;
      emit("fullscreen", isFullscreen.value);
    }

    function toggleRowExpansionAll(data, isExpansion) {
      data.forEach(item => {
        props.tableRef.toggleRowExpansion(item, isExpansion);
        if (item.children !== undefined && item.children !== null) {
          toggleRowExpansionAll(item.children, isExpansion);
        }
      });
    }

    function handleCheckAllChange(val: boolean) {
      checkedColumns.value = val ? checkColumnList.value : [];
      isIndeterminate.value = false;
      dynamicColumns.value.map(column =>
        val ? (column.hide = false) : (column.hide = true)
      );
    }

    function handleCheckedColumnsChange(value: string[]) {
      checkedColumns.value = value;
      const checkedCount = value.length;
      checkAll.value = checkedCount === checkColumnList.value.length;
      isIndeterminate.value =
        checkedCount > 0 && checkedCount < checkColumnList.value.length;
    }

    function handleCheckColumnListChange(val: boolean, label: string) {
      dynamicColumns.value.filter(
        item => transformI18n(item.label) === transformI18n(label)
      )[0].hide = !val;
    }

    async function onReset() {
      checkAll.value = true;
      isIndeterminate.value = false;
      dynamicColumns.value = cloneDeep(props?.columns);
      checkColumnList.value = getKeyList(
        cloneDeep(props?.columns ?? []),
        "label"
      );
      checkedColumns.value = getKeyList(
        cloneDeep(filterColumns.value),
        "label"
      );
    }

    const handleChange = () => {
      emit("change", {
        dynamicColumns: dynamicColumns.value,
        size: size.value,
        renderClass: slots?.default ? "" : renderClass.value
      });
    };

    watch(props?.columns, () => {
      onReset();
    });

    watch(
      () => [dynamicColumns.value, renderClass.value],
      () => {
        handleChange();
      },
      { deep: true, immediate: true }
    );

    const sizeChange = (event, val) => {
      event.stopPropagation();
      size.value = val;
      handleChange();
    };
    const dropdown = {
      dropdown: () => (
        <el-dropdown-menu class="translation" teleported={false}>
          <el-dropdown-item
            style={getDropdownItemStyle.value("large")}
            onClick={event => sizeChange(event, "large")}
          >
            {t("tableBar.loose")}
          </el-dropdown-item>
          <el-dropdown-item
            style={getDropdownItemStyle.value("default")}
            onClick={event => sizeChange(event, "default")}
          >
            {t("tableBar.default")}
          </el-dropdown-item>
          <el-dropdown-item
            style={getDropdownItemStyle.value("small")}
            onClick={event => sizeChange(event, "small")}
          >
            {t("tableBar.compact")}
          </el-dropdown-item>
        </el-dropdown-menu>
      )
    };

    /** 列展示拖拽排序 */
    const rowDrop = (event: { preventDefault: () => void }) => {
      event.preventDefault();
      nextTick(() => {
        const wrapper: HTMLElement = (
          instance?.proxy?.$refs[`GroupRef${unref(props.tableKey)}`] as any
        ).$el.firstElementChild;
        Sortable.create(wrapper, {
          animation: 300,
          handle: ".drag-btn",
          onEnd: ({ newIndex, oldIndex, item }) => {
            const targetThElem = item;
            const wrapperElem = targetThElem.parentNode as HTMLElement;
            const oldColumn = dynamicColumns.value[oldIndex];
            const newColumn = dynamicColumns.value[newIndex];
            if (oldColumn?.fixed || newColumn?.fixed) {
              // 当前列存在fixed属性 则不可拖拽
              const oldThElem = wrapperElem.children[oldIndex] as HTMLElement;
              if (newIndex > oldIndex) {
                wrapperElem.insertBefore(targetThElem, oldThElem);
              } else {
                wrapperElem.insertBefore(
                  targetThElem,
                  oldThElem ? oldThElem.nextElementSibling : oldThElem
                );
              }
              return;
            }
            const currentRow = dynamicColumns.value.splice(oldIndex, 1)[0];
            dynamicColumns.value.splice(newIndex, 0, currentRow);
          }
        });
      });
    };

    const isFixedColumn = (label: string) => {
      return dynamicColumns.value.filter(
        item => transformI18n(item.label) === transformI18n(label)
      )[0].fixed;
    };

    const rendTippyProps = (content: string) => {
      // https://vue-tippy.netlify.app/props
      return {
        content,
        offset: [0, 18],
        duration: [300, 0],
        followCursor: true,
        hideOnClick: "toggle"
      };
    };

    const reference = {
      reference: () => (
        <SettingIcon
          class={["w-[16px]", iconClass.value]}
          v-tippy={rendTippyProps(t("tableBar.columnSettings"))}
        />
      )
    };

    return () => (
      <>
        <div {...attrs} class={[slots?.default ? renderClass.value : ""]}>
          <div class="flex justify-between w-full h-[60px] p-4">
            {slots?.title ? (
              slots.title()
            ) : (
              <p class="font-bold truncate">{props.title}</p>
            )}
            <div class="flex items-center justify-around">
              {slots?.buttons ? (
                <div class="flex mr-4">{slots.buttons()}</div>
              ) : null}
              {props.tableRef?.size ? (
                <>
                  <ExpandIcon
                    class={["w-[16px]", iconClass.value]}
                    style={{
                      transform: isExpandAll.value ? "none" : "rotate(-90deg)"
                    }}
                    v-tippy={rendTippyProps(
                      isExpandAll.value
                        ? t("tableBar.fold")
                        : t("tableBar.unfold")
                    )}
                    onClick={() => onExpand()}
                  />
                  <el-divider direction="vertical" />
                </>
              ) : null}
              <RefreshIcon
                class={[
                  "w-[16px]",
                  iconClass.value,
                  loading.value ? "animate-spin" : ""
                ]}
                v-tippy={rendTippyProps(t("tableBar.refresh"))}
                onClick={() => onReFresh()}
              />
              <el-divider direction="vertical" />
              <el-dropdown
                v-slots={dropdown}
                trigger="click"
                v-tippy={rendTippyProps(t("tableBar.density"))}
              >
                <CollapseIcon class={["w-[16px]", iconClass.value]} />
              </el-dropdown>
              <el-divider direction="vertical" />

              <el-popover
                v-slots={reference}
                placement="bottom-start"
                popper-style={{ padding: 0 }}
                width="200"
                trigger="click"
              >
                <div class={[topClass.value]}>
                  <el-checkbox
                    class="-mr-1!"
                    label={t("tableBar.columnDisplay")}
                    v-model={checkAll.value}
                    indeterminate={isIndeterminate.value}
                    onChange={value => handleCheckAllChange(value)}
                  />
                  <el-button type="primary" link onClick={() => onReset()}>
                    {t("buttons.reset")}
                  </el-button>
                </div>

                <div class="pt-[6px] pl-[11px]">
                  <el-scrollbar max-height="36vh">
                    <el-checkbox-group
                      ref={`GroupRef${unref(props.tableKey)}`}
                      modelValue={checkedColumns.value}
                      onChange={value => handleCheckedColumnsChange(value)}
                    >
                      <el-space
                        direction="vertical"
                        alignment="flex-start"
                        size={0}
                      >
                        {checkColumnList.value.map((item, index) => {
                          return (
                            <div class="flex items-center">
                              <DragIcon
                                class={[
                                  "drag-btn w-[16px] mr-2",
                                  isFixedColumn(item)
                                    ? "cursor-no-drop!"
                                    : "cursor-grab!"
                                ]}
                                onMouseenter={(event: {
                                  preventDefault: () => void;
                                }) => rowDrop(event)}
                              />
                              <el-checkbox
                                key={index}
                                label={item}
                                value={item}
                                onChange={value =>
                                  handleCheckColumnListChange(value, item)
                                }
                              >
                                <span
                                  title={transformI18n(item)}
                                  class="inline-block w-[120px] truncate hover:text-text_color_primary"
                                >
                                  {transformI18n(item)}
                                </span>
                              </el-checkbox>
                            </div>
                          );
                        })}
                      </el-space>
                    </el-checkbox-group>
                  </el-scrollbar>
                </div>
              </el-popover>
              <el-divider direction="vertical" />

              <iconifyIconOffline
                class={["w-[16px]", iconClass.value]}
                icon={isFullscreen.value ? ExitFullscreen : Fullscreen}
                v-tippy={
                  isFullscreen.value
                    ? t("tableBar.exitFullscreen")
                    : t("tableBar.fullscreen")
                }
                onClick={() => onFullscreen()}
              />
            </div>
          </div>
          {slots?.default &&
            slots?.default({
              size: size.value,
              dynamicColumns: dynamicColumns.value
            })}
        </div>
      </>
    );
  }
});
