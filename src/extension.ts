import { commands, ExtensionContext, workspace } from "vscode";
import { run, runOnSave } from "./relativize";

export function activate(context: ExtensionContext) {
    context.subscriptions.push(
        commands.registerCommand("relativize.run", () => {
            run();
        })
    );

    workspace.onDidSaveTextDocument(runOnSave);
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export function deactivate() {}
