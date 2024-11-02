import * as vscode from 'vscode';
import { registerLogger, traceLog, traceVerbose } from './common/log/logging';
import { checkIfConfigurationChanged, getGlobalSettings, getInterpreterFromSetting } from './common/settings';
import { installPythonPackage, isPythonPackageInstalled, loadPythonPackageDefaults } from './common/setup';
import { createOutputChannel, onDidChangeConfiguration, registerCommand } from './common/vscodeapi';
import { initializeStatusBar, startTracker, stopTracker } from './common/actions';
import { ChildProcess } from 'child_process';
import { ResolvedEnvironment } from '@vscode/python-extension';

let pythonProcess: ChildProcess | null = null;
const DEFAULT_INTERPRETER_PATH = 'python';
let interpreter = { path: DEFAULT_INTERPRETER_PATH } as ResolvedEnvironment;
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    const pythonPackageInfo = loadPythonPackageDefaults();
    const packageName = pythonPackageInfo.name;
    const packageId = pythonPackageInfo.module;
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    initializeStatusBar(statusBarItem);
    statusBarItem.show();

    // Setup logging
    const outputChannel = createOutputChannel(packageName);
    context.subscriptions.push(outputChannel, registerLogger(outputChannel));

    // Log Server information
    traceLog(`Name: ${pythonPackageInfo.name}`);
    traceLog(`Module: ${pythonPackageInfo.module}`);
    traceVerbose(`Full Python Package Info: ${JSON.stringify(pythonPackageInfo)}`);

    const runPythonPackage = async (interpreter: ResolvedEnvironment) => {
        // Check that the package is correctly installed
        traceLog(`Using python interpreter: ${interpreter.path}`);
        const isInstalled = await isPythonPackageInstalled(interpreter.path, packageId);
        if (!isInstalled) {
            const install = await vscode.window.showWarningMessage(
                `The Python package "${packageName}" is not installed. Would you like to install it?`,
                'Yes',
                'No',
            );

            if (install === 'Yes') {
                vscode.window.showInformationMessage(`Installing "${packageName}"...`);
                try {
                    const response = await installPythonPackage(interpreter.path, packageId);
                    // If install fails, show an error message
                    if (!response.installed) {
                        vscode.window.showErrorMessage(`Failed to install ${packageName}. Error: ${response.error}`);
                        return;
                    }
                    vscode.window.showInformationMessage(`Successfully installed ${packageName}`);
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to install ${packageName}: ${error}`);
                    return;
                    return;
                    return;
                }
            } else {
                vscode.window.showErrorMessage(`Failed to install ${packageName}`);
                return;
            }
        }
        // If launchOnStartup is true, start the tracker
        const globalSettings = await getGlobalSettings(packageId);
        if (globalSettings.launchOnStartup) {
            pythonProcess = await startTracker(interpreter.path, pythonProcess, statusBarItem, packageId);
            traceLog(`Starting ${packageName} on startup`);
        }
    };
    context.subscriptions.push(
        onDidChangeConfiguration(async (e: vscode.ConfigurationChangeEvent) => {
            if (checkIfConfigurationChanged(e, packageId)) {
                await runPythonPackage(interpreter);
            }
        }),
        // Register commands
        registerCommand(`${packageId}.start`, async () => {
            pythonProcess = await startTracker(interpreter.path, pythonProcess, statusBarItem, packageId);
        }),
        registerCommand(`${packageId}.stop`, async () => {
            pythonProcess = await stopTracker(interpreter.path, pythonProcess, statusBarItem);
        }),
    );

    setImmediate(async () => {
        const userInterpreter = getInterpreterFromSetting(pythonPackageInfo.module);
        if (userInterpreter === undefined || userInterpreter.length === 0) {
            traceLog(`Python source interpreter not found in settings. Using default interpreter.`);
        } else {
            interpreter = { path: userInterpreter[0] } as ResolvedEnvironment;
        }
        await runPythonPackage(interpreter);
    });
}

export async function deactivate(): Promise<void> {
    if (pythonProcess) {
        pythonProcess.kill();
    }
}
