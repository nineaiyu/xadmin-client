import { computed, h } from "vue";
import { get } from "lodash-es";
import { isEmpty, isString } from "@pureadmin/utils";
import { ElIcon, ElImage, ElLink } from "element-plus";
import { Link } from "@element-plus/icons-vue";
import "vue-json-pretty/lib/styles.css";
import VueJsonPretty from "vue-json-pretty";
import { selectBooleanOptions } from "./constants";
import { formatAddOrEditOptions } from "./renders";
import { getColourTypeByIndex } from "./index";
import type { ChoiceOptionItem, PlusColumnRegistry } from "./types";

/**
 * 详情/表格列内置渲染器：input_type -> 对 PageColumn 就地配置
 * 迁移自 columns.tsx formatAddOrEditColumns 的第二个 switch-case
 * 注意：无匹配 input_type 时不做任何配置（与原 switch 无 default 分支一致）
 */
export const builtinDetailRenderers: PlusColumnRegistry = {
  labeled_choice: (item, { column }) => {
    item["prop"] = `${column.key}.value`;
    item["options"] = computed(() => formatAddOrEditOptions(column?.choices));
    // pure-table ******
    item["cellRenderer"] = ({ row }) => {
      const label = get(row, `${column.key}.label`);
      // 数据字典驱动选项（DictChoiceField）携带 color：渲染彩色 tag（列表数据
      // 与元数据 choices 均可能带 color，行内优先）；无 color 保持纯文本
      const color =
        get(row, `${column.key}.color`) ??
        (
          column?.choices as { value?: unknown; color?: string }[] | undefined
        )?.find?.(option => option?.value === get(row, `${column.key}.value`))
          ?.color;
      if (color) {
        return (
          <el-tag
            color={color as string}
            style={{ border: "none", color: "#fff" }}
            v-copy={label}
          >
            {label}
          </el-tag>
        );
      }
      return <span v-copy={label}>{label}</span>;
    };
  },
  object_related_field: (item, { column }) => {
    if (!isEmpty(column?.choices)) {
      item["prop"] = `${column.key}.pk`;
      item["options"] = computed(() => formatAddOrEditOptions(column?.choices));
    } else {
      item["valueType"] = "text";
      item["prop"] = `${column.key}.label`;
    }
    // pure-table ******
    item["cellRenderer"] = ({ row }) => (
      <span
        v-copy={get(row, `${column.key}.label`) ?? get(row, `${column.key}`)}
      >
        {get(row, `${column.key}.label`) ?? get(row, `${column.key}`)}
      </span>
    );
  },
  m2m_related_field: multipleListDetailRenderer,
  labeled_multiple_choice: multipleListDetailRenderer,
  json: (item, { column }) => {
    item["descriptionsItemProps"] = {
      span: 2
    };
    item["render"] = value => {
      let jsonValue = value;
      let stringValue = "";
      if (isString(value)) {
        stringValue = value;
        try {
          jsonValue = JSON.parse(value);
        } catch {
          try {
            stringValue = JSON.stringify(value);
          } catch {
            console.error("Cannot convert value to JSON string", value);
            stringValue = String(value);
          }
        }
      } else {
        try {
          stringValue = JSON.stringify(value);
          if (typeof jsonValue !== "object") {
            jsonValue = value;
          }
        } catch (error) {
          console.error("JSON.stringify error", error);
          stringValue = String(value);
        }
      }
      return (
        <el-scrollbar max-height="calc(100vh - 240px)">
          <VueJsonPretty data={jsonValue} v-copy={stringValue} />
        </el-scrollbar>
      );
    };
    // pure-table ******
    item["cellRenderer"] = ({ row }) => (
      <span>{JSON.stringify(row[column.key])}</span>
    );
  },
  object_related_field_image: (item, { column }) => {
    item["valueType"] = "img";
    item["formatter"] = ({ filepath }) => {
      return filepath;
    };
    // pure-table ******
    item["cellRenderer"] = ({ row }) =>
      h(ElImage, {
        lazy: true,
        class: "plus-display-item__image",
        src: row[column.key]?.filepath,
        alt: row[column.key]?.filename,
        previewSrcList: [row[column.key]?.filepath],
        previewTeleported: true
      });
  },
  object_related_field_file: (item, { column }) => {
    item["render"] = ({ filepath, filename }) => {
      return h(
        ElLink,
        {
          type: "success",
          href: filepath,
          target: "_blank"
        },
        {
          icon: () => h(ElIcon, null, () => h(Link)),
          default: () => filename ?? "文件连接"
        }
      );
    };
    // pure-table ******
    item["cellRenderer"] = ({ row }) =>
      h(
        ElLink,
        {
          type: "success",
          href: row[column.key]?.filepath,
          target: "_blank"
        },
        {
          icon: () => h(ElIcon, null, () => h(Link)),
          default: () => row[column.key]?.filename ?? "文件连接"
        }
      );
  },
  m2m_related_field_file: (item, { column }) => {
    item["render"] = (
      value: Array<{ pk: number; filepath: string; filename: string }>
    ) => {
      if (value instanceof Array) {
        return (
          <>
            <el-scrollbar>
              <el-space>
                {value?.map(item => {
                  return h(
                    ElLink,
                    {
                      type: "success",
                      href: item.filepath,
                      target: "_blank"
                    },
                    {
                      icon: () => h(ElIcon, null, () => h(Link)),
                      default: () => item.filename ?? "文件连接"
                    }
                  );
                })}
              </el-space>
            </el-scrollbar>
          </>
        );
      } else return <></>;
    };
    // pure-table ******
    item["cellRenderer"] = ({ row }) => (
      <>
        <el-scrollbar>
          <el-space>
            {row[column.key]?.map(item => {
              return h(
                ElLink,
                {
                  type: "success",
                  href: item.filepath,
                  target: "_blank"
                },
                {
                  icon: () => h(ElIcon, null, () => h(Link)),
                  default: () => item.filename ?? "文件连接"
                }
              );
            })}
          </el-space>
        </el-scrollbar>
      </>
    );
  },
  m2m_related_field_image: (item, { column }) => {
    item["render"] = (
      value: Array<{ pk: number; filepath: string; filename: string }>
    ) => {
      if (value instanceof Array) {
        return (
          <>
            <el-scrollbar>
              <el-space>
                {value?.map(item => {
                  return h(ElImage, {
                    lazy: true,
                    class: "plus-display-item__image",
                    src: item.filepath,
                    alt: item.filename,
                    previewSrcList: [item.filepath],
                    previewTeleported: true
                  });
                })}
              </el-space>
            </el-scrollbar>
          </>
        );
      } else return <></>;
    };
    // pure-table ******
    item["cellRenderer"] = ({ row }) => (
      <>
        <el-scrollbar>
          <el-space>
            {row[column.key]?.map(item => {
              return h(ElImage, {
                lazy: true,
                class: "plus-display-item__image",
                src: item.filepath,
                alt: item.filename,
                previewSrcList: [item.filepath],
                previewTeleported: true
              });
            })}
          </el-space>
        </el-scrollbar>
      </>
    );
  },
  "image upload": (item, { column }) => {
    item["valueType"] = "img";
    // pure-table ******
    item["cellRenderer"] = ({ row }) =>
      h(ElImage, {
        lazy: true,
        class: "plus-display-item__image",
        src: row[column.key],
        alt: row[column.key],
        previewSrcList: [row[column.key]],
        previewTeleported: true
      });
  },
  "file upload": (item, { column }) => {
    item["render"] = (value: string) => {
      return h(
        ElLink,
        {
          type: "success",
          href: value,
          target: "_blank"
        },
        {
          icon: () => h(ElIcon, null, () => h(Link)),
          default: () => "文件连接"
        }
      );
    };
    // pure-table ******
    item["cellRenderer"] = ({ row }) =>
      h(
        ElLink,
        {
          type: "success",
          href: row[column.key],
          target: "_blank"
        },
        {
          icon: () => h(ElIcon, null, () => h(Link)),
          default: () => "文件连接"
        }
      );
  },
  boolean: item => {
    item["options"] = computed(() => selectBooleanOptions);
    delete item["renderField"];
  },
  list: (item, { column }) => {
    item["render"] = (value: unknown) => {
      try {
        return JSON.stringify(value);
      } catch (e) {
        // 循环引用等无法序列化的值退化为字符串展示（与文本插值效果一致）
        console.warn(e);
        return String(value);
      }
    };
    // pure-table ******
    item["cellRenderer"] = ({ row }) => {
      let value = row[column.key];
      try {
        value = JSON.stringify(value);
      } catch (e) {
        console.warn(e);
      }
      return value;
    };
  }
};

/** m2m_related_field / labeled_multiple_choice 共用 */
function multipleListDetailRenderer(item, { column }) {
  item["render"] = (value: ChoiceOptionItem[]) => {
    if (value instanceof Array) {
      return (
        <>
          <el-scrollbar>
            <el-space>
              {value?.map((item, index) => {
                return (
                  <el-text
                    key={item.pk ?? item.value}
                    type={getColourTypeByIndex(index + 1)}
                  >
                    {item.label}
                  </el-text>
                );
              })}
            </el-space>
          </el-scrollbar>
        </>
      );
    } else return <></>;
  };
  // pure-table ******
  item["cellRenderer"] = ({ row }) => (
    <>
      <el-scrollbar>
        <el-space>
          {row[column.key]?.map((item, index) => {
            return (
              <el-text key={item.pk} type={getColourTypeByIndex(index + 1)}>
                {item.label}
              </el-text>
            );
          })}
        </el-space>
      </el-scrollbar>
    </>
  );
}
