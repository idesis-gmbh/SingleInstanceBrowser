import { $FSE } from "./Modules";
import * as $Utils from "./Utils";

/**
 *
 */
export interface Settings {
    Window: {
        Left: number;
        Top: number;
        Width: number;
        Height: number;
    };
    ShortCuts: {
        Global: boolean,
        ToggleAddressBar: string,
        ToggleInternalDevTools: string,
        ToggleDevTools: string,
        FocusLocationBar: string,
        InternalReload: string,
        Reload: string,
        GoBack: string,
        GoForward: string,
        ExitHTMLFullscreen: string;
    };
    UserAgent: string;
    Permissions: string[];
    ClearTraces: boolean;
    SingleInstance: boolean;
    FocusOnNewURL: boolean;
}

/**
 *
 * @returns Settings
 */
export function getDefaultSettings(): Settings {
    return {
        Window: {
            Left: 50,
            Top: 50,
            Width: 1024,
            Height: 768,
        },
        ShortCuts: {
            Global: true,
            ToggleAddressBar: "ctrl+alt+a",
            ToggleInternalDevTools: "ctrl+alt+i",
            ToggleDevTools: "ctrl+alt+d",
            FocusLocationBar: "ctrl+alt+l",
            InternalReload: "ctrl+alt+shift+r",
            Reload: "ctrl+alt+r",
            GoBack: "ctrl+alt+left",
            GoForward: "ctrl+alt+right",
            ExitHTMLFullscreen: "esc",
        },
        UserAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,
        Permissions: ["fullscreen"],
        ClearTraces: true,
        SingleInstance: true,
        FocusOnNewURL: true,
    };
}

/**
 *
 * @param configFile
 * @returns Settings
 */
export function getSettings(configFile: string): Settings {
    let settings: Settings;
    try {
        settings = $FSE.readJsonSync(configFile);
    } catch (error) {
        console.error("Could't read configuration file", configFile, error);
        return getDefaultSettings();
    }
    let userAgent: string;
    // tslint:disable-next-line:prefer-conditional-expression
    if (typeof settings.UserAgent !== "string") {
        userAgent = (typeof navigator === "undefined" ? "" : navigator.userAgent);
    } else {
        userAgent = settings.UserAgent;
    }
    settings = {
        Window: {
            Left: $Utils.normalize(settings.Window.Left, 50),
            Top: $Utils.normalize(settings.Window.Top, 50),
            Width: $Utils.normalize(settings.Window.Width, 1024),
            Height: $Utils.normalize(settings.Window.Height, 768),
        },
        ShortCuts: {
            Global: $Utils.normalize(settings.ShortCuts.Global, true),
            ToggleAddressBar: $Utils.normalize(settings.ShortCuts.ToggleAddressBar, "ctrl+alt+a"),
            ToggleInternalDevTools: $Utils.normalize(settings.ShortCuts.ToggleInternalDevTools, "ctrl+alt+i"),
            ToggleDevTools: $Utils.normalize(settings.ShortCuts.ToggleDevTools, "ctrl+alt+dx"),
            FocusLocationBar: $Utils.normalize(settings.ShortCuts.FocusLocationBar, "ctrl+alt+l"),
            InternalReload: $Utils.normalize(settings.ShortCuts.InternalReload, "ctrl+alt+shift+r"),
            Reload: $Utils.normalize(settings.ShortCuts.Reload, "ctrl+alt+r"),
            GoBack: $Utils.normalize(settings.ShortCuts.GoBack, "ctrl+alt+left"),
            GoForward: $Utils.normalize(settings.ShortCuts.GoForward, "ctrl+alt+right"),
            ExitHTMLFullscreen: $Utils.normalize(settings.ShortCuts.ExitHTMLFullscreen, "esc"),
        },
        UserAgent: userAgent,
        Permissions: $Utils.normalize(settings.Permissions, ["fullscreen"]),
        ClearTraces: $Utils.normalize(settings.ClearTraces, true),
        SingleInstance: $Utils.normalize(settings.SingleInstance, true),
        FocusOnNewURL: $Utils.normalize(settings.FocusOnNewURL, true),
    };
    return settings;
}
