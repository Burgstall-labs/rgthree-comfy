import { app } from "scripts/app.js";
import { NodeTypesString } from "./constants.js";
import { BaseFastGroupsRemoteModeChanger } from "./fast_groups_muter_remote.js";
export class FastGroupsBypasserRemote extends BaseFastGroupsRemoteModeChanger {
    constructor(title = FastGroupsBypasserRemote.title) {
        super(title);
        this.comfyClass = NodeTypesString.FAST_GROUPS_BYPASSER_REMOTE;
        this.helpActions = "bypass and enable";
        this.modeOn = LiteGraph.ALWAYS;
        this.modeOff = 4;
        this.onConstructed();
    }
}
FastGroupsBypasserRemote.type = NodeTypesString.FAST_GROUPS_BYPASSER_REMOTE;
FastGroupsBypasserRemote.title = NodeTypesString.FAST_GROUPS_BYPASSER_REMOTE;
FastGroupsBypasserRemote.exposedActions = ["Bypass all", "Enable all", "Toggle all"];
app.registerExtension({
    name: "rgthree.FastGroupsBypasserRemote",
    registerCustomNodes() {
        FastGroupsBypasserRemote.setUp();
    },
    loadedGraphNode(node) {
        if (node.type == FastGroupsBypasserRemote.title) {
            node.tempSize = [...node.size];
        }
    },
});
