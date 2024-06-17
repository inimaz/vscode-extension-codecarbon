import { LanguageClient } from 'vscode-languageclient/node';
import { startTracker, stopTracker } from '../../common/lspActions';
jest.mock(
    'vscode',
    () => ({
        window: {
            createStatusBarItem: jest.fn(() => ({
                show: jest.fn(),
                hide: jest.fn(),
                text: '',
            })),
            showInformationMessage: jest.fn().mockResolvedValue('Open'),
            showTextDocument: jest.fn(),
        },
        Uri: { file: jest.fn() },
    }),
    { virtual: true },
);
import * as vscode from 'vscode';

const lsClient = {
    sendRequest: jest.fn(),
} as unknown as jest.Mocked<LanguageClient>;
const statusBarItem = { text: '', command: '', tooltip: '' } as unknown as vscode.StatusBarItem;
const serverId = 'test';
describe('LSP Actions', () => {
    describe('startTracker', () => {
        afterAll(() => {
            jest.clearAllMocks();
        });
        test('should start the tracker', async () => {
            lsClient.sendRequest.mockImplementationOnce(() => Promise.resolve({ emissions: 0, emissions_file: '' }));
            await startTracker(lsClient, statusBarItem, serverId);
            expect(lsClient.sendRequest).toHaveBeenCalledWith('codecarbon.startTracker', {});
            expect(statusBarItem.text).toBe('$(pulse) Codecarbon (Running)');
            expect(statusBarItem.command).toBe('test.stop');
            expect(statusBarItem.tooltip).toBe('Stop CodeCarbon tracker');
        });
    });
    describe('stopTracker', () => {
        afterEach(() => {
            jest.clearAllMocks();
        });
        test('should stop the tracker -- no emissions detected', async () => {
            lsClient.sendRequest.mockImplementationOnce(() => Promise.resolve({ emissions: 0, emissions_file: '' }));
            await stopTracker(lsClient, statusBarItem);
            expect(lsClient.sendRequest).toHaveBeenCalledWith('codecarbon.stopTracker', {});
            expect(statusBarItem.text).toBe('$(pulse) Codecarbon');
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                'CodeCarbon tracker stopped. No emissions detected.',
            );
        });
        test('should stop the tracker -- emissions detected and user opens the file', async () => {
            lsClient.sendRequest.mockImplementationOnce(() =>
                Promise.resolve({ emissions: 0.5, emissions_file: 'someFile.csv' }),
            );
            // vscode.window.showInformationMessage.mockImplementationOnce('Open');
            await stopTracker(lsClient, statusBarItem);
            expect(lsClient.sendRequest).toHaveBeenCalledWith('codecarbon.stopTracker', {});
            expect(statusBarItem.text).toBe('$(pulse) Codecarbon');
            expect(vscode.window.showInformationMessage).toHaveBeenNthCalledWith(
                1,
                'CodeCarbon tracker stopped. Emissions: ~ 0.50 kgCO2e.',
            );
            expect(vscode.window.showInformationMessage).toHaveBeenNthCalledWith(
                2,
                'Emissions file: someFile.csv',
                'Open',
                'Cancel',
            );
            // The user has clicked Open, so the file should be opened
            expect(vscode.window.showTextDocument).toHaveBeenCalled();
        });
        test('should stop the tracker -- emissions detected and user does not open file', async () => {
            (jest.spyOn(vscode.window, 'showInformationMessage') as any).mockResolvedValue('Cancel');
            lsClient.sendRequest.mockImplementationOnce(() =>
                Promise.resolve({ emissions: 0.5, emissions_file: 'someFile.csv' }),
            );
            // vscode.window.showInformationMessage.mockImplementationOnce('Open');
            await stopTracker(lsClient, statusBarItem);
            expect(lsClient.sendRequest).toHaveBeenCalledWith('codecarbon.stopTracker', {});
            expect(statusBarItem.text).toBe('$(pulse) Codecarbon');
            expect(vscode.window.showInformationMessage).toHaveBeenNthCalledWith(
                1,
                'CodeCarbon tracker stopped. Emissions: ~ 0.50 kgCO2e.',
            );
            expect(vscode.window.showInformationMessage).toHaveBeenNthCalledWith(
                2,
                'Emissions file: someFile.csv',
                'Open',
                'Cancel',
            );
            // The user has clicked Cancel, so the file should not be opened
            expect(vscode.window.showTextDocument).not.toHaveBeenCalled();
        });
    });
});
