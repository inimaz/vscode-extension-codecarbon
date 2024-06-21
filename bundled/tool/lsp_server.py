# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.
"""Implementation of tool support over LSP."""
from __future__ import annotations

import copy
import json
import os
import pathlib
import sys
import traceback
from typing import Any, Optional


# **********************************************************
# Update sys.path before importing any bundled libraries.
# **********************************************************
def update_sys_path(path_to_add: str, strategy: str) -> None:
    """Add given path to `sys.path`."""
    if path_to_add not in sys.path and os.path.isdir(path_to_add):
        if strategy == "useBundled":
            sys.path.insert(0, path_to_add)
        elif strategy == "fromEnvironment":
            sys.path.append(path_to_add)


# Ensure that we can import LSP libraries, and other bundled libraries.
update_sys_path(
    os.fspath(pathlib.Path(__file__).parent.parent / "libs"),
    os.getenv("LS_IMPORT_STRATEGY", "useBundled"),
)

# **********************************************************
# Imports needed for the language server goes below this.
# **********************************************************
import lsp_jsonrpc as jsonrpc
import lsp_utils as utils
import lsprotocol.types as lsp
from pygls import server, uris, workspace

WORKSPACE_SETTINGS = {}
GLOBAL_SETTINGS = {}
RUNNER = pathlib.Path(__file__).parent / "lsp_runner.py"

MAX_WORKERS = 5
LSP_SERVER = server.LanguageServer(
    name="Codecarbon", version="0.0.1", max_workers=MAX_WORKERS
)


# **********************************************************
# Tool specific code goes below this.
# **********************************************************

# Reference:
#  LS Protocol:
#  https://microsoft.github.io/language-server-protocol/specifications/specification-3-16/
#
#  Sample implementations:
#  Pylint: https://github.com/microsoft/vscode-pylint/blob/main/bundled/tool
#  Black: https://github.com/microsoft/vscode-black-formatter/blob/main/bundled/tool
#  isort: https://github.com/microsoft/vscode-isort/blob/main/bundled/tool


TOOL_MODULE = "codecarbon"
TOOL_DISPLAY = "Codecarbon"
OUTPUT_EMISSIONS_FILE = ".codecarbon.emissions.csv"
# Initialize the tracker to None
tracker = None

# **********************************************************
# Required Language Server Initialization and Exit handlers.
# **********************************************************
@LSP_SERVER.feature(lsp.INITIALIZE)
def initialize(params: lsp.InitializeParams) -> None:
    """LSP handler for initialize request."""
    log_to_output(f"CWD Server: {os.getcwd()}")

    paths = "\r\n   ".join(sys.path)
    log_to_output(f"sys.path used to run Server:\r\n   {paths}")

    GLOBAL_SETTINGS.update(**params.initialization_options.get("globalSettings", {}))

    settings = params.initialization_options["settings"]
    _update_workspace_settings(settings)
    log_to_output(
        f"Settings used to run Server:\r\n{json.dumps(settings, indent=4, ensure_ascii=False)}\r\n"
    )
    log_to_output(
        f"Global settings:\r\n{json.dumps(GLOBAL_SETTINGS, indent=4, ensure_ascii=False)}\r\n"
    )

    _initialize_tracker()


# When the client calls the codecarbon.start command, the server will run the tool.
@LSP_SERVER.feature("codecarbon.startTracker")
def on_command_start(_params: Optional[Any] = None):
    global tracker
    tracker.start()
    log_to_output("Emissions tracking started.")

# When the client calls the codecarbon.stop command, the tracker will be stopped.
@LSP_SERVER.feature("codecarbon.stopTracker")
def on_command_stop(_params: Optional[Any] = None):
    global tracker
    if tracker:
        emissions = tracker.stop()
        output_dir = _initialize_tracker()
        response = {"emissions": emissions, "emissions_file": output_dir + "/" + OUTPUT_EMISSIONS_FILE}
        log_to_output("Emissions tracking stopped. Emissions: " + str(emissions) + " kgCO2e")
        return response
    else:
        log_to_output("Emissions tracking not started. Nothing to do here.")

@LSP_SERVER.feature(lsp.EXIT)
def on_exit(_params: Optional[Any] = None) -> None:
    """Handle clean up on exit."""
    jsonrpc.shutdown_json_rpc()


@LSP_SERVER.feature(lsp.SHUTDOWN)
def on_shutdown(_params: Optional[Any] = None) -> None:
    """Handle clean up on shutdown."""
    jsonrpc.shutdown_json_rpc()


def _get_global_defaults():
    return {
        "path": GLOBAL_SETTINGS.get("path", []),
        "interpreter": GLOBAL_SETTINGS.get("interpreter", [sys.executable]),
        "args": GLOBAL_SETTINGS.get("args", []),
        "importStrategy": GLOBAL_SETTINGS.get("importStrategy", "useBundled"),
        "showNotifications": GLOBAL_SETTINGS.get("showNotifications", "off"),
        "outputFileLocation": GLOBAL_SETTINGS.get("outputFileLocation", "userHome"),
    }


