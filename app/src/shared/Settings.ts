import { app } from "electron";
import { APP_INFO } from "./AppInfo";
import { AnyObject } from "./Types";
import * as $Utils from "./Utils";

/**
 * Interface for app settings.
 */
export interface ISettings {
    /**
     * Properties of a browser window.
     * Currently only the offset and the size are stored.
     */
    Window: {
        /**
         * Left offset of window.
         */
        Left: number;
        /**
         * Top offset of window.
         */
        Top: number;
        /**
         * Treat Left and Top as relative to the the current screen. The
         * current screen is the one with the mouse cursor inside it.
         */
        LeftTopOfCurrentScreen: boolean;
        /**
         * Width of window.
         */
        Width: number;
        /**
         * Height of window.
         */
        Height: number;
        /**
         * Open new window with an offset relative to the current window (Left and Top).
         */
        NewRelativeToCurrent: boolean;
    };
    /**
     * Holds the keyboard shortcuts for various actions.
     */
    ShortCuts: {
        /**
         * Enable/disable shortcuts, if the URL entry field is focused.
         */
        Global: boolean,
        /**
         * Show/hide address bar.
         */
        ToggleAddressBar: string[],
        /**
         * Show/hide developer tools for the browser window.
         */
        ToggleInternalDevTools: string[],
        /**
         * Show/hide developer tools for the currently loaded URL.
         */
        ToggleDevTools: string[],
        /**
         * Show addressbar and focus the URL entry field.
         */
        FocusLocationBar: string[],
        /**
         * Open a new window.
         */
        NewWindow: string[],
        /**
         * Reload the browser window.
         */
        InternalReload: string[],
        /**
         * Reload the current page.
         */
        Reload: string[],
        /**
         * Go back in browser history.
         */
        GoBack: string[],
        /**
         * Go forward in browser history.
         */
        GoForward: string[],
        /**
         * Leave fullscreen view.
         */
        ExitHTMLFullscreen: string[];
        /**
         * Show/hide the menu on windows platforms.
         */
        ToggleWin32Menu: string[];
    };
    /**
     * All known request handler classes.
     */
    RequestHandlers: {
        /**
         * Request handler will be loaded or not.
         */
        Load: boolean;
        /**
         * Request handler is active or not.
         */
        Active: boolean;
        /**
         * JavaScrpt filename of request handler.
         */
        Source: string;
        /**
         * Configuration of request handler.
         */
        Config?: AnyObject;
    }[];
    /**
     * Log all requests made by users/pages.
     */
    LogRequests: boolean;
    /**
     * Copy all console messages from the loaded page to the internal console.
     */
    CaptureConsole: boolean;
    /**
     * The user agent string used by the browser.
     */
    UserAgent: string;
    /**
     * Permissions for the loaded page.
     */
    Permissions: string[];
    /**
     * Allow plugins to be loaded.
     */
    AllowPlugins: boolean;
    /**
     * Allow loaded pages to open popups.
     */
    AllowPopups: boolean;
    /**
     * Allow loaded pages to open new windows.
     */
    AllowNewWindows: boolean;
    /**
     * Delete all files in the user data directory after quitting the app.
     */
    ClearTraces: boolean;
    /**
     * Support single instance mode.
     */
    SingleInstance: boolean;
    /**
     * Activate the last open browser window if a new URL was requested via the command line.
     */
    FocusOnNewURL: boolean;
    /**
     * Force activating the app on Darwin.
     */
    DarwinForceFocus: boolean;
    /**
     * Enable hardware acceleration.
     */
    HardwareAcceleration: boolean;
    /**
     * Enable content protection for browser windows.
     */
    ContentProtection: boolean;
    /**
     * Availability of the addressbar.
     */
    AddressBar: number;
    /**
     * Initial state of menu on windows platforms.
     */
    Win32MenuState: number;
    /**
     * Open the given page on startup.
     */
    Homepage: string;
    /**
     * Scheme for builtin URLs like bb://settings
     */
    Scheme: string;
}

/**
 * Get settings object with default values.
 * @returns A Settings object.
 */
export function getDefaultSettings(): ISettings {
    /**
     * @see ISettings
     */
    /* eslint-disable jsdoc/require-jsdoc */
    return {
        Window: {
            Left: 10,
            Top: 10,
            LeftTopOfCurrentScreen: true,
            Width: 1280,
            Height: 900,
            NewRelativeToCurrent: true,
        },
        ShortCuts: {
            Global: true,
            ToggleAddressBar: ["mod+t"],
            ToggleInternalDevTools: ["mod+shift+d"],
            ToggleDevTools: ["mod+d"],
            FocusLocationBar: ["mod+l"],
            NewWindow: ["mod+n"],
            // InternalReload: ["mod+shift+r", "shift+f5"],
            InternalReload: [""],
            Reload: ["mod+r", "f5"],
            GoBack: ["ctrl+alt+left"],
            GoForward: ["ctrl+alt+right"],
            ExitHTMLFullscreen: ["esc"],
            ToggleWin32Menu: ["ctrl+h"],
        },
        RequestHandlers: [
            {
                Load: false,
                Active: false,
                Source: "../lib/RequestHandlers/RequestLoggerHandler.js"
            },
            {
                Load: false,
                Active: false,
                Source: "../lib/RequestHandlers/FilterRequestHandler.js",
                Config: {
                    Filter: [
                        "^https://github.com(/.*)?",
                        "^https://github.githubassets.com(/.*)?",
                        "^https?://(.*\\.)?heise.de(/.*)?",
                        "^https://heise.cloudimg.io(/.*)?",
                        "^<LOAD>$",
                        "^<BACK>$",
                        "^<FORWARD>$",
                        "^<RELOAD>$",
                        "^data:text/html,.*",
                        "^bb://.*"
                    ],
                    LogAllow: false,
                    LogDeny: true
                }
            },
            {
                Load: false,
                Active: false,
                Source: "../lib/RequestHandlers/RequestHandlerTemplate.js",
                Config: {
                    Log: true
                }
            },
            {
                Load: true,
                Active: true,
                Source: "../lib/RequestHandlers/DefaultRequestHandler.js",
                Config: {
                    Log: false
                }
            },
        ],
        LogRequests: false,
        CaptureConsole: true,
        UserAgent: app.userAgentFallback,
        Permissions: ["fullscreen"],
        AllowPlugins: false,
        AllowPopups: false,
        AllowNewWindows: true,
        ClearTraces: false,
        SingleInstance: true,
        FocusOnNewURL: true,
        DarwinForceFocus: false,
        HardwareAcceleration: true,
        ContentProtection: false,
        AddressBar: 2,
        Win32MenuState: 1,
        Homepage: "bb://home",
        Scheme: "bb",
    };
    /* eslint-enable */
}

