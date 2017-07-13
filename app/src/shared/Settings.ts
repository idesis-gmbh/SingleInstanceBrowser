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
        ToggleAddressBar: string[],
        ToggleInternalDevTools: string[],
        ToggleDevTools: string[],
        FocusLocationBar: string[],
        InternalReload: string[],
        Reload: string[],
        GoBack: string[],
        GoForward: string[],
        ExitHTMLFullscreen: string[];
    };
    UserAgent: string;
    Permissions: string[];
    ClearTraces: boolean;
    SingleInstance: boolean;
    FocusOnNewURL: boolean;
    HardwareAcceleration: boolean;
    ContentProtection: boolean;
    Homepage: string;
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
            ToggleAddressBar: ["mod+t"],
            ToggleInternalDevTools: ["mod+shift+d"],
            ToggleDevTools: ["mod+d"],
            FocusLocationBar: ["mod+l"],
            InternalReload: ["mod+shift+r", "shift+f5"],
            Reload: ["mod+r", "f5"],
            GoBack: ["ctrl+alt+left"],
            GoForward: ["ctrl+alt+right"],
            ExitHTMLFullscreen: ["esc"],
        },
        UserAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,
        Permissions: ["fullscreen"],
        ClearTraces: false,
        SingleInstance: true,
        FocusOnNewURL: true,
        HardwareAcceleration: true,
        ContentProtection: false,
        Homepage: "",
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
            ToggleAddressBar: $Utils.normalize(settings.ShortCuts.ToggleAddressBar, ["mod+t"]),
            ToggleInternalDevTools: $Utils.normalize(settings.ShortCuts.ToggleInternalDevTools, ["mod+shift+d"]),
            ToggleDevTools: $Utils.normalize(settings.ShortCuts.ToggleDevTools, ["mod+d"]),
            FocusLocationBar: $Utils.normalize(settings.ShortCuts.FocusLocationBar, ["mod+l"]),
            InternalReload: $Utils.normalize(settings.ShortCuts.InternalReload, ["mod+shift+r", "shift+f5"]),
            Reload: $Utils.normalize(settings.ShortCuts.Reload, ["mod+r", "f5"]),
            GoBack: $Utils.normalize(settings.ShortCuts.GoBack, ["ctrl+alt+left"]),
            GoForward: $Utils.normalize(settings.ShortCuts.GoForward, ["ctrl+alt+right"]),
            ExitHTMLFullscreen: $Utils.normalize(settings.ShortCuts.ExitHTMLFullscreen, ["esc"]),
        },
        UserAgent: userAgent,
        Permissions: $Utils.normalize(settings.Permissions, ["fullscreen"]),
        ClearTraces: $Utils.normalize(settings.ClearTraces, false),
        SingleInstance: $Utils.normalize(settings.SingleInstance, true),
        FocusOnNewURL: $Utils.normalize(settings.FocusOnNewURL, true),
        HardwareAcceleration: $Utils.normalize(settings.HardwareAcceleration, true),
        ContentProtection: $Utils.normalize(settings.ContentProtection, false),
        Homepage: $Utils.normalize(settings.Homepage, "").trim(),
    };
    return settings;
}
