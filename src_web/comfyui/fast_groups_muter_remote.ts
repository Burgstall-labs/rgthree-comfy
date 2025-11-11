import type {
  LGraphNode,
  LGraph as TLGraph,
  LGraphCanvas as TLGraphCanvas,
  Vector2,
  Size,
  LGraphGroup,
  CanvasMouseEvent,
  Point,
} from "@comfyorg/frontend";

import {app} from "scripts/app.js";
import {NodeTypesString} from "./constants.js";
import {SERVICE as FAST_GROUPS_SERVICE} from "./services/fast_groups_service.js";
import {drawNodeWidget, fitString} from "./utils_canvas.js";
import {RgthreeBaseWidget} from "./utils_widgets.js";
import { changeModeOfNodes, getGroupNodes, getConnectedInputNodesAndFilterPassThroughs } from "./utils.js";
import {rgthree} from "./rgthree.js";
import {BaseFastGroupsModeChanger, FastGroupsToggleRowWidget} from "./fast_groups_muter.js";

/**
 * Fast Groups Muter Remote implementation that extends BaseFastGroupsModeChanger
 * and adds boolean input support for remote control.
 */
export class FastGroupsMuterRemote extends BaseFastGroupsModeChanger {
  static override type = NodeTypesString.FAST_GROUPS_MUTER_REMOTE;
  static override title = NodeTypesString.FAST_GROUPS_MUTER_REMOTE;
  override comfyClass = NodeTypesString.FAST_GROUPS_MUTER_REMOTE;

  static override exposedActions = ["Bypass all", "Enable all", "Toggle all"];

  protected override helpActions = "mute and unmute";

  override readonly modeOn: number = LiteGraph.ALWAYS;
  override readonly modeOff: number = LiteGraph.NEVER;

  processingQueue: boolean = false;
  onQueueBound = this.onQueue.bind(this);
  onQueueEndBound = this.onQueueEnd.bind(this);
  onGraphtoPromptBound = this.onGraphtoPrompt.bind(this);
  onGraphtoPromptEndBound = this.onGraphtoPromptEnd.bind(this);

  constructor(title = FastGroupsMuterRemote.title) {
    super(title);

    rgthree.addEventListener("queue", this.onQueueBound);
    rgthree.addEventListener("queue-end", this.onQueueEndBound);
    rgthree.addEventListener("graph-to-prompt", this.onGraphtoPromptBound);
    rgthree.addEventListener("graph-to-prompt-end", this.onGraphtoPromptEndBound);
  }

  override onConstructed(): boolean {
    this.addInput("enabled", "BOOLEAN");
    this.addOutput("OPT_CONNECTION", "*");
    return super.onConstructed();
  }

  override onRemoved(): void {
    rgthree.removeEventListener("queue", this.onQueueBound);
    rgthree.removeEventListener("queue-end", this.onQueueEndBound);
    rgthree.removeEventListener("graph-to-prompt", this.onGraphtoPromptBound);
    rgthree.removeEventListener("graph-to-prompt-end", this.onGraphtoPromptEndBound);
    super.onRemoved();
  }

  onQueue(event: Event) {
    this.processingQueue = true;
  }

  onQueueEnd(event: Event) {
    this.processingQueue = false;
  }

  /**
   * Reads the boolean value from the connected input node.
   * Returns true if enabled, false if disabled, or null if no input is connected.
   */
  private getEnabledValue(): boolean | null {
    const inputSlot = this.inputs?.[0];
    if (!inputSlot?.link) {
      return null; // No input connected, use default behavior
    }

    const connectedNodes = getConnectedInputNodesAndFilterPassThroughs(this, this, 0);
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
      const serializedNode = rgthree.getNodeFromInitialGraphToPromptSerializedWorkflowBecauseComfyUIBrokeStuff(
        connectedNode,
      );
      if (serializedNode?.widgets_values) {
        // For boolean nodes, the value is typically in widgets_values[0]
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

    const enabledValue = this.getEnabledValue();
    if (enabledValue === null) {
      return; // No input connected, use default behavior
    }

    // Apply the state to all groups based on the boolean input
    for (const widget of this.widgets) {
      if (widget instanceof FastGroupsToggleRowWidget) {
        widget.doModeChange(enabledValue, true);
      }
    }
  }

  onGraphtoPromptEnd(event: Event) {
    // No cleanup needed - the state changes persist
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

