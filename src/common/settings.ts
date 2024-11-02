// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { ConfigurationChangeEvent, ConfigurationScope, WorkspaceConfiguration, WorkspaceFolder } from 'vscode';
import { getConfiguration, getWorkspaceFolders } from './vscodeapi';

export interface ISettings {
    cwd: string;
    workspace: string;
    args: string[];
    path: string[];
    launchOnStartup: boolean;
}

export function getExtensionSettings(namespace: string, includeInterpreter?: boolean): Promise<ISettings[]> {
    return Promise.all(getWorkspaceFolders().map((w) => getWorkspaceSettings(namespace, w, includeInterpreter)));
}

function resolveVariables(value: string[], workspace?: WorkspaceFolder): string[] {
    const substitutions = new Map<string, string>();
    const home = process.env.HOME || process.env.USERPROFILE;
    if (home) {
        substitutions.set('${userHome}', home);
    }
    if (workspace) {
        substitutions.set('${workspaceFolder}', workspace.uri.fsPath);
    }
    substitutions.set('${cwd}', process.cwd());
    getWorkspaceFolders().forEach((w) => {
        substitutions.set('${workspaceFolder:' + w.name + '}', w.uri.fsPath);
    });

    return value.map((s) => {
        for (const [key, value] of substitutions) {
            s = s.replace(key, value);
        }
        return s;
    });
}

export function getInterpreterFromSetting(namespace: string, scope?: ConfigurationScope) {
    const config = getConfiguration(namespace, scope);
    return config.get<string[]>('interpreter');
}

export async function getWorkspaceSettings(
    namespace: string,
    workspace: WorkspaceFolder,
    includeInterpreter?: boolean,
): Promise<ISettings> {
    const config = getConfiguration(namespace, workspace.uri);

    let interpreter: string[] = [];
    if (includeInterpreter) {
        interpreter = config.get<string[]>(`interpreter`) ?? [];
    }

    const workspaceSetting = {
        cwd: workspace.uri.fsPath,
        workspace: workspace.uri.toString(),
        args: resolveVariables(config.get<string[]>(`args`) ?? [], workspace),
        path: resolveVariables(config.get<string[]>(`path`) ?? [], workspace),
        interpreter: resolveVariables(interpreter, workspace),
        importStrategy: config.get<string>(`importStrategy`) ?? 'fromEnvironment',
        showNotifications: config.get<string>(`showNotifications`) ?? 'off',
        outputFileDir: config.get<string>(`outputFileDir`) ?? 'userHome',
        launchOnStartup: config.get<boolean>(`launchOnStartup`) ?? true,
    };
    return workspaceSetting;
}

function getGlobalValue<T>(config: WorkspaceConfiguration, key: string, defaultValue: T): T {
    const inspect = config.inspect<T>(key);
    return inspect?.globalValue ?? inspect?.defaultValue ?? defaultValue;
}

export async function getGlobalSettings(namespace: string, includeInterpreter?: boolean): Promise<ISettings> {
    const config = getConfiguration(namespace);

    let interpreter: string[] = [];
    if (includeInterpreter) {
        interpreter = getGlobalValue<string[]>(config, 'interpreter', []);
    }

    const setting = {
        cwd: process.cwd(),
        workspace: process.cwd(),
        args: getGlobalValue<string[]>(config, 'args', []),
        path: getGlobalValue<string[]>(config, 'path', []),
        interpreter: interpreter,
        launchOnStartup: config.get<boolean>(`launchOnStartup`) ?? true,
    };
    return setting;
}

export function checkIfConfigurationChanged(e: ConfigurationChangeEvent, namespace: string): boolean {
    const settings = [
        `${namespace}.args`,
        `${namespace}.path`,
        `${namespace}.interpreter`,
        `${namespace}.launchOnStartup`,
    ];
    const changed = settings.map((s) => e.affectsConfiguration(s));
    return changed.includes(true);
}
