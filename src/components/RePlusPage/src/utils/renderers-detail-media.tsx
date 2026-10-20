import { h } from "vue";
import { ElIcon, ElImage, ElLink } from "element-plus";
import { Link } from "@element-plus/icons-vue";
import { transformI18n } from "@/plugins/i18n";
import type { ChoiceOptionItem, PlusColumnRegistry } from "./types";

/**
 * 详情/列表「文件与图片」渲染器：单/多值文件链接与图片预览。
 * 从 renderers-detail.tsx 拆出（行数门禁），经 builtinDetailRenderers 展开合并，
 * 对外导出面保持不变（消费方仍从 renderers-detail 导入）。
 */
export const mediaDetailRenderers: PlusColumnRegistry = {
  object_related_field_image: (item, { column }) => {
    item["valueType"] = "img";
    item["formatter"] = ({ filepath }: { filepath?: string }) => {
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
    item["render"] = ({
      filepath,
      filename
    }: {
      filepath?: string;
      filename?: string;
    }) => {
      return h(
        ElLink,
        {
          type: "success",
          href: filepath,
          target: "_blank"
        },
        {
          icon: () => h(ElIcon, null, () => h(Link)),
          default: () => filename ?? transformI18n("plus.fileLink")
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
          default: () =>
            row[column.key]?.filename ?? transformI18n("plus.fileLink")
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
                      default: () =>
                        item.filename ?? transformI18n("plus.fileLink")
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
            {row[column.key]?.map((item: ChoiceOptionItem) => {
              return h(
                ElLink,
                {
                  type: "success",
                  href: item.filepath,
                  target: "_blank"
                } as Record<string, unknown>,
                {
                  icon: () => h(ElIcon, null, () => h(Link)),
                  default: () => item.filename ?? transformI18n("plus.fileLink")
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
            {row[column.key]?.map((item: ChoiceOptionItem) => {
              return h(ElImage, {
                lazy: true,
                class: "plus-display-item__image",
                src: item.filepath,
                alt: item.filename,
                previewSrcList: [item.filepath],
                previewTeleported: true
              } as Record<string, unknown>);
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
          default: () => transformI18n("plus.fileLink")
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
          default: () => transformI18n("plus.fileLink")
        }
      );
  }
};
