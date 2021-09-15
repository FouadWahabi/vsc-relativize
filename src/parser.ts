import * as vscode from "vscode";

export interface NamedImport {
    importName: string | null;
    alias: string | null;
}

export type DestructedImport = NamedImport;

export interface TypescriptImport {
    path: string;
    range: vscode.Range;
    default?: string;
    namedImports: DestructedImport[] | null;
    namespace?: string;
}

const name =
    "((?!\\d)(?:(?!\\s)[$\\w\\u0080-\\uFFFF]|\\\\u[\\da-fA-F]{4}|\\\\u\\{[\\da-fA-F]+\\})+)";
const ws = "[\\s\\n\\r]";

const namespaceToken = `\\*\\s+as\\s+(${name})`;
const defaultImportToken = name;
const destructingImportToken = `(${name})(\\s+as\\s+(${name}))?`;
const destructingImport = `{(${ws}*${destructingImportToken}(,${ws}*${destructingImportToken})*${ws}*)}`;
const defaultAndDestructingImport = `${defaultImportToken}${ws}*,${ws}*${destructingImport}`;
const combinedImportTypes = `(${namespaceToken}|${defaultImportToken}|${destructingImport}|${defaultAndDestructingImport})`;
const importRegexString = `^import\\s+(${combinedImportTypes}\\s+from\\s+)?['"]([@\\w\\\\/\.-]+)['"];?\\r?\\n?`;

// Group 5 || Group 18 - default import
// Group 3 - namespace import
// Group 6 || Group 19 - destructing import group; requires further tokenizing
// Group 31 - file path or package
const importRegex = new RegExp(importRegexString, "gm");

// Group 1 - importName
// Group 4 - alias
const destructingImportTokenRegex = new RegExp(destructingImportToken);

export function parseImportNodes(document: vscode.TextDocument) {
    const source = document.getText();
    importRegex.lastIndex = 0;
    const imports: TypescriptImport[] = [];

    let match;
    // eslint-disable-next-line no-cond-assign
    while ((match = importRegex.exec(source))) {
        imports.push({
            path: match[31],
            default: match[5] || match[18],
            namedImports: parseDestructiveImports(match[6] || match[19]),
            namespace: match[3],
            range: new vscode.Range(
                document.positionAt(match.index),
                document.positionAt(importRegex.lastIndex)
            ),
        });
    }

    const importsText = imports.length
        ? source
              .split("\n")
              .slice(0, imports[imports.length - 1].range.end.line + 1)
              .join("\n")
        : "";
    return { importsStruct: imports, importsText };
}

export function relativizeImports(
    currentFileDirectory: string,
    importClauses: TypescriptImport[],
    importsText: string,
    aliases: { [key: string]: string }
) {
    if (!importClauses || importClauses.length === 0) {
        return importsText;
    }

    let newImportsText = importsText;
    let currentFileDirectoryWithAlias = currentFileDirectory;

    for (const key of Object.keys(aliases)) {
        const link = aliases[key];
        if (currentFileDirectory.startsWith(link)) {
            currentFileDirectoryWithAlias = currentFileDirectory.replace(
                link,
                key
            );
            break;
        }
    }

    importClauses.map((importClause) => {
        const path = importClause.path;

        if (path.startsWith(currentFileDirectoryWithAlias)) {
            newImportsText = newImportsText.replace(
                path,
                path.replace(currentFileDirectoryWithAlias, ".")
            );
        }
    });

    return newImportsText;
}

function parseDestructiveImports(
    destructiveImports: string
): DestructedImport[] | null {
    if (!destructiveImports) {
        return null;
    }

    return destructiveImports.split(",").map((destructiveImport) => {
        const match = destructingImportTokenRegex.exec(destructiveImport);
        return {
            importName: match?.[1] ?? null,
            alias: match?.[4] ?? null,
        };
    });
}