/**
 * Get current app settings object.
 * If reading from file fails, default settings are returned.
 * @param configFile Full path of the settings file.
 * @returns The current app settings obtained from `configFile` or default settings.
 */
export function getSettings(configFile: string): ISettings {
    let settings: ISettings;
    try {
        settings = $Utils.requireJSONFile<ISettings>(configFile);
    } catch (error) {
        console.error("Could't read configuration file", configFile, error);
        return getDefaultSettings();
    }
    let userAgent: string;
    if (settings.UserAgent === "") {
        userAgent = app.userAgentFallback;
    } else {
        userAgent = settings.UserAgent;
    }
    /**
     * @see ISettings
     */
    /* eslint-disable jsdoc/require-jsdoc */
    settings = {
        Window: {
            Left: $Utils.normalize(settings.Window.Left, 10),
            Top: $Utils.normalize(settings.Window.Top, 10),
            LeftTopOfCurrentScreen: $Utils.normalize(settings.Window.LeftTopOfCurrentScreen, true),
            Width: $Utils.normalize(settings.Window.Width, 1280),
            Height: $Utils.normalize(settings.Window.Height, 900),
            NewRelativeToCurrent: $Utils.normalize(settings.Window.NewRelativeToCurrent, true),
        },
        ShortCuts: {
            Global: $Utils.normalize(settings.ShortCuts.Global, true),
            ToggleAddressBar: $Utils.normalize(settings.ShortCuts.ToggleAddressBar, ["mod+t"]),
            ToggleInternalDevTools: $Utils.normalize(settings.ShortCuts.ToggleInternalDevTools, ["mod+shift+d"]),
            ToggleDevTools: $Utils.normalize(settings.ShortCuts.ToggleDevTools, ["mod+d"]),
            FocusLocationBar: $Utils.normalize(settings.ShortCuts.FocusLocationBar, ["mod+l"]),
            NewWindow: $Utils.normalize(settings.ShortCuts.NewWindow, ["mod+n"]),
            // InternalReload: $Utils.normalize(settings.ShortCuts.InternalReload, ["mod+shift+r", "shift+f5"]),
            InternalReload: $Utils.normalize(settings.ShortCuts.InternalReload, [""]),
            Reload: $Utils.normalize(settings.ShortCuts.Reload, ["mod+r", "f5"]),
            GoBack: $Utils.normalize(settings.ShortCuts.GoBack, ["ctrl+alt+left"]),
            GoForward: $Utils.normalize(settings.ShortCuts.GoForward, ["ctrl+alt+right"]),
            ExitHTMLFullscreen: $Utils.normalize(settings.ShortCuts.ExitHTMLFullscreen, ["esc"]),
            ToggleWin32Menu: $Utils.normalize(settings.ShortCuts.ToggleWin32Menu, ["ctrl+h"]),
        },
        RequestHandlers: settings.RequestHandlers,
        LogRequests: $Utils.normalize(settings.LogRequests, false),
        CaptureConsole: $Utils.normalize(settings.CaptureConsole, true),
        UserAgent: userAgent,
        Permissions: $Utils.normalize(settings.Permissions, ["fullscreen"]),
        AllowPlugins: $Utils.normalize(settings.AllowPlugins, false),
        AllowPopups: $Utils.normalize(settings.AllowPopups, false),
        AllowNewWindows: $Utils.normalize(settings.AllowNewWindows, true),
        ClearTraces: $Utils.normalize(settings.ClearTraces, false),
        SingleInstance: $Utils.normalize(settings.SingleInstance, true),
        FocusOnNewURL: $Utils.normalize(settings.FocusOnNewURL, true),
        DarwinForceFocus: $Utils.normalize(settings.DarwinForceFocus, false),
        HardwareAcceleration: $Utils.normalize(settings.HardwareAcceleration, true),
        ContentProtection: $Utils.normalize(settings.ContentProtection, false),
        AddressBar: $Utils.normalize(settings.AddressBar, 2),
        Win32MenuState: $Utils.normalize(settings.Win32MenuState, 1),
        Homepage: $Utils.normalize(settings.Homepage, "bb://home").trim().replace(/\$APP_PATH\$/g, APP_INFO.APP_PATH_PKG),
        Scheme: $Utils.normalize(settings.Scheme, "bb"),
    };
    /* eslint-enable */
    if ([0, 1, 2].indexOf(settings.Win32MenuState) === -1) {
        settings.Win32MenuState = 1;
    }
    return settings;
}
