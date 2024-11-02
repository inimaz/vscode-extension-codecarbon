// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import * as fs from 'fs-extra';
const folderName = path.basename(__dirname);
export const EXTENSION_ROOT_DIR =
    folderName === 'common' ? path.dirname(path.dirname(__dirname)) : path.dirname(__dirname);

export interface IpythonPackageInfo {
    name: string;
    module: string;
}

export function loadPythonPackageDefaults(): IpythonPackageInfo {
    const packageJson = path.join(EXTENSION_ROOT_DIR, 'package.json');
    const content = fs.readFileSync(packageJson).toString();
    const config = JSON.parse(content);
    return config.pythonPackageInfo as IpythonPackageInfo;
}

import { exec } from 'child_process';

export async function isPythonPackageInstalled(pythonPath: string, packageName: string): Promise<boolean> {
    console.log('Python path:', pythonPath);
    return new Promise((resolve) => {
        exec(`${pythonPath} -m pip show ${packageName}`, (error, stdout, stderr) => {
            if (error) {
                resolve(false); // Package is not installed
            } else {
                resolve(true); // Package is installed
            }
        });
    });
}

export async function installPythonPackage(
    pythonPath: string,
    packageName: string,
): Promise<{ installed: boolean; error?: any }> {
    return new Promise((resolve) => {
        exec(`${pythonPath} -m pip --version`, (pipError) => {
            if (pipError) {
                // pip is not installed
                resolve({
                    installed: false,
                    error: new Error(
                        `${pythonPath} has no pip installed. Please install pip and try again. Or manually install the package ${packageName}`,
                    ),
                });
                return;
            }
            exec(`${pythonPath} -m pip install ${packageName}`, (error, stdout, stderr) => {
                if (error) {
                    resolve({ installed: false, error: error }); // Package is not installed
                } else {
                    resolve({ installed: true }); // Package is installed
                }
            });
        });
    });
}
