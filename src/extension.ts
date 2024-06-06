// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';
import { registerLogger, traceError, traceLog, traceVerbose } from './common/log/logging';
import {
    checkVersion,
    getInterpreterDetails,
    initializePython,
    onDidChangePythonInterpreter,
    resolveInterpreter,
} from './common/python';
import { restartServer } from './common/server';
import { checkIfConfigurationChanged, getInterpreterFromSetting } from './common/settings';
import { loadServerDefaults } from './common/setup';
import { getLSClientTraceLevel } from './common/utilities';
import { createOutputChannel, onDidChangeConfiguration, registerCommand } from './common/vscodeapi';

let lsClient: LanguageClient | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    // This is required to get server name and module. This should be
    // the first thing that we do in this extension.
    const serverInfo = loadServerDefaults();
    const serverName = serverInfo.name;
    const serverId = serverInfo.module;
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    const DEFAULT_STATUS_BAR_TEXT = `$(pulse) ${serverName}`;
    initializeStatusBar(statusBarItem, DEFAULT_STATUS_BAR_TEXT);
    statusBarItem.show();
    // When the server is started the status bar item will be updated

    // Setup logging
    const outputChannel = createOutputChannel(serverName);
    context.subscriptions.push(outputChannel, registerLogger(outputChannel));

    const changeLogLevel = async (c: vscode.LogLevel, g: vscode.LogLevel) => {
        const level = getLSClientTraceLevel(c, g);
        await lsClient?.setTrace(level);
    };

    context.subscriptions.push(
        outputChannel.onDidChangeLogLevel(async (e) => {
            await changeLogLevel(e, vscode.env.logLevel);
        }),
        vscode.env.onDidChangeLogLevel(async (e) => {
            await changeLogLevel(outputChannel.logLevel, e);
        }),
    );

    // Log Server information
    traceLog(`Name: ${serverInfo.name}`);
    traceLog(`Module: ${serverInfo.module}`);
    traceVerbose(`Full Server Info: ${JSON.stringify(serverInfo)}`);

    const runServer = async () => {
        const interpreter = getInterpreterFromSetting(serverId);
        if (interpreter && interpreter.length > 0 && checkVersion(await resolveInterpreter(interpreter))) {
            traceVerbose(`Using interpreter from ${serverInfo.module}.interpreter: ${interpreter.join(' ')}`);
            lsClient = await restartServer(serverId, serverName, outputChannel, lsClient);
            return;
        }

        const interpreterDetails = await getInterpreterDetails();
        if (interpreterDetails.path) {
            traceVerbose(`Using interpreter from Python extension: ${interpreterDetails.path.join(' ')}`);
            lsClient = await restartServer(serverId, serverName, outputChannel, lsClient);
            return;
        }

        traceError(
            'Python interpreter missing:\r\n' +
                '[Option 1] Select python interpreter using the ms-python.python.\r\n' +
                `[Option 2] Set an interpreter using "${serverId}.interpreter" setting.\r\n` +
                'Please use Python 3.7 or greater.',
        );
    };
    context.subscriptions.push(
        onDidChangePythonInterpreter(async () => {
            await runServer();
        }),
        onDidChangeConfiguration(async (e: vscode.ConfigurationChangeEvent) => {
            if (checkIfConfigurationChanged(e, serverId)) {
                await runServer();
            }
        }),
        // Register commands
        registerCommand(`${serverId}.start`, async () => {
            await lsClient?.sendRequest('codecarbon.startTracker', {});
            statusBarItem.text = `${DEFAULT_STATUS_BAR_TEXT} (Running)`;
            statusBarItem.command = `${serverId}.stop`;
            statusBarItem.tooltip = `Stop CodeCarbon tracker`;
        }),
        registerCommand(`${serverId}.stop`, async () => {
            if (lsClient) {
                statusBarItem.text = `${DEFAULT_STATUS_BAR_TEXT} (Stopping)`;
                const response: { emissions: number; emissions_file: string } = await lsClient?.sendRequest(
                    'codecarbon.stopTracker',
                    {},
                );
                // Reset the status bar to its original state
                initializeStatusBar(statusBarItem, DEFAULT_STATUS_BAR_TEXT);
                if (
                    response.emissions === 0 ||
                    response.emissions === undefined ||
                    isNaN(response.emissions) ||
                    response.emissions === null
                ) {
                    vscode.window.showInformationMessage('CodeCarbon tracker stopped. No emissions detected.');
                } else {
                    vscode.window.showInformationMessage(
                        `CodeCarbon tracker stopped. Emissions: ~ ${formatEmissionsNumber(response.emissions, 2)}.`,
                    );

                    // Ask the user if they want to open the emissions file
                    const openFileKey = 'Open';
                    const cancelKey = 'Cancel';
                    const selection = await vscode.window.showInformationMessage(
                        `Emissions file: ${response.emissions_file}`,
                        openFileKey,
                        cancelKey,
                    );
                    if (selection === openFileKey) {
                        vscode.window.showTextDocument(vscode.Uri.file(response.emissions_file));
                    }
                }
            }
        }),
    );

    setImmediate(async () => {
        const interpreter = getInterpreterFromSetting(serverId);
        if (interpreter === undefined || interpreter.length === 0) {
            traceLog(`Python extension loading`);
            await initializePython(context.subscriptions);
            traceLog(`Python extension loaded`);
        } else {
            await runServer();
        }
    });
}

export async function deactivate(): Promise<void> {
    if (lsClient) {
        await lsClient.stop();
    }
}

const initializeStatusBar = (statusBarItem: vscode.StatusBarItem, text: string) => {
    statusBarItem.text = text;
    statusBarItem.command = `codecarbon.start`;
    statusBarItem.tooltip = `Start CodeCarbon tracker`;
};
const formatEmissionsNumber = (value: number, decimals: number): string => {
    const unit = 'kgCO2e';
    let valueString = value.toFixed(decimals);
    // In e notation  if the number is smaller than 1e-3 or greater than 1e6
    if (value < 1e-3 || value > 1e6) {
        valueString = value.toExponential(decimals).replace('+', '');
    }
    return `${valueString} ${unit}`;
};
