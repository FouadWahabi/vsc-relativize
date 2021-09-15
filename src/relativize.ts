import { Range, TextDocument, WorkspaceEdit, window, workspace } from "vscode";
import { parseImportNodes, relativizeImports } from "./parser";
import { dirname } from "path";

const importAliasRegex = new RegExp("link:(.+)");

function relativize(
    document: TextDocument,
    cb: (relativizedText: string) => void
) {
    try {
        const languageRegex = /^(java|type)script(react)*$/;
        if (!document.languageId.match(languageRegex)) {
            return;
        }

        const workspacePath =
            workspace.getWorkspaceFolder(document.uri)?.uri?.path + "/";
        if (!workspacePath) {
            return;
        }

        const currentFileDirectory = dirname(document.uri.path).replace(
            workspacePath,
            ""
        );

        const { importsStruct, importsText } = parseImportNodes(document);

        workspace
            .openTextDocument(workspacePath + "/package.json")
            .then((manifestDocument) => {
                const aliases: { [key: string]: string } = {};

                const manifest = manifestDocument.getText();
                const parsedManifest = JSON.parse(manifest);
                const dependencies = parsedManifest.dependencies;
                Object.keys(dependencies).map((key) => {
                    const match = importAliasRegex.exec(dependencies[key]);
                    if (match) {
                        aliases[key] = match[1];
                    }
                });

                const relativizedImports = relativizeImports(
                    currentFileDirectory,
                    importsStruct,
                    importsText,
                    aliases
                );

                const currentText = document.getText();

                cb(currentText.replace(importsText, relativizedImports));
            });
    } catch (exception) {
        window.showWarningMessage(
            `Could not relativize imports. - ${exception}`
        );
        return;
    }
}

function getMaxRange(): Range {
    return new Range(0, 0, Number.MAX_VALUE, Number.MAX_VALUE);
}

export function run() {
    const { activeTextEditor: editor } = window;
    const document = editor?.document;
    if (!document || !editor) {
        return;
    }
    relativize(document, (relativizedText) => {
        if (!relativizedText) {
            return;
        }

        editor.edit((edit) => {
            edit.replace(getMaxRange(), relativizedText);
        });
    });
}

export function runOnSave(document: TextDocument) {
    if (!workspace.getConfiguration("relativize").get("onSave")) {
        return;
    }

    relativize(document, (relativizedText) => {
        if (!relativizedText) {
            return;
        }

        const workspaceEdit = new WorkspaceEdit();
        workspaceEdit.replace(document.uri, getMaxRange(), relativizedText);
        return workspace.applyEdit(workspaceEdit).then(() => document.save());
    });
}
