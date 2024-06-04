const GLOBAL_TASK_LABEL = 'codecarbon-emissions';
export const createTask = (vscode: any) => async () => {
    const tasks = vscode.workspace.getConfiguration('tasks');
    const customTasks = (tasks.get('tasks') as any[]) || [];
    const existingTask = customTasks.find((task) => task.label === GLOBAL_TASK_LABEL);
    if (existingTask) {
        vscode.window.showInformationMessage("A global task already exists to monitor your code's carbon emissions.");
        return;
    }
    const codecarbonLocation = await vscode.window.showInputBox({
        prompt: 'Enter the location of your codecarbon binary',
        placeHolder: 'e.g. /usr/local/bin/codecarbon',
    });

    if (!codecarbonLocation) {
        vscode.window.showErrorMessage('Python interpreter location is required');
        return;
    }

    const newTask = {
        label: GLOBAL_TASK_LABEL,
        type: 'shell',
        isBackground: true,
        command: `${codecarbonLocation} monitor --no-api`,
        presentation: {
            reveal: 'silent',
            close: true,
            panel: 'dedicated',
            showReuseMessage: false,
            echo: false,
        },
        runOptions: {
            runOn: 'folderOpen',
        },
        problemMatcher: {
            owner: 'custom',
            pattern: {
                regexp: '^(.*)$',
            },
            background: {
                activeOnStart: true,
                beginsPattern: '.*',
                endsPattern: '.*',
            },
        },
    };

    customTasks.push(newTask);
    await tasks.update('tasks', customTasks, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage(
        "A global task has been added to monitor your code's carbon emissions. This task will run every time you open a new workspace. \n See Seetings ==> User Tasks for more details.",
    );
};

export const deleteTask = (vscode: any) => async () => {
    const tasks = vscode.workspace.getConfiguration('tasks');
    const customTasks = (tasks.get('tasks') as any[]) || [];
    const existingTask = customTasks.find((task) => task.label === GLOBAL_TASK_LABEL);
    if (!existingTask) {
        vscode.window.showInformationMessage("No global task exists to monitor your code's carbon emissions.");
        return;
    }
    const newTasks = customTasks.filter((task) => task.label !== GLOBAL_TASK_LABEL);
    await tasks.update('tasks', newTasks, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage("The global task to monitor your code's carbon emissions has been removed.");
};
