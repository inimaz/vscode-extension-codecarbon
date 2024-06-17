import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';
const DEFAULT_STATUS_BAR_TEXT = `$(pulse) Codecarbon`;
/**
 * LSP actions
 */
export const startTracker = async (
    lsClient: LanguageClient | undefined,
    statusBarItem: vscode.StatusBarItem,
    serverId: string,
) => {
    await lsClient?.sendRequest('codecarbon.startTracker', {});
    statusBarItem.text = `${DEFAULT_STATUS_BAR_TEXT} (Running)`;
    statusBarItem.command = `${serverId}.stop`;
    statusBarItem.tooltip = `Stop CodeCarbon tracker`;
};
export const stopTracker = async (lsClient: LanguageClient | undefined, statusBarItem: vscode.StatusBarItem) => {
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
            console.log('selection', selection);
            if (selection === openFileKey) {
                vscode.window.showTextDocument(vscode.Uri.file(response.emissions_file));
            }
        }
    }
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
