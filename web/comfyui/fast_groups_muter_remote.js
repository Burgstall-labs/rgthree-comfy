import { app } from "scripts/app.js";
import { NodeTypesString } from "./constants.js";
import { SERVICE as FAST_GROUPS_SERVICE } from "./services/fast_groups_service.js";
import { changeModeOfNodes, getGroupNodes, getConnectedInputNodesAndFilterPassThroughs, } from "./utils.js";
import { rgthree } from "./rgthree.js";
import { BaseFastGroupsModeChanger } from "./fast_groups_muter.js";
const PROPERTY_SORT = "sort";
const PROPERTY_SORT_CUSTOM_ALPHA = "customSortAlphabet";
const PROPERTY_MATCH_COLORS = "matchColors";
const PROPERTY_MATCH_TITLE = "matchTitle";
const PROPERTY_SHOW_ALL_GRAPHS = "showAllGraphs";
export class BaseFastGroupsRemoteModeChanger extends BaseFastGroupsModeChanger {
    constructor(title) {
        super(title);
        this.groupInputMap = new Map();
        this.refreshInputsDebouncer = 0;
        this.processingQueue = false;
        this.onQueueBound = this.onQueue.bind(this);
        this.onQueueEndBound = this.onQueueEnd.bind(this);
        this.onGraphtoPromptBound = this.onGraphtoPrompt.bind(this);
        this.onGraphtoPromptEndBound = this.onGraphtoPromptEnd.bind(this);
        rgthree.addEventListener("queue", this.onQueueBound);
        rgthree.addEventListener("queue-end", this.onQueueEndBound);
        rgthree.addEventListener("graph-to-prompt", this.onGraphtoPromptBound);
        rgthree.addEventListener("graph-to-prompt-end", this.onGraphtoPromptEndBound);
    }
    onConstructed() {
        this.addOutput("OPT_CONNECTION", "*");
        return super.onConstructed();
    }
    onAdded(graph) {
        FAST_GROUPS_SERVICE.addFastGroupNode(this);
        super.onAdded(graph);
        setTimeout(() => {
            this.refreshInputs();
        }, 200);
    }
    onRemoved() {
        rgthree.removeEventListener("queue", this.onQueueBound);
        rgthree.removeEventListener("queue-end", this.onQueueEndBound);
        rgthree.removeEventListener("graph-to-prompt", this.onGraphtoPromptBound);
        rgthree.removeEventListener("graph-to-prompt-end", this.onGraphtoPromptEndBound);
        FAST_GROUPS_SERVICE.removeFastGroupNode(this);
        super.onRemoved();
    }
    refreshInputs() {
        if (this.refreshInputsDebouncer) {
            clearTimeout(this.refreshInputsDebouncer);
        }
        this.refreshInputsDebouncer = setTimeout(() => {
            this.doRefreshInputs();
        }, 100);
    }
    doRefreshInputs() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        if (!this.graph) {
            return;
        }
        const canvas = app.canvas;
        let sort = ((_a = this.properties) === null || _a === void 0 ? void 0 : _a[PROPERTY_SORT]) || "position";
        let customAlphabet = null;
        if (sort === "custom alphabet") {
            const customAlphaStr = (_c = (_b = this.properties) === null || _b === void 0 ? void 0 : _b[PROPERTY_SORT_CUSTOM_ALPHA]) === null || _c === void 0 ? void 0 : _c.replace(/\n/g, "");
            if (customAlphaStr && customAlphaStr.trim()) {
                customAlphabet = customAlphaStr.includes(",")
                    ? customAlphaStr.toLocaleLowerCase().split(",")
                    : customAlphaStr.toLocaleLowerCase().trim().split("");
            }
            if (!(customAlphabet === null || customAlphabet === void 0 ? void 0 : customAlphabet.length)) {
                sort = "alphanumeric";
                customAlphabet = null;
            }
        }
        const groups = [...FAST_GROUPS_SERVICE.getGroups(sort)];
        console.log(`[FastGroupsRemote] Found ${groups.length} groups:`, groups.map((g) => g.title));
        if (customAlphabet === null || customAlphabet === void 0 ? void 0 : customAlphabet.length) {
            groups.sort((a, b) => {
                let aIndex = -1;
                let bIndex = -1;
                for (const [index, alpha] of customAlphabet.entries()) {
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
                }
                else if (aIndex > -1) {
                    return -1;
                }
                else if (bIndex > -1) {
                    return 1;
                }
                return a.title.localeCompare(b.title);
            });
        }
        let filterColors = (((_e = (_d = this.properties) === null || _d === void 0 ? void 0 : _d[PROPERTY_MATCH_COLORS]) === null || _e === void 0 ? void 0 : _e.split(",")) || []).filter((c) => c.trim());
        if (filterColors.length) {
            filterColors = filterColors.map((color) => {
                color = color.trim().toLocaleLowerCase();
                if (LGraphCanvas.node_colors[color]) {
                    color = LGraphCanvas.node_colors[color].groupcolor;
                }
                color = color.replace("#", "").toLocaleLowerCase();
                if (color.length === 3) {
                    color = color.replace(/(.)(.)(.)/, "$1$1$2$2$3$3");
                }
                return `#${color}`;
            });
        }
        const groupsToCreate = [];
        for (const group of groups) {
            if (filterColors.length) {
                let groupColor = (_f = group.color) === null || _f === void 0 ? void 0 : _f.replace("#", "").trim().toLocaleLowerCase();
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
            if ((_h = (_g = this.properties) === null || _g === void 0 ? void 0 : _g[PROPERTY_MATCH_TITLE]) === null || _h === void 0 ? void 0 : _h.trim()) {
                try {
                    if (!new RegExp(this.properties[PROPERTY_MATCH_TITLE], "i").exec(group.title)) {
                        continue;
                    }
                }
                catch (e) {
                    console.error(e);
                    continue;
                }
            }
            const showAllGraphs = (_j = this.properties) === null || _j === void 0 ? void 0 : _j[PROPERTY_SHOW_ALL_GRAPHS];
            if (!showAllGraphs && group.graph !== app.canvas.getCurrentGraph()) {
                continue;
            }
            groupsToCreate.push(group);
        }
        console.log(`[FastGroupsRemote] Creating inputs for ${groupsToCreate.length} groups:`, groupsToCreate.map((g) => g.title));
        const currentGroupTitles = new Set(groupsToCreate.map((g) => g.title));
        const newGroupInputMap = new Map();
        const existingInputsByName = new Map();
        for (let i = 0; i < this.inputs.length; i++) {
            const input = this.inputs[i];
            if ((input === null || input === void 0 ? void 0 : input.name) && input.name.startsWith("Enable ")) {
                const groupTitle = input.name.substring(7);
                existingInputsByName.set(groupTitle, { index: i, input: input });
            }
        }
        console.log(`[FastGroupsRemote] Existing inputs:`, Array.from(existingInputsByName.keys()));
        const inputsToRemove = [];
        for (const [groupTitle, { index }] of existingInputsByName.entries()) {
            if (!currentGroupTitles.has(groupTitle)) {
                inputsToRemove.push(index);
            }
        }
        inputsToRemove.sort((a, b) => b - a);
        for (const index of inputsToRemove) {
            this.removeInput(index);
            for (const [title, data] of existingInputsByName.entries()) {
                if (data.index > index) {
                    data.index--;
                }
            }
        }
        let currentInputIndex = 0;
        for (const group of groupsToCreate) {
            const inputName = `Enable ${group.title}`;
            const existing = existingInputsByName.get(group.title);
            if (existing) {
                newGroupInputMap.set(group.title, existing.index);
                currentInputIndex = Math.max(currentInputIndex, existing.index + 1);
            }
            else {
                let insertIndex = currentInputIndex;
                while (insertIndex < this.inputs.length) {
                    const existingInputName = (_k = this.inputs[insertIndex]) === null || _k === void 0 ? void 0 : _k.name;
                    if (existingInputName && existingInputName < inputName) {
                        insertIndex++;
                    }
                    else {
                        break;
                    }
                }
                if (insertIndex >= this.inputs.length) {
                    this.addInput(inputName, "BOOLEAN");
                }
                else {
                    this.addInput(inputName, "BOOLEAN");
                    const newInput = this.inputs[this.inputs.length - 1];
                    this.inputs.splice(this.inputs.length - 1, 1);
                    this.inputs.splice(insertIndex, 0, newInput);
                }
                newGroupInputMap.set(group.title, insertIndex);
                currentInputIndex = insertIndex + 1;
            }
        }
        this.groupInputMap = newGroupInputMap;
        this.setSize(this.computeSize());
        (_l = this.graph) === null || _l === void 0 ? void 0 : _l.setDirtyCanvas(true, true);
    }
    refreshWidgets() {
        this.refreshInputs();
    }
    onQueue(event) {
        this.processingQueue = true;
    }
    onQueueEnd(event) {
        this.processingQueue = false;
    }
    getBooleanValueFromInput(inputIndex) {
        var _a;
        const inputSlot = (_a = this.inputs) === null || _a === void 0 ? void 0 : _a[inputIndex];
        if (!(inputSlot === null || inputSlot === void 0 ? void 0 : inputSlot.link)) {
            return null;
        }
        const connectedNodes = getConnectedInputNodesAndFilterPassThroughs(this, this, inputIndex);
        if (connectedNodes.length === 0) {
            return null;
        }
        const connectedNode = connectedNodes[0];
        if (!connectedNode) {
            return null;
        }
        const valueWidget = connectedNode.valueWidget;
        if (valueWidget && typeof valueWidget.value === "boolean") {
            return valueWidget.value;
        }
        if (rgthree.processingQueue) {
            const serializedNode = rgthree.getNodeFromInitialGraphToPromptSerializedWorkflowBecauseComfyUIBrokeStuff(connectedNode);
            if (serializedNode === null || serializedNode === void 0 ? void 0 : serializedNode.widgets_values) {
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
    onGraphtoPrompt(event) {
        if (!this.processingQueue) {
            return;
        }
        for (const [groupTitle, inputIndex] of this.groupInputMap.entries()) {
            const enabledValue = this.getBooleanValueFromInput(inputIndex);
            if (enabledValue === null) {
                continue;
            }
            const groups = FAST_GROUPS_SERVICE.getGroups();
            const group = groups.find((g) => g.title === groupTitle);
            if (!group) {
                continue;
            }
            const groupNodes = getGroupNodes(group);
            changeModeOfNodes(groupNodes, enabledValue ? this.modeOn : this.modeOff);
            group.rgthree_hasAnyActiveNode = enabledValue;
        }
    }
    onGraphtoPromptEnd(event) {
    }
}
export class FastGroupsMuterRemote extends BaseFastGroupsRemoteModeChanger {
    constructor(title = FastGroupsMuterRemote.title) {
        super(title);
        this.comfyClass = NodeTypesString.FAST_GROUPS_MUTER_REMOTE;
        this.helpActions = "mute and unmute";
        this.modeOn = LiteGraph.ALWAYS;
        this.modeOff = LiteGraph.NEVER;
        this.onConstructed();
    }
}
FastGroupsMuterRemote.type = NodeTypesString.FAST_GROUPS_MUTER_REMOTE;
FastGroupsMuterRemote.title = NodeTypesString.FAST_GROUPS_MUTER_REMOTE;
FastGroupsMuterRemote.exposedActions = ["Bypass all", "Enable all", "Toggle all"];
app.registerExtension({
    name: "rgthree.FastGroupsMuterRemote",
    registerCustomNodes() {
        FastGroupsMuterRemote.setUp();
    },
    loadedGraphNode(node) {
        if (node.type == FastGroupsMuterRemote.title) {
            node.tempSize = [...node.size];
        }
    },
});
