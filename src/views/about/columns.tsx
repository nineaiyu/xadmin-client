import type { PlusColumn } from "plus-pro-components";

export function useColumns() {
  const { pkg, lastBuildTime } = __APP_INFO__;
  const { version, engines } = pkg;
  const columns: PlusColumn[] = [
    {
      label: "当前版本",
      prop: "version",
      minWidth: 100,
      renderDescriptionsItem: () => {
        return (
          <el-tag size="large" class="text-base!">
            {version}
          </el-tag>
        );
      }
    },
    {
      label: "最后编译时间",
      prop: "buildTime",
      minWidth: 120,
      renderDescriptionsItem: () => {
        return (
          <el-tag size="large" class="text-base!">
            {lastBuildTime}
          </el-tag>
        );
      }
    },
    {
      label: "推荐 node 版本",
      prop: "node",
      minWidth: 140,
      renderDescriptionsItem: () => {
        return (
          <el-tag size="large" class="text-base!">
            {engines.node}
          </el-tag>
        );
      }
    },
    {
      label: "推荐 pnpm 版本",
      prop: "pnpm",
      minWidth: 140,
      renderDescriptionsItem: () => {
        return (
          <el-tag size="large" class="text-base!">
            {engines.pnpm}
          </el-tag>
        );
      }
    },
    {
      label: "前端代码地址",
      prop: "webUrl",
      minWidth: 140,
      className: "pure-version",
      renderDescriptionsItem: () => {
        return (
          <a href="https://github.com/nineaiyu/xadmin-client" target="_blank">
            <span style="color: var(--el-color-primary)">前端代码地址</span>
          </a>
        );
      }
    },
    {
      label: "后端代码地址",
      prop: "apiUrl",
      minWidth: 140,
      className: "pure-version",
      renderDescriptionsItem: () => {
        return (
          <a href="https://github.com/nineaiyu/xadmin-server" target="_blank">
            <span style="color: var(--el-color-primary)">后端代码地址</span>
          </a>
        );
      }
    },
    {
      label: "文档地址",
      prop: "docUrl",
      minWidth: 100,
      className: "pure-version",
      renderDescriptionsItem: () => {
        return (
          <a href="https://docs.dvcloud.xin" target="_blank">
            <span style="color: var(--el-color-primary)">文档链接</span>
          </a>
        );
      }
    },
    {
      label: "预览地址",
      prop: "demoUrl",
      minWidth: 100,
      className: "pure-version",
      renderDescriptionsItem: () => {
        return (
          <a href="https://xadmin.dvcloud.xin/" target="_blank">
            <span style="color: var(--el-color-primary)">预览链接</span>
          </a>
        );
      }
    }
  ];

  return {
    columns
  };
}
