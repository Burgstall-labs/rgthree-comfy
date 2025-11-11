import type {Size} from "@comfyorg/frontend";

import {app} from "scripts/app.js";
import {NodeTypesString} from "./constants.js";
import {BaseFastGroupsRemoteModeChanger} from "./fast_groups_muter_remote.js";

/**
 * Fast Groups Bypasser Remote - creates dynamic boolean inputs for each group.
 */
export class FastGroupsBypasserRemote extends BaseFastGroupsRemoteModeChanger {
  static override type = NodeTypesString.FAST_GROUPS_BYPASSER_REMOTE;
  static override title = NodeTypesString.FAST_GROUPS_BYPASSER_REMOTE;
  override comfyClass = NodeTypesString.FAST_GROUPS_BYPASSER_REMOTE;

  static override exposedActions = ["Bypass all", "Enable all", "Toggle all"];

  protected override helpActions = "bypass and enable";

  override readonly modeOn = LiteGraph.ALWAYS;
  override readonly modeOff = 4; // Used by Comfy for "bypass"

  constructor(title = FastGroupsBypasserRemote.title) {
    super(title);
    this.onConstructed();
  }
}

app.registerExtension({
  name: "rgthree.FastGroupsBypasserRemote",
  registerCustomNodes() {
    FastGroupsBypasserRemote.setUp();
  },
  loadedGraphNode(node: FastGroupsBypasserRemote) {
    if (node.type == FastGroupsBypasserRemote.title) {
      node.tempSize = [...node.size] as Size;
    }
  },
});