def _update_workspace_settings(settings):
    if not settings:
        key = os.getcwd()
        WORKSPACE_SETTINGS[key] = {
            "cwd": key,
            "workspaceFS": key,
            "workspace": uris.from_fs_path(key),
            **_get_global_defaults(),
        }
        return

    for setting in settings:
        key = uris.to_fs_path(setting["workspace"])
        WORKSPACE_SETTINGS[key] = {
            **setting,
            "workspaceFS": key,
        }



def _get_document_key(document: workspace.Document):
    if WORKSPACE_SETTINGS:
        document_workspace = pathlib.Path(document.path)
        workspaces = {s["workspaceFS"] for s in WORKSPACE_SETTINGS.values()}

        # Find workspace settings for the given file.
        while document_workspace != document_workspace.parent:
            if str(document_workspace) in workspaces:
                return str(document_workspace)
            document_workspace = document_workspace.parent

    return None


def _get_settings_by_document(document: workspace.Document | None):
    if document is None or document.path is None:
        return list(WORKSPACE_SETTINGS.values())[0]

    key = _get_document_key(document)
    if key is None:
        # This is either a non-workspace file or there is no workspace.
        key = os.fspath(pathlib.Path(document.path).parent)
        return {
            "cwd": key,
            "workspaceFS": key,
            "workspace": uris.from_fs_path(key),
            **_get_global_defaults(),
        }

    return WORKSPACE_SETTINGS[str(key)]


# *****************************************************
# Internal execution APIs.
# *****************************************************

def _initialize_tracker() -> utils.RunResult:
    """Runs tool."""
    # deep copy here to prevent accidentally updating global settings.
    settings = copy.deepcopy(_get_settings_by_document(None))

    code_workspace = settings["workspaceFS"]
    cwd = settings["workspaceFS"]
    log_to_output(f"Running tool in workspace: {code_workspace}")
    log_to_output(f"Settings used to run tool:{json.dumps(settings, indent=4, ensure_ascii=False)}")

    log_to_output(f"CWD: {cwd}")
    # This is needed to preserve sys.path, in cases where the tool modifies
    # sys.path and that might not work for this scenario next time around.
    with utils.substitute_attr(sys, "path", sys.path[:]):
        try:
            from codecarbon import EmissionsTracker
        except ImportError as e:
            # TODO: Add installation instructions.
            # log_to_output("Installing codecarbon...")
            log_error(f"codecarbon is not installed. Error: {traceback.format_exc(chain=True)}")
            return utils.RunResult(None, f"codecarbon is not installed. Error: {traceback.format_exc(chain=True)}")
            
        
        try:
            global tracker
            output_dir = _get_output_file_dir(settings)
            log_to_output(f"Output directory: {output_dir}")              
            tracker = EmissionsTracker(
                measure_power_secs=5,
                output_dir=output_dir,
                output_file= OUTPUT_EMISSIONS_FILE  
            )
            result = utils.RunResult("Emissions tracker initialized",None)

        except Exception:
            result = utils.RunResult(None, traceback.format_exc(chain=True))
            log_error(traceback.format_exc(chain=True))
            if result.stderr:
                log_to_output(result.stderr)
            raise
    log_to_output(f"\r\n{result.stdout}\r\n")
    return output_dir

def _get_output_file_dir(settings: dict) -> str:
    output_file_dir = settings.get("outputFileDir", "userHome")
    if output_file_dir == "cwd":
        return settings["cwd"]
    elif output_file_dir == "userHome":
        return os.path.expanduser("~")

# *****************************************************
# Logging and notification.
# *****************************************************
def log_to_output(
    message: str, msg_type: lsp.MessageType = lsp.MessageType.Log
) -> None:
    LSP_SERVER.show_message_log(message, msg_type)


def log_error(message: str) -> None:
    LSP_SERVER.show_message_log(message, lsp.MessageType.Error)
    if os.getenv("LS_SHOW_NOTIFICATION", "off") in ["onError", "onWarning", "always"]:
        LSP_SERVER.show_message(message, lsp.MessageType.Error)


def log_warning(message: str) -> None:
    LSP_SERVER.show_message_log(message, lsp.MessageType.Warning)
    if os.getenv("LS_SHOW_NOTIFICATION", "off") in ["onWarning", "always"]:
        LSP_SERVER.show_message(message, lsp.MessageType.Warning)


def log_always(message: str) -> None:
    LSP_SERVER.show_message_log(message, lsp.MessageType.Info)
    if os.getenv("LS_SHOW_NOTIFICATION", "off") in ["always"]:
        LSP_SERVER.show_message(message, lsp.MessageType.Info)

# *****************************************************
# Start the server.
# *****************************************************
if __name__ == "__main__":
    LSP_SERVER.start_io()
