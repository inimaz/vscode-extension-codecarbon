import { ChildProcess, spawn } from 'child_process';
import * as vscode from 'vscode';
import * as path from 'path';
import { traceError, traceLog } from './log/logging';
const DEFAULT_STATUS_BAR_TEXT = `$(pulse) Codecarbon`;
let emissions_file: string | null = null;
let emissions: number | null = null;

// Relative path
const relativePath = '../scripts/tracker.py';
// Get the absolute path
const scriptPath = path.resolve(__dirname, relativePath);
export const startTracker = async (
    pythonPath: string,
    pythonProcess: ChildProcess | null = null,
    statusBarItem: vscode.StatusBarItem,
    pythonPackageName: string,
) => {
    if (pythonProcess) {
        vscode.window.showInformationMessage('Python package is already running.');
        return null;
    }

    // Launch Python package using spawn
    pythonProcess = spawn(pythonPath, [scriptPath, 'start']);

    //
    pythonProcess.stderr?.on('data', (data) => {
        traceError(`Python error: ${data}`);
    });

    pythonProcess.stdout?.on('data', (data) => {
        traceLog(`Python output: ${data}`);
        _parseLogs(data.toString());
    });

    pythonProcess.on('close', (code) => {
        pythonProcess = null;
    });
    statusBarItem.text = `${DEFAULT_STATUS_BAR_TEXT} (Running)`;
    statusBarItem.command = `${pythonPackageName}.stop`;
    statusBarItem.tooltip = `Stop CodeCarbon tracker`;
    return pythonProcess;
};
export const stopTracker = async (
    pythonPath: string,
    pythonProcess: ChildProcess | null = null,
    statusBarItem: vscode.StatusBarItem,
) => {
    if (pythonProcess) {
        statusBarItem.text = `${DEFAULT_STATUS_BAR_TEXT} (Stopping)`;
        const stopProcess = pythonProcess.kill('SIGTERM');
        pythonProcess = null; // Reset `pythonProcess` to indicate it’s stopped
    }
    // Reset the status bar to its original state
    initializeStatusBar(statusBarItem, DEFAULT_STATUS_BAR_TEXT);

    if (emissions_file) {
        // Ask the user if they want to open the emissions file
        const openFileKey = 'Open';
        const cancelKey = 'Cancel';
        const selection = await vscode.window.showInformationMessage(
            `Emissions file: ${emissions_file}`,
            openFileKey,
            cancelKey,
        );
        if (selection === openFileKey) {
            vscode.window.showTextDocument(vscode.Uri.file(emissions_file));
        }
    }
    return pythonProcess;
};

/**
 * Format the emissions number to a string with the appropriate unit
 * @param value The emissions value
 * @param decimals The number of decimal places to round to
 * @returns The formatted emissions number
 *
 * Example:
 * formatEmissionsNumber(0.0001, 2) -> '1.00e-4 kgCO2e'
 */
const formatEmissionsNumber = (value: number, decimals: number): string => {
    const unit = 'kgCO2e';
    let valueString = value.toFixed(decimals);
    // In e notation  if the number is smaller than 1e-3 or greater than 1e6
    if (value < 1e-3 || value > 1e6) {
        valueString = value.toExponential(decimals).replace('+', '');
    }
    return `${valueString} ${unit}`;
};

export const initializeStatusBar = (statusBarItem: vscode.StatusBarItem, text = DEFAULT_STATUS_BAR_TEXT) => {
    statusBarItem.text = text;
    statusBarItem.command = `codecarbon.start`;
    statusBarItem.tooltip = `Start CodeCarbon tracker`;
};

/**
 * Parse the logs from the Python package
 * @param data
 */
const _parseLogs = async (data: string) => {
    if (data.includes('emissions:')) {
        emissions = parseFloat(data.split(':')[1].trim());
        if (!emissions || isNaN(emissions) || emissions === 0 || emissions === undefined || emissions === null) {
            vscode.window.showInformationMessage('CodeCarbon tracker stopped. No emissions detected.');
        } else {
            traceLog(`Emissions: ${emissions}`);
            vscode.window.showInformationMessage(
                `CodeCarbon tracker stopped. Emissions of the last run: ${formatEmissionsNumber(emissions, 2)}`,
            );
        }
    } else if (data.includes('Saving emissions data to file')) {
        emissions_file = data.split('Saving emissions data to file')[1].trim();
        traceLog(`Emissions file: ${emissions_file}`);
    }
};
