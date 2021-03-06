/**
 * @license
 * Copyright 2017 JBoss Inc
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {Component, EventEmitter, Output, Input, ViewEncapsulation, ViewChild, HostListener} from "@angular/core";
import {ApiDefinition} from "../../../../models/api.model";
import {Oas20Document, OasLibraryUtils, Oas20PathItem, Oas20Operation, Oas20DefinitionSchema} from "oai-ts-core";
import {CommandsManager, ICommand} from "./_services/commands.manager";
import {NewPathCommand} from "./_commands/new-path.command";
import {NewDefinitionCommand} from "./_commands/new-definition.command";
import {AddPathDialogComponent} from "./_components/dialogs/add-path.component";
import {DeletePathCommand, DeleteDefinitionSchemaCommand} from "./_commands/delete.command";


@Component({
    moduleId: module.id,
    selector: "api-editor",
    templateUrl: "editor.component.html",
    styleUrls: ["editor.component.css"],
    encapsulation: ViewEncapsulation.None
})
export class ApiEditorComponent {

    @Input() api: ApiDefinition;
    @Output() onDirty: EventEmitter<boolean> = new EventEmitter<boolean>();

    private _library: OasLibraryUtils = new OasLibraryUtils();
    private _document: Oas20Document = null;
    private _commands: CommandsManager = new CommandsManager();

    theme: string = "light";
    selectedItem: string = null;
    selectedType: string = "main";
    subselectedItem: string = null;

    contextMenuItem: string = null;
    contextMenuType: string = null;
    contextMenuPos: any = {
        left: "0px",
        top: "0px"
    };

    @ViewChild("addPathDialog") addPathDialog: AddPathDialogComponent;

    filterCriteria: string = null;

    /**
     * Constructor.
     */
    constructor() {}

    /**
     * Gets the OpenAPI spec as a document.
     */
    public document(): Oas20Document {
        if (this._document === null) {
            this._document = <Oas20Document>this._library.createDocument(this.api.spec);
        }
        return this._document;
    }

    /**
     * Returns an array of path names.
     * @return {any}
     */
    public pathNames(): string[] {
        if (this.document().paths) {
            return this.document().paths.pathItemNames().filter( name => {
                if (this.acceptThroughFilter(name)) {
                    return name;
                } else {
                    return null;
                }
            }).sort();
        } else {
            return [];
        }
    }

    /**
     * Returns an array of definition names.
     * @return {any}
     */
    public definitionNames(): string[] {
        if (this.document().definitions) {
            return this.document().definitions.definitionNames().filter( name => {
                if (this.acceptThroughFilter(name)) {
                    return name;
                } else {
                    return null;
                }
            }).sort();
        } else {
            return [];
        }
    }

    /**
     * Returns an array of response names.
     * @return {any}
     */
    public responseNames(): string[] {
        if (this.document().responses) {
            return this.document().responses.responseNames().filter( name => {
                if (this.acceptThroughFilter(name)) {
                    return name;
                } else {
                    return null;
                }
            }).sort();
        } else {
            return [];
        }
    }

    /**
     * Called when the user selects the main/default element from the master area.
     */
    public selectMain(): void {
        this.selectedItem = null;
        this.selectedType = "main";
    }

    /**
     * Called when the user selects a path from the master area.
     * @param name
     */
    public selectPath(name: string): void {
        this.selectedItem = name;
        this.selectedType = "path";
    }

    /**
     * Called to deselect the currently selected path.
     */
    public deselectPath(): void {
        this.selectMain();
    }

    /**
     * Called when the user clicks an operation.
     * @param pathName
     * @param opName
     */
    public selectOperation(pathName: string, opName: string): void {
        console.info("Selected operation: %s :: %s", pathName, opName);
        // Possible de-select the operation if it's clicked on but already selected.
        if (this.selectedType === "operation" && this.selectedItem === pathName && this.subselectedItem === opName) {
            this.selectPath(pathName);
        } else {
            this.selectedType = "operation";
            this.selectedItem = pathName;
            this.subselectedItem = opName;
        }
    }

    /**
     * Called to deselect the currently selected operation.
     */
    public deselectOperation(): void {
        if (this.selectedType !== "operation") {
            return;
        }
        this.selectedType = "path";
        this.subselectedItem = null;
    }

    /**
     * Called when the user selects a definition from the master area.
     * @param name
     */
    public selectDefinition(name: string): void {
        this.selectedItem = name;
        this.selectedType = "definition";

        console.info("Selected item: %s", this.selectedItem);
        console.info("Selected type: %s", this.selectedType);
    }

    /**
     * Deselects the currently selected definition.
     */
    public deselectDefinition(): void {
        this.selectMain();
    }

    /**
     * Called when the user selects a response from the master area.
     * @param name
     */
    public selectResponse(name: string): void {
        this.selectedItem = name;
        this.selectedType = "response";
    }

    /**
     * Deselects the currently selected response.
     */
    public deselectResponse(): void {
        this.selectMain();
    }

    /**
     * Called whenever the user presses a key.
     * @param event
     */
    public onGlobalKeyDown(event: KeyboardEvent): void {
        // TODO skip any event that was sent to an input field (e.g. input, textarea, etc)
        if (event.ctrlKey && event.key === 'z' && !event.metaKey && !event.altKey) {
            console.info("[ApiEditorComponent] User wants to 'undo' the last command.");
            this._commands.undoLastCommand(this.document());
            if (this._commands.isEmpty()) {
                this.onDirty.emit(false);
            }
        }
        if (event.ctrlKey && event.key === 'y' && !event.metaKey && !event.altKey) {
            console.info("[ApiEditorComponent] User wants to 'undo' the last command.");
            this._commands.redoLastCommand(this.document());
            this.onDirty.emit(true);
        }
        if (event.key === "Escape"  && !event.metaKey && !event.altKey && !event.ctrlKey) {
            this.closeContextMenu();
        }
    }

    /**
     * Called when an editor component creates a command that should be executed.
     * @param command
     */
    public onCommand(command: ICommand): void {
        console.info("[ApiEditorComponent] Executing a command.");
        this._commands.executeCommand(command, this.document());
        this.onDirty.emit(true);
    }

    /**
     * Called to return the currently selected path (if one is selected).  If not, returns "/".
     */
    public getCurrentPathSelection(): string {
        if (this.selectedType === "path" || this.selectedType === "operation") {
            return this.selectedItem;
        }
        return "/";
    }

    /**
     * Called when the user fills out the Add Path modal dialog and clicks Add.
     */
    public addPath(path: string): void {
        let command: ICommand = new NewPathCommand(path);
        this.onCommand(command);
        this.selectPath(path);
    }

    /**
     * Returns the currently selected path item.
     * @return {any}
     */
    public selectedPath(): Oas20PathItem {
        if (this.selectedType === "path") {
            return this.document().paths.pathItem(this.selectedItem);
        } else {
            return null;
        }
    }

    /**
     * Returns the currently selected operation.
     */
    public selectedOperation(): Oas20Operation {
        if (this.selectedType === "operation") {
            return this.document().paths.pathItem(this.selectedItem)[this.subselectedItem];
        } else {
            return null;
        }
    }

    /**
     * Returns the currently selected definition.
     * @return {any}
     */
    public selectedDefinition(): Oas20DefinitionSchema {
        if (this.selectedType === "definition") {
            return this.document().definitions.definition(this.selectedItem);
        } else {
            return null;
        }
    }

    /**
     * Called to test whether the given resource path has an operation of the given type defined.
     * @param path
     * @param operation
     */
    public hasOperation(path: string, operation: string): boolean {
        let pathItem: Oas20PathItem = this.document().paths.pathItem(path);
        if (pathItem) {
            let op: Oas20Operation = pathItem[operation];
            if (op !== null && op !== undefined) {
                return true;
            }
        }
        return false;
    }

    public hasAtLeastOneOperation(path: string): boolean {
        let pathItem: Oas20PathItem = this.document().paths.pathItem(path);
        if (pathItem) {
            if (pathItem.get) {
                return true;
            }
            if (pathItem.put) {
                return true;
            }
            if (pathItem.post) {
                return true;
            }
            if (pathItem.delete) {
                return true;
            }
            if (pathItem.options) {
                return true;
            }
            if (pathItem.head) {
                return true;
            }
            if (pathItem.patch) {
                return true;
            }
        }
        return false;
    }

    /**
     * Called when the user fills out the Add Definition modal dialog and clicks Add.
     */
    public addDefinition(modalData: any): void {
        let command: ICommand = new NewDefinitionCommand(modalData.name, modalData.example);
        this.onCommand(command);
        this.selectDefinition(modalData.name);
    }

    /**
     * Gets the current API information (content and meta-data) and
     * @return {ApiDefinition}
     */
    public getUpdatedApiDefinition(): ApiDefinition {
        let updatedApiDef: ApiDefinition = ApiDefinition.fromApi(this.api);
        if (this.document().info && this.document().info.title) {
            updatedApiDef.name = this.document().info.title;
        }
        if (this.document().info && this.document().info.description) {
            updatedApiDef.description = this.document().info.description;
        }
        updatedApiDef.spec = this._library.writeNode(this.document());
        updatedApiDef.version = this.api.version;
        updatedApiDef.modifiedOn = new Date();
        // TODO update the modifiedBy here with the currently logged-in user!
        //updatedApiDef.modifiedBy = "";
        return updatedApiDef;
    }

    /**
     * Called to reset the editor's internal state.
     */
    public reset(): void {
        this._document = null;
        this._commands.reset();
        this.onDirty.emit(false);
    }

    /**
     * Called when the user searches in the master area.
     * @param criteria
     */
    public filterAll(criteria: string): void {
        console.info("[ApiEditorComponent] Filtering master items: %s", criteria);
        this.filterCriteria = criteria;
        if (this.filterCriteria !== null) {
            this.filterCriteria = this.filterCriteria.toLowerCase();
        }
    }

    /**
     * Returns true if the given name is accepted by the current filter criteria.
     * @param name
     * @return {boolean}
     */
    private acceptThroughFilter(name: string): boolean {
        if (this.filterCriteria === null) {
            return true;
        }
        return name.toLowerCase().indexOf(this.filterCriteria) != -1;
    }

    /**
     * Called when the user right-clicks on a path.
     * @param event
     * @param pathName
     */
    public showPathContextMenu(event: MouseEvent, pathName: string): void {
        event.preventDefault();
        event.stopPropagation();
        this.contextMenuPos.left = event.clientX + "px";
        this.contextMenuPos.top = event.clientY + "px";
        this.contextMenuType = "path";
        this.contextMenuItem = pathName;
    }

    @HostListener("document:click", ["$event"])
    public onDocumentClick(event: MouseEvent): void {
        this.closeContextMenu();
    }

    /**
     * Closes the context menu.
     */
    private closeContextMenu(): void {
        this.contextMenuItem = null;
        this.contextMenuType = null;
    }

    /**
     * Called when the user clicks "New Path" in the context-menu for a path.
     */
    public newPath(): void {
        this.addPathDialog.open(this.contextMenuItem);
        this.closeContextMenu();
    }

    /**
     * Called when the user clicks "Delete Path" in the context-menu for a path.
     */
    public deletePath(): void {
        let command: ICommand = new DeletePathCommand(this.contextMenuItem);
        this.onCommand(command);
        if (this.contextMenuItem === this.selectedItem) {
            this.selectMain();
        }
        this.closeContextMenu();
    }

    /**
     * Called when the user right-clicks on a path.
     * @param event
     * @param pathName
     */
    public showDefinitionContextMenu(event: MouseEvent, definitionName: string): void {
        event.preventDefault();
        event.stopPropagation();
        this.contextMenuPos.left = event.clientX + "px";
        this.contextMenuPos.top = event.clientY + "px";
        this.contextMenuType = "definition";
        this.contextMenuItem = definitionName;
    }

    /**
     * Called when the user clicks the "Delete Definition" item in the context-menu for a definition.
     */
    public deleteDefinition(): void {
        let command: ICommand = new DeleteDefinitionSchemaCommand(this.contextMenuItem);
        this.onCommand(command);
        if (this.contextMenuItem === this.selectedItem) {
            this.selectMain();
        }
        this.closeContextMenu();
    }

}
