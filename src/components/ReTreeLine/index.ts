// 参考https://www.npmjs.com/package/element-tree-line (主要是替换需要通过函数传参的方式去注册组件，并添加更好的类型支持，并移除this.$scopedSlots，在3.x中,将所有this.$scopedSlots替换为this.$slots)
import "./index.scss";
import { isFunction } from "@pureadmin/utils";
import { type PropType, h, defineComponent } from "vue";
import type {
  TreeNode,
  TreeData,
  TreeNodeData
} from "element-plus/es/components/tree-v2/src/types";

/** el-tree / el-tree-v2 的节点运行期结构不一致（childNodes+id vs children+key），
 * 这里以最小结构类型兼容两种形态（上游此处使用 any） */
type TreeLikeNode = {
  level?: number;
  parent?: TreeLikeNode | null;
  children?: TreeLikeNode[];
  childNodes?: TreeLikeNode[];
  key?: string | number;
  id?: string | number;
};

/** 树形连接线组件 */
export default defineComponent({
  name: "ReTreeLine",
  props: {
    node: {
      type: Object as PropType<TreeNode>,
      required: true
    },
    data: {
      // 上游为 Array 类型 + 空函数默认值：语义上 data 是节点数据对象，
      // 这里改为 Object/空对象，避免 Vue 运行期类型告警与空函数 lint 报错
      type: Object as PropType<TreeNodeData>,
      default: () => ({})
    },
    treeData: {
      type: Array as PropType<TreeData>,
      default: () => []
    },
    indent: {
      type: Number,
      default: 16
    },
    showLabelLine: {
      type: Boolean,
      default: true
    }
  },
  setup(_, context) {
    const { slots } = context;
    const getScopedSlot = slotName => {
      if (!slotName) {
        return null;
      }
      const slotNameSplits = slotName.split("||");
      let slot = null;
      for (let index = 0; index < slotNameSplits.length; index++) {
        const name = slotNameSplits[index];
        slot = (slots || {})[name];
      }
      return slot;
    };
    const getSlotValue = (slot, scopedData, defaultNode = null) => {
      if (isFunction(slot)) {
        return slot(scopedData) || defaultNode;
      }
      return slot || defaultNode;
    };

    return {
      getScopedSlot,
      getSlotValue
    };
  },
  render() {
    // 自定义整行节点label区域
    const scopeSlotDefault = this.getScopedSlot("default");
    // 显示横线时自定义节点label区域
    const labelSlot = this.getScopedSlot("node-label");
    // 显示横线时追加在横线右边的内容
    const afterLabelSlot = this.getScopedSlot("after-node-label");
    const labelNodes = scopeSlotDefault
      ? this.getSlotValue(scopeSlotDefault, {
          node: this.node,
          data: this.data
        })
      : [
          labelSlot
            ? this.getSlotValue(labelSlot, {
                node: this.node,
                data: this.data
              })
            : h("span", { class: "element-tree-node-label" }, this.node.label),
          this.showLabelLine
            ? h("span", {
                class: "element-tree-node-label-line"
              })
            : null,
          this.getSlotValue(afterLabelSlot, {
            node: this.node,
            data: this.data
          })
        ];
    // 取得每一层的当前节点是不是在当前层级列表的最后一个
    const lastnodeArr = [];
    let currentNode: TreeLikeNode | null = this.node as unknown as TreeLikeNode;
    while (currentNode) {
      let parentNode: TreeLikeNode | null = currentNode.parent ?? null;
      // 兼容element-plus的 el-tree-v2 (Virtualized Tree 虚拟树)
      if (currentNode.level === 1 && !currentNode.parent) {
        // el-tree-v2的第一层node是没有parent的，必需 treeData 创建一个parent
        if (!this.treeData || !Array.isArray(this.treeData)) {
          throw Error(
            "if you using el-tree-v2 (Virtualized Tree) of element-plus,element-tree-line required data."
          );
        }
        parentNode = {
          children: Array.isArray(this.treeData)
            ? this.treeData.map(item => {
                return { ...item, key: item.id };
              })
            : [],
          level: 0,
          key: "node-0",
          parent: null
        };
      }
      if (parentNode) {
        // element-plus的 el-tree-v2 使用的是children和key， 其他使用的是 childNodes和id
        const index = (parentNode.children || parentNode.childNodes).findIndex(
          item => (item.key || item.id) === (currentNode.key || currentNode.id)
        );
        lastnodeArr.unshift(
          index === (parentNode.children || parentNode.childNodes).length - 1
        );
      }
      currentNode = parentNode;
    }
    const lineNodes = [];
    for (let i = 0; i < this.node.level; i++) {
      lineNodes.push(
        h("span", {
          class: {
            "element-tree-node-line-ver": true,
            "last-node-line": lastnodeArr[i] && this.node.level - 1 !== i,
            "last-node-isLeaf-line": lastnodeArr[i] && this.node.level - 1 === i
          },
          style: { left: this.indent * i + "px" }
        })
      );
    }
    return h(
      "span",
      {
        class: "element-tree-node-label-wrapper"
      },
      [labelNodes].concat(lineNodes).concat([
        h("span", {
          class: "element-tree-node-line-hor",
          style: {
            width: (this.node.isLeaf ? 24 : 8) + "px",
            left: (this.node.level - 1) * this.indent + "px"
          }
        })
      ])
    );
  }
});
