import type {
  LGraphNode,
  LGraph as TLGraph,
  LGraphCanvas as TLGraphCanvas,
  LGraphGroup,
  Point,
} from "@comfyorg/frontend";

import {app} from "scripts/app.js";
import {NodeTypesString} from "./constants.js";
import {SERVICE as FAST_GROUPS_SERVICE} from "./services/fast_groups_service.js";
import {
  changeModeOfNodes,
  getGroupNodes,
  getConnectedInputNodesAndFilterPassThroughs,
} from "./utils.js";
import {rgthree} from "./rgthree.js";
import {BaseFastGroupsModeChanger} from "./fast_groups_muter.js";

const PROPERTY_SORT = "sort";
const PROPERTY_SORT_CUSTOM_ALPHA = "customSortAlphabet";
const PROPERTY_MATCH_COLORS = "matchColors";
const PROPERTY_MATCH_TITLE = "matchTitle";
const PROPERTY_SHOW_ALL_GRAPHS = "showAllGraphs";

/**
 * Base class for Remote Fast Groups nodes that create dynamic inputs for each group.
 */
export abstract class BaseFastGroupsRemoteModeChanger extends BaseFastGroupsModeChanger {
  private groupInputMap: Map<string, number> = new Map(); // Maps group title to input slot index
  private refreshInputsDebouncer: number = 0;
  processingQueue: boolean = false;
  onQueueBound = this.onQueue.bind(this);
  onQueueEndBound = this.onQueueEnd.bind(this);
  onGraphtoPromptBound = this.onGraphtoPrompt.bind(this);
  onGraphtoPromptEndBound = this.onGraphtoPromptEnd.bind(this);

  constructor(title: string) {
    super(title);

    rgthree.addEventListener("queue", this.onQueueBound);
    rgthree.addEventListener("queue-end", this.onQueueEndBound);
    rgthree.addEventListener("graph-to-prompt", this.onGraphtoPromptBound);
    rgthree.addEventListener("graph-to-prompt-end", this.onGraphtoPromptEndBound);
  }

  override onConstructed(): boolean {
    this.addOutput("OPT_CONNECTION", "*");
    // Don't refresh inputs here - wait until onAdded when we're registered with the service
    return super.onConstructed();
  }

  override onAdded(graph: TLGraph): void {
    FAST_GROUPS_SERVICE.addFastGroupNode(this);
    super.onAdded(graph);
    // Refresh inputs after being added to the graph and registered with the service
    // Use a delay to ensure groups are available (service schedules refresh after 8ms, but groups may need more time)
    setTimeout(() => {
      this.refreshInputs();
    }, 200);
  }

  override onRemoved(): void {
    rgthree.removeEventListener("queue", this.onQueueBound);
    rgthree.removeEventListener("queue-end", this.onQueueEndBound);
    rgthree.removeEventListener("graph-to-prompt", this.onGraphtoPromptBound);
    rgthree.removeEventListener("graph-to-prompt-end", this.onGraphtoPromptEndBound);
    FAST_GROUPS_SERVICE.removeFastGroupNode(this);
    super.onRemoved();
  }

  /**
   * Refreshes the dynamic inputs based on current groups in the workflow.
   */
  refreshInputs() {
    if (this.refreshInputsDebouncer) {
      clearTimeout(this.refreshInputsDebouncer);
    }
    this.refreshInputsDebouncer = setTimeout(() => {
      this.doRefreshInputs();
    }, 100);
  }

