# VScode Extension for codecarbon

> This extension uses the [python template for vscode](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-repository-from-a-template).

This repository implements an extension for vscode that uses [codecarbon](https://github.com/mlco2/codecarbon). Codecarbon is the package that calculates the carbon emissions of your code. For any new request related the extension, please open an issue in this repository, for any request related to the codecarbon package, please open an issue in the [codecarbon repository](https://github.com/mlco2/codecarbon).

## About vscode extensions in python

Vscode uses Nodejs for the frontend and Typescript for the extension part. The backend can be written in any language that supports the [Language Server Protocol](https://microsoft.github.io/language-server-protocol). Since codecarbon is a python package, we will use python for the backend.

The extension template has two parts, the extension part and language server part. The extension part is written in TypeScript, and language server part is written in Python over the [_pygls_][pygls] (Python language server) library.

For the most part you will be working on the python part of the code when using this template. You will be integrating your tool with the extension part using the [Language Server Protocol](https://microsoft.github.io/language-server-protocol). [_pygls_][pygls] currently works on the [version 3.16 of LSP](https://microsoft.github.io/language-server-protocol/specifications/specification-3-16/).

The TypeScript part handles working with VS Code and its UI. The extension template comes with few settings pre configured that can be used by your tool. If you need to add new settings to support your tool, you will have to work with a bit of TypeScript. The extension has examples for few settings that you can follow. You can also look at extensions developed by our team for some of the popular tools as reference.

## Requirements

1. VS Code 1.64.0 or greater
1. Python 3.7 or greater
1. node >= 14.19.0
1. npm >= 8.3.0 (`npm` is installed with node, check npm version, use `npm install -g npm@8.3.0` to update)
1. Python extension for VS Code

You should know to create and work with python virtual environments.

# How to contribute?

1. Check-out your repo locally on your development machine.
1. Create and activate a python virtual environment for this project in a terminal. Be sure to use the minimum version of python for your tool. This template was written to work with python 3.7 or greater.
1. Install `nox` in the activated environment: `python -m pip install nox`.
1. Add your favorite tool to `requirements.in`
1. Run `nox --session setup`.
1. **Optional** Install test dependencies `python -m pip install -r src/test/python_tests/requirements.txt`. You will have to install these to run tests from the Test Explorer.
1. Install node packages using `npm install`.
1. Make your changes.
1. Create a pull request.

## Adding features

-   Open `bundled/tool/lsp_server.py`, here is where you will do most of the changes. This is the language server that will be running in the background and launching/stopping `codecarbon`.
-   `src/extension.ts` : You may need to update this to add new settings or commands.
-   `src/settings.ts` : You may need to update this to add new settings.

## Building and Run the extension

Run the `Debug Extension and Python` configuration form VS Code. That should build and debug the extension in host window.

Note: if you just want to build you can run the build task in VS Code (`ctrl`+`shift`+`B`)

## Debugging

To debug both TypeScript and Python code use `Debug Extension and Python` debug config. This is the recommended way. Also, when stopping, be sure to stop both the Typescript, and Python debug sessions. Otherwise, it may not reconnect to the python session.

To debug only TypeScript code, use `Debug Extension` debug config.

To debug a already running server or in production server, use `Python Attach`, and select the process that is running `lsp_server.py`.

## Logging and Logs

The template creates a logging Output channel that can be found under `Output` > `codecarbon` panel. You can control the log level running the `Developer: Set Log Level...` command from the Command Palette, and selecting your extension from the list. It should be listed using the display name for your tool. You can also set the global log level, and that will apply to all extensions and the editor.

If you need logs that involve messages between the Language Client and Language Server, you can set `"codecarbon.server.trace": "verbose"`, to get the messaging logs. These logs are also available `Output` > `codecarbon` panel.

## Adding new Settings or Commands

You can add new settings by adding details for the settings in `package.json` file. To pass this configuration to your python tool server (i.e, `lsp_server.py`) update the `settings.ts` as need. There are examples of different types of settings in that file that you can base your new settings on.

## Packaging and Publishing

1. Update various fields in `package.json`. At minimum, check the following fields and update them accordingly. See [extension manifest reference](https://code.visualstudio.com/api/references/extension-manifest) to add more fields:
    - `"publisher"`: Update this to your publisher id from <https://marketplace.visualstudio.com/>.
    - `"version"`: See <https://semver.org/> for details of requirements and limitations for this field.
1. Build package using `nox --session build_package`.
1. Take the generated `.vsix` file and upload it to your extension management page <https://marketplace.visualstudio.com/manage>.

## Upgrading Dependencies

Dependabot yml is provided to make it easy to setup upgrading dependencies in this extension. Be sure to add the labels used in the dependabot to your repo.

To manually upgrade your local project:

1. Create a new branch
1. Run `npm update` to update node modules.
1. Run `nox --session setup` to upgrade python packages.

## Troubleshooting

1. If you are having trouble with the extension, you can check the logs in the `Output` > `codecarbon` panel.