  private doRefreshInputs() {
    if (!this.graph) {
      // Node not yet added to graph, skip
      return;
    }

    const canvas = app.canvas as TLGraphCanvas;
    let sort = this.properties?.[PROPERTY_SORT] || "position";
    let customAlphabet: string[] | null = null;
    if (sort === "custom alphabet") {
      const customAlphaStr = this.properties?.[PROPERTY_SORT_CUSTOM_ALPHA]?.replace(/\n/g, "");
      if (customAlphaStr && customAlphaStr.trim()) {
        customAlphabet = customAlphaStr.includes(",")
          ? customAlphaStr.toLocaleLowerCase().split(",")
          : customAlphaStr.toLocaleLowerCase().trim().split("");
      }
      if (!customAlphabet?.length) {
        sort = "alphanumeric";
        customAlphabet = null;
      }
    }

    const groups = [...FAST_GROUPS_SERVICE.getGroups(sort)];

    // Debug logging
    console.log(
      `[FastGroupsRemote] Found ${groups.length} groups:`,
      groups.map((g) => g.title),
    );

    // Apply custom alphabet sorting if needed
    if (customAlphabet?.length) {
      groups.sort((a, b) => {
        let aIndex = -1;
        let bIndex = -1;
        for (const [index, alpha] of customAlphabet!.entries()) {
          aIndex =
            aIndex < 0 ? (a.title.toLocaleLowerCase().startsWith(alpha) ? index : -1) : aIndex;
          bIndex =
            bIndex < 0 ? (b.title.toLocaleLowerCase().startsWith(alpha) ? index : -1) : bIndex;
          if (aIndex > -1 && bIndex > -1) {
            break;
          }
        }
        if (aIndex > -1 && bIndex > -1) {
          const ret = aIndex - bIndex;
          if (ret === 0) {
            return a.title.localeCompare(b.title);
          }
          return ret;
        } else if (aIndex > -1) {
          return -1;
        } else if (bIndex > -1) {
          return 1;
        }
        return a.title.localeCompare(b.title);
      });
    }

    // Filter groups by color
    let filterColors = (
      (this.properties?.[PROPERTY_MATCH_COLORS] as string)?.split(",") || []
    ).filter((c) => c.trim());
    if (filterColors.length) {
      filterColors = filterColors.map((color) => {
        color = color.trim().toLocaleLowerCase();
        if (LGraphCanvas.node_colors[color]) {
          color = LGraphCanvas.node_colors[color]!.groupcolor;
        }
        color = color.replace("#", "").toLocaleLowerCase();
        if (color.length === 3) {
          color = color.replace(/(.)(.)(.)/, "$1$1$2$2$3$3");
        }
        return `#${color}`;
      });
    }

    // Build list of groups to create inputs for
    const groupsToCreate: LGraphGroup[] = [];
    for (const group of groups) {
      if (filterColors.length) {
        let groupColor = group.color?.replace("#", "").trim().toLocaleLowerCase();
        if (!groupColor) {
          continue;
        }
        if (groupColor.length === 3) {
          groupColor = groupColor.replace(/(.)(.)(.)/, "$1$1$2$2$3$3");
        }
        groupColor = `#${groupColor}`;
        if (!filterColors.includes(groupColor)) {
          continue;
        }
      }
      if (this.properties?.[PROPERTY_MATCH_TITLE]?.trim()) {
        try {
          if (!new RegExp(this.properties[PROPERTY_MATCH_TITLE], "i").exec(group.title)) {
            continue;
          }
        } catch (e) {
          console.error(e);
          continue;
        }
      }
      const showAllGraphs = this.properties?.[PROPERTY_SHOW_ALL_GRAPHS];
      if (!showAllGraphs && group.graph !== app.canvas.getCurrentGraph()) {
        continue;
      }
      groupsToCreate.push(group);
    }

    // Debug logging
    console.log(
      `[FastGroupsRemote] Creating inputs for ${groupsToCreate.length} groups:`,
      groupsToCreate.map((g) => g.title),
    );

    // Create a map of current group titles
    const currentGroupTitles = new Set(groupsToCreate.map((g) => g.title));
    const newGroupInputMap = new Map<string, number>();

    // Build a map of existing inputs by their name (group title)
    // Skip the base class's empty input (name "" from BaseAnyInputConnectedNode)
    const existingInputsByName = new Map<string, {index: number; input: any}>();
    for (let i = 0; i < this.inputs.length; i++) {
      const input = this.inputs[i];
      if (input?.name && input.name.startsWith("Enable ")) {
        const groupTitle = input.name.substring(7); // Remove "Enable " prefix
        existingInputsByName.set(groupTitle, {index: i, input: input});
      }
    }

    // Debug logging
    console.log(`[FastGroupsRemote] Existing inputs:`, Array.from(existingInputsByName.keys()));

    // Remove inputs for groups that no longer exist (in reverse order)
    const inputsToRemove: number[] = [];
    for (const [groupTitle, {index}] of existingInputsByName.entries()) {
      if (!currentGroupTitles.has(groupTitle)) {
        inputsToRemove.push(index);
      }
    }
    inputsToRemove.sort((a, b) => b - a);
    for (const index of inputsToRemove) {
      this.removeInput(index);
      // Update existingInputsByName indices after removal
      for (const [title, data] of existingInputsByName.entries()) {
        if (data.index > index) {
          data.index--;
        }
      }
    }

    // Now add inputs for new groups and build the final mapping
    // We'll insert new inputs in the correct sorted position
    let currentInputIndex = 0;
    for (const group of groupsToCreate) {
      const inputName = `Enable ${group.title}`;
      const existing = existingInputsByName.get(group.title);

      if (existing) {
        // Input already exists, keep it at its current position (or move if needed)
        // For simplicity, we'll keep existing inputs where they are
        newGroupInputMap.set(group.title, existing.index);
        // Update currentInputIndex to be after this one
        currentInputIndex = Math.max(currentInputIndex, existing.index + 1);
      } else {
        // New group, add input
        // Find insertion point to maintain sort order
        let insertIndex = currentInputIndex;
        while (insertIndex < this.inputs.length) {
          const existingInputName = this.inputs[insertIndex]?.name;
          if (existingInputName && existingInputName < inputName) {
            insertIndex++;
          } else {
            break;
          }
        }

        // Insert at the calculated position
        if (insertIndex >= this.inputs.length) {
          this.addInput(inputName, "BOOLEAN");
        } else {
          // We need to insert at a specific position
          // LiteGraph doesn't have insertInput, so we'll add and then reorder
          this.addInput(inputName, "BOOLEAN");
          const newInput = this.inputs[this.inputs.length - 1];
          this.inputs.splice(this.inputs.length - 1, 1);
          this.inputs.splice(insertIndex, 0, newInput!);
        }
        newGroupInputMap.set(group.title, insertIndex);
        currentInputIndex = insertIndex + 1;
      }
    }

    this.groupInputMap = newGroupInputMap;
    this.setSize(this.computeSize());
    this.graph?.setDirtyCanvas(true, true);
  }

  override refreshWidgets() {
    // Override to refresh inputs instead of widgets
    this.refreshInputs();
  }

  onQueue(event: Event) {
    this.processingQueue = true;
  }

  onQueueEnd(event: Event) {
    this.processingQueue = false;
  }

  /**
   * Reads the boolean value from a connected input node.
   */
  private getBooleanValueFromInput(inputIndex: number): boolean | null {
    const inputSlot = this.inputs?.[inputIndex];
    if (!inputSlot?.link) {
      return null; // No input connected
    }

    const connectedNodes = getConnectedInputNodesAndFilterPassThroughs(this, this, inputIndex);
    if (connectedNodes.length === 0) {
      return null;
    }

    const connectedNode = connectedNodes[0];
    if (!connectedNode) {
      return null;
    }

    // Try to get the value from the node's widget (for Power Primitive nodes)
    const valueWidget = (connectedNode as any).valueWidget;
    if (valueWidget && typeof valueWidget.value === "boolean") {
      return valueWidget.value;
    }

    // Try to get the value from the serialized workflow
    if (rgthree.processingQueue) {
      const serializedNode =
        rgthree.getNodeFromInitialGraphToPromptSerializedWorkflowBecauseComfyUIBrokeStuff(
          connectedNode,
        );
      if (serializedNode?.widgets_values) {
        const value = serializedNode.widgets_values[0];
        if (typeof value === "boolean") {
          return value;
        }
        if (typeof value === "string") {
          return !["false", "null", "None", "", "0"].includes(value.toLowerCase());
        }
        if (typeof value === "number") {
          return value !== 0;
        }
      }
    }

    return null;
  }

  onGraphtoPrompt(event: Event) {
    if (!this.processingQueue) {
      return;
    }

    // Apply state to each group based on its input
    for (const [groupTitle, inputIndex] of this.groupInputMap.entries()) {
      const enabledValue = this.getBooleanValueFromInput(inputIndex);
      if (enabledValue === null) {
        continue; // No input connected, leave group state unchanged
      }

      // Find the group
      const groups = FAST_GROUPS_SERVICE.getGroups();
      const group = groups.find((g) => g.title === groupTitle);
      if (!group) {
        continue;
      }

      // Apply the state to all nodes in the group
      const groupNodes = getGroupNodes(group);
      changeModeOfNodes(groupNodes, enabledValue ? this.modeOn : this.modeOff);
      group.rgthree_hasAnyActiveNode = enabledValue;
    }
  }

  onGraphtoPromptEnd(event: Event) {
    // No cleanup needed - the state changes persist
  }
}

/**
 * Fast Groups Muter Remote - creates dynamic boolean inputs for each group.
 */
export class FastGroupsMuterRemote extends BaseFastGroupsRemoteModeChanger {
  static override type = NodeTypesString.FAST_GROUPS_MUTER_REMOTE;
  static override title = NodeTypesString.FAST_GROUPS_MUTER_REMOTE;
  override comfyClass = NodeTypesString.FAST_GROUPS_MUTER_REMOTE;

  static override exposedActions = ["Bypass all", "Enable all", "Toggle all"];

  protected override helpActions = "mute and unmute";

  override readonly modeOn: number = LiteGraph.ALWAYS;
  override readonly modeOff: number = LiteGraph.NEVER;

  constructor(title = FastGroupsMuterRemote.title) {
    super(title);
    this.onConstructed();
  }
}

app.registerExtension({
  name: "rgthree.FastGroupsMuterRemote",
  registerCustomNodes() {
    FastGroupsMuterRemote.setUp();
  },
  loadedGraphNode(node: LGraphNode) {
    if (node.type == FastGroupsMuterRemote.title) {
      (node as FastGroupsMuterRemote).tempSize = [...node.size] as Point;
    }
  },
});
