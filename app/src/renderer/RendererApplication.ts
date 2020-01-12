import { BrowserWindow, ipcRenderer, Point, remote, webContents } from "electron";
import * as $ShortCuts from "mousetrap";
import { IAppInfo, ISettings } from "../shared/Settings";
import { getURLItem, IURLItem, URLSource } from "../shared/URLItem";
import { BrowserHistory, BrowserHistoryItem } from "./BrowserHistory";
import { getURLHandlerByClassName, HandleURL, URLHandler } from "./URLHandler";

/**
 * Exported callback for handling a URL.
 * @see Funtion handleURLCallback in class `CRendererApplication`.
 */
export type HandleURLCallback = (handleURLResult: number, redirectURL?: string) => void;

/**
 * The class for the renderer application part. Creates a browser window and handles anything else.
 */
export class CRendererApplication {

    private settings: ISettings;
    private appInfo: IAppInfo;
    private addressBar: HTMLDivElement;
    private goBackButton: HTMLButtonElement;
    private goForwardButton: HTMLButtonElement;
    private urlField: HTMLInputElement;
    private spinner: HTMLDivElement;
    private window: BrowserWindow;
    private webContents: webContents;
    private webView: Electron.WebviewTag;
    private webViewScrollOffset: Point = { x: 0, y: 0 };
    private reloadIssued: boolean = false;
    // tslint:disable-next-line:variable-name
    private URLHandlers: URLHandler[] = [];
    private currentURLHandler: URLHandler;
    private history: BrowserHistory;
    private currentHistoryItem: BrowserHistoryItem;
    private currentURLItem: IURLItem;
    private blankPage: string = "_blank";
    private blankPageContent: string = encodeURI("data:text/html,<html><head></head><body></body></html>");
    private errorPage: string = "";

    /**
     * Creates the user interface, the web content part and handles all events.
     */
    constructor() {
        console.log("Creating new renderer");
        this.settings = ipcRenderer.sendSync("IPC", ["getSettings"]) as ISettings;
        this.appInfo = ipcRenderer.sendSync("IPC", ["getAppInfo"]) as IAppInfo;
        const fragment: DocumentFragment = new DocumentFragment();
        this.webView = this.getWebView();
        this.addressBar = this.getAddressBar();
        this.addressBar.appendChild(this.getNavigationButtons());
        this.addressBar.appendChild(this.getURLField());
        this.spinner = this.getSpinner();
        this.addressBar.appendChild(this.spinner);
        fragment.appendChild(this.addressBar);
        fragment.appendChild(this.webView);
        document.body.appendChild(fragment);
        this.window = remote.getCurrentWindow();
        this.webContents = this.window.webContents;
        ipcRenderer.on("IPC", this.onIPC.bind(this));
        this.bindShortCuts();
        this.loadURLHandlers();
        this.history = new BrowserHistory(this.blankPage);
        this.queryInitialURLItem();
    }

    /**
     * Load URL handlers configured in settings.
     */
    private loadURLHandlers(): void {
        for (const urlHandlerEntry of this.settings.URLHandlers) {
            if ((urlHandlerEntry.Source) && (urlHandlerEntry.Source !== "")) {
                try {
                    require(urlHandlerEntry.Source);
                    const classInstance: URLHandler = getURLHandlerByClassName(
                        urlHandlerEntry.ClassName,
                        urlHandlerEntry.Config,
                        this.settings,
                        this.webView,
                        this.window,
                        this.handleURLCallback.bind(this),
                    );
                    this.URLHandlers.push(classInstance);
                } catch (error) {
                    console.error(`Error loading URL handler from: ${urlHandlerEntry.Source}\n${error}`);
                }
            }
        }
    }

    /**
     * Get the initial URL to be loaded via an IPC call from the main process.
     */
    private queryInitialURLItem(): void {
        const urlItem: IURLItem = ipcRenderer.sendSync("IPC", ["queryURLItem"]) as IURLItem;
        if ((urlItem && urlItem.DoLoad)) {
            this.loadURL(urlItem);
        } else {
            if (this.settings.Homepage !== "") {
                this.loadURL(getURLItem(this.settings.Homepage, URLSource.APP));
            } else {
                this.addressBar.style.display = "";
                this.urlField.focus();
            }
        }
    }

    /**
     * Bind keyboard shortcut(s) to a function.
     * @param shortcut A single keyboard shortcut ar on array of shortcuts.
     * @param func The function to be executed if the given keyboard shortcut is used.
     */
    private bindShortCut(shortcut: string | string[], func: () => void): void {
        $ShortCuts.bind(shortcut, (_event: ExtendedKeyboardEvent, _combo: string): boolean => {
            func.call(this);
            return false;
        });
    }

    /**
     * Bind all keyboard shortcuts from the app settings to the respective function.
     */
    private bindShortCuts(): void {
        this.bindShortCut(this.settings.ShortCuts.ToggleAddressBar, () => {
            this.addressBar.style.display === "none" ?
                this.addressBar.style.display = "" : this.addressBar.style.display = "none";
        });
        this.bindShortCut(this.settings.ShortCuts.ToggleInternalDevTools, () => {
            const devToolsOpened = this.webContents.isDevToolsOpened();
            devToolsOpened ? this.webContents.closeDevTools() : this.webContents.openDevTools();
        });
        this.bindShortCut(this.settings.ShortCuts.ToggleDevTools, () => {
            this.webView.isDevToolsOpened() ? this.webView.closeDevTools() : this.webView.openDevTools();
        });
        this.bindShortCut(this.settings.ShortCuts.FocusLocationBar, () => {
            if (this.addressBar.style.display === "none") {
                this.addressBar.style.display = "";
            }
            this.urlField.focus();
            this.urlField.select();
        });
        this.bindShortCut(this.settings.ShortCuts.InternalReload, () => {
            this.webContents.reload();
        });
        this.bindShortCut(this.settings.ShortCuts.Reload, () => {
            // Get the current scroll offset from the web view.
            this.webView.send("IPCFromRenderer", "getScrollOffset");
            // Flag to ensure that DOMReady (see below) only does something
            // when the event was caused by a reload.
            this.reloadIssued = true;
            this.loadURL(this.currentURLItem, false);
        });
        this.bindShortCut(this.settings.ShortCuts.GoBack, () => {
            this.goBack();
        });
        this.bindShortCut(this.settings.ShortCuts.GoForward, () => {
            this.goForward();
        });
        this.bindShortCut(this.settings.ShortCuts.ExitHTMLFullscreen, () => {
            this.webView.executeJavaScript("document.webkitExitFullscreen();", true);
        });
        this.bindShortCut(this.settings.ShortCuts.ToggleWin32Menu, () => {
            ipcRenderer.send("IPC", ["toggleWin32Menu"]);
        });
    }

    /**
     * Let the first URL handler handle the given URL.
     * @param urlItem The URL to be handled.
     */
    private loadURL(urlItem: IURLItem, updateHistory: boolean = true): void {
        if (this.URLHandlers.length === 0) {
            console.warn("loadURL: No URL handlers are configured!");
        } else {
            // Initial empty item in the browser history (always available).
            if (urlItem.OriginalURL === this.blankPage) {
                this.webView.setAttribute("src", this.blankPageContent);
                this.window.setTitle(this.appInfo.Name);
                return;
            }
            // Add new target or update existing target.
            if (updateHistory) {
                this.currentHistoryItem = this.history.addOrUpdateItem(urlItem.URL);
            }
            this.currentURLHandler = this.URLHandlers[0];
            this.currentURLItem = urlItem;
            this.window.setTitle(this.currentURLItem.URL);
            this.spinner.style.visibility = "";
            this.currentURLHandler.handleURL(this.currentURLItem.URL,
                this.currentURLItem.Source, this.handleURLCallback);
        }
    }

    /**
     * Callback function which *must* be called by any URL handler after handling a URL.
     * In future versions probably this can be done using Promises.
     * @param currentURLHandler The URL handler which is calling this function.
     * @param handleURLResult The result of handling the URL by the the URL handler.
     * @param originalURL The original URL given to the URL handler.
     * @param redirectURL Optional, if set, then this URL will be used for the following URL handler.
     * @see Function loadURLHandlers.
     */
    private handleURLCallback: HandleURLCallback = (handleURLResult: number, redirectURL?: string): void => {
        window.setTimeout(this.doHandleURLCallback.bind(this), 10, handleURLResult, redirectURL);
    }

    /**
     * @see Function handleURLCallback.
     */
    private doHandleURLCallback: HandleURLCallback = (handleURLResult: number, redirectURL?: string): void => {
        const nextHandler: URLHandler = this.URLHandlers[this.URLHandlers.indexOf(this.currentURLHandler) + 1];
        const currentHandlerName: string = this.currentURLHandler.constructor.name;
        const logMsg: string = nextHandler ? "continuing with next handler" : "last handler in chain reached";
        try {
            switch (handleURLResult) {
                case HandleURL.ERROR:
                    console.error(`handleURL: ERROR: Calling URL handler ${currentHandlerName} with ${this.currentURLItem.URL} returned with an error, stopping.`);
                    return;

                case HandleURL.NONE:
                    console.log(`handleURL: NONE: URL handler ${currentHandlerName} didn't handle URL ${this.currentURLItem.URL}, ${logMsg}.`);
                    break;

                case HandleURL.CONTINUE:
                    console.log(`handleURL: CONTINUE: Successfully called URL handler ${currentHandlerName} with ${this.currentURLItem.URL}, ${logMsg}.`);
                    break;

                case HandleURL.STOP:
                    console.log(`handleURL: STOP: Successfully called URL handler ${currentHandlerName} with ${this.currentURLItem}.URL, stopping.`);
                    return;

                default:
                    console.error(`handleURL: ${handleURLResult}: Calling URL handler ${currentHandlerName} with ${this.currentURLItem.URL} returned an unknown result (${handleURLResult}), stopping.`);
                    return;
            }
            // Proceed with next handler (= implicitly NONE or CONTINUE)
            if (redirectURL) {
                console.log(`handleURL: ${currentHandlerName} redirected from ${this.currentURLItem.URL} to ${redirectURL}.`);
            }
            if (nextHandler) {
                if (redirectURL) {
                    this.currentURLItem = getURLItem(redirectURL, URLSource.PAGE);
                }
                this.currentURLHandler = nextHandler;
                this.currentURLHandler.handleURL(this.currentURLItem.URL,
                    this.currentURLItem.Source, this.handleURLCallback);
            } else {
                this.webContents.session.setPermissionRequestHandler(this.onPermissionRequest.bind(this));
            }
        } catch (error) {
            console.error(`Error calling URL handler: ${currentHandlerName} with ${this.currentURLItem.URL}\n${error}`);
        } finally {
            if ((handleURLResult !== HandleURL.NONE) && (handleURLResult !== HandleURL.CONTINUE)) {
                this.spinner.style.visibility = "hidden";
            }
        }
    }

    /**
     * Go back one step in the browser history.
     * @param _event A mouse event or null.
     */
    private goBack(_event?: MouseEvent): void {
        if (this.currentHistoryItem.Previous) {
            this.currentHistoryItem = this.currentHistoryItem.Previous;
            this.loadURL(getURLItem(this.currentHistoryItem.URL, URLSource.USER), false);
        }
    }

    /**
     * Go forward one step in the browser history.
     * @param _event A mouse event or null.
     */
    private goForward(_event?: MouseEvent): void {
        if (this.currentHistoryItem.Next) {
            this.currentHistoryItem = this.currentHistoryItem.Next;
            this.loadURL(getURLItem(this.currentHistoryItem.URL, URLSource.USER), false);
        }
    }

    /**
     * Called when the user clicks the Go button or presses Enter in the URL field.
     * @param event A mouse or keyboard event.
     */
    private loadURLItemListener(event: MouseEvent | KeyboardEvent): void {
        if ((event.type === "keypress") && ((event as KeyboardEvent).key !== "Enter")) {
            return;
        }
        this.loadURL(getURLItem(this.urlField.value, URLSource.USER));
    }

    /**
     * Handles all IPC calls from the main process.
     * @param event An Electron event.
     * @param args The arguments sent by the calling main process.
     */
    // tslint:disable-next-line:no-any
    private onIPC(_event: Electron.Event, ...args: any[]): void {
        if ((args.length === 0) || (!this.webView)) {
            return;
        }
        switch (args[0][0]) {
            case "loadURLItem":
                if (args[0].length === 2) {
                    this.loadURL((args[0][1] as IURLItem));
                }
                break;

            default:
                break;
        }
    }

    /**
     * Called when the page has finished loading.
     * Sets the focus to the webview tag to enable keyboard navigation in the page.
     * @param _event An Electron event.
     */
    private onDidFinishLoad(_event: Electron.Event): void {
        this.spinner.style.visibility = "hidden";
        if (!this.webView.getWebContents().isFocused()) {
            this.webView.focus();
        }
    }

    /**
     * Called when loading the page failed.
     * @param _event An Electron event.
     */
    private onDidFailLoad(_event: Electron.DidFailLoadEvent): void {
        if (_event.isMainFrame) {
            this.errorPage = encodeURI(
                "data:text/html,<html><head></head><body>"
                + "<p>Error loading page: <em>" + _event.validatedURL + "</em></p>"
                + "<p>Code: <code>" + _event.errorCode + "</code></p>"
                + "<p>Description: <code>" + _event.errorDescription + "</code></p>"
                + "</body></html>",
            );
            this.webView.setAttribute("src", this.errorPage);
        } else {
            console.error("Error loading page: " + _event.validatedURL + "\nCode: " + _event.errorCode + "\nDescription: " + _event.errorDescription);
        }
    }

    /**
     * Called when the DOM in the web view is ready. Tries to scroll to the last
     * offset but only if the event occurs during a page *reload*.
     * @param _event An Electron event.
     */
    private onDOMReady(_event: Electron.Event): void {
        if (this.reloadIssued) {
            this.reloadIssued = false;
            this.webView.send("IPCFromRenderer", "scrollToOffset", this.webViewScrollOffset);
        }
    }

    /**
     * Called when the title of the current page has been updated.
     * @param event An Electron PageTitleUpdatedEvent.
     */
    private onPageTitleUpdated(event: Electron.PageTitleUpdatedEvent): void {
        this.window.setTitle(event.title);
    }

    /**
     * Called when a web page logs something to the browser console.
     * Default handling for the event is prevented, enhanced with additional
     * infos and again written to the console. In future versions this should
     * be redirected/copied to a log file.
     * @param event An Electron ConsoleMessageEvent.
     */
    private onConsoleMessage(event: Electron.ConsoleMessageEvent): void {
        console.log("LOG from %s: [Level %d] %s (Line %d in %s)", this.webView.getURL(), event.level, event.message, event.line, event.sourceId);
        event.preventDefault();
        event.stopImmediatePropagation();
    }

    /**
     * Handles permission requests from web pages.
     * Permissions are granted based on app settings.
     * @param _webContents The calling Electron webContents.
     * @param permission The requested permission.
     * @param callback A callback called with the boolean result of the permission check.
     */
    private onPermissionRequest(_webContents: Electron.WebContents,
                                permission: string, callback: (permissionGranted: boolean) => void): void {
        const grant: boolean = (this.settings.Permissions.indexOf(permission) > -1);
        console.info(`Permission '${permission}' requested, ${grant ? "granting." : "denying."}`);
        callback(grant);
    }

    /**
     * Called when the navigaion to a URL has finished.
     * Used to update parts of the user interface.
     * @param _event An Electron DidNavigateEvent.
     */
    private onDidNavigate(event: Electron.DidNavigateEvent): void {
        if (event.url === this.blankPageContent) {
            this.urlField.value = "";
        } else if (event.url === this.errorPage) {
            this.urlField.value = this.currentURLItem.URL;
        } else {
            this.urlField.value = event.url;
        }
        this.goBackButton.disabled = (this.history.Size < 2
            || this.currentHistoryItem === null
            || this.currentHistoryItem.Previous === undefined);
        this.goForwardButton.disabled = (this.history.Size < 2
            || this.currentHistoryItem === null
            || this.currentHistoryItem.Next === undefined);
    }

    /**
     * Called when the navigaion to a URL has finished.
     * Used to update parts of the user interface.
     * @param _event An Electron DidNavigateEvent.
     */
    private onDidNavigateInPage(event: Electron.DidNavigateInPageEvent): void {
        this.currentHistoryItem = this.history.addOrUpdateItem(getURLItem(event.url, URLSource.PAGE).URL);
        this.urlField.value = event.url;
        this.goBackButton.disabled = (this.history.Size < 2
            || this.currentHistoryItem === null
            || this.currentHistoryItem.Previous === undefined);
        this.goForwardButton.disabled = (this.history.Size < 2
            || this.currentHistoryItem === null
            || this.currentHistoryItem.Next === undefined);
    }

    /**
     * Called when the user clicks on a link in a page which should be opened in another window/tab.
     * @param event An Electron NewWindowEvent.
     */
    private onNewWindow(event: Electron.NewWindowEvent): void {
        if (this.settings.AllowNewWindows) {
            // Excluding `save-to-disk` for now
            if (["default",
                "foreground-tab",
                "background-tab",
                "new-window",
                // "save-to-disk",
                "other"].indexOf(event.disposition) !== -1) {
                ipcRenderer.send("IPC", ["openWindow", event.url]);
            }
        }
    }

    /**
     * Handles IPC messages from the web view.
     * - It stores the current scroll offset from the web view. This is the result
     *   from sending "getScrollOffset" to the web view.
     * - It receives any keyboard event from the web view and dispatches it to this
     *   browser window which then can handlie it with Moustrap.
     * @param event An Electron IpcMessageEvent.
     */
    private onWebViewIPCMessage(event: Electron.IpcMessageEvent): void {
        if (event.channel === "IPCFromWebView") {
            switch (event.args[0]) {
                case "setScrollOffset":
                    this.webViewScrollOffset.x = event.args[1];
                    this.webViewScrollOffset.y = event.args[2];
                    break;

                case "keyboardEvent":
                    try {
                        document.dispatchEvent(new KeyboardEvent(
                            event.args[1].type as string,
                            event.args[1].dict as KeyboardEventInit),
                        );
                    } catch (error) {
                        console.error("Error handling KB event from webview: " + error);
                    }
                    break;
            }
        }
    }

    /**
     * Build the address bar.
     * @returns The DOM element for the address bar.
     */
    private getAddressBar(): HTMLDivElement {
        const addressBar: HTMLDivElement = document.createElement("div");
        addressBar.setAttribute("id", "addressBar");
        // Initially hidden; made visible depending on command line params
        addressBar.style.display = "none";
        return addressBar;
    }

    /**
     * Build the navigation buttons.
     * @returns The DOM element(s) for the navigation buttons.
     */
    private getNavigationButtons(): HTMLDivElement {
        const navigationButtonsContainer: HTMLDivElement = document.createElement("div");
        navigationButtonsContainer.setAttribute("id", "navigationButtonsContainer");

        this.goBackButton = document.createElement("button");
        this.goBackButton.setAttribute("id", "goBack");
        this.goBackButton.disabled = true;
        this.goBackButton.title = "Go back";
        this.goBackButton.disabled = true;
        this.goBackButton.appendChild(document.createTextNode("<"));
        this.goBackButton.addEventListener("click", this.goBack.bind(this), false);
        navigationButtonsContainer.appendChild(this.goBackButton);

        this.goForwardButton = document.createElement("button");
        this.goForwardButton.setAttribute("id", "goForward");
        this.goForwardButton.disabled = true;
        this.goForwardButton.title = "Go forward";
        this.goForwardButton.appendChild(document.createTextNode(">"));
        this.goForwardButton.addEventListener("click", this.goForward.bind(this), false);
        navigationButtonsContainer.appendChild(this.goForwardButton);

        const goButton: HTMLButtonElement = document.createElement("button");
        goButton.setAttribute("id", "goButton");
        goButton.title = "Open URL";
        goButton.appendChild(document.createTextNode("Go"));
        goButton.addEventListener("click", this.loadURLItemListener.bind(this), false);
        navigationButtonsContainer.appendChild(goButton);

        return navigationButtonsContainer;
    }

    /**
     * Build the navigation buttons.
     * @returns The DOM element(s) for the navigation buttons.
     */
    private getSpinner(): HTMLDivElement {
        const spinnerContainer: HTMLDivElement = document.createElement("div");
        spinnerContainer.setAttribute("id", "spinner");
        const spinnerImg: HTMLImageElement = document.createElement("img");
        spinnerContainer.style.visibility = "hidden";
        spinnerImg.setAttribute("id", "spinner-img");
        spinnerImg.setAttribute("src", "./style/spinner.png");
        spinnerContainer.appendChild(spinnerImg);
        return spinnerContainer;
    }

    /**
     * Build the URL text field.
     * @returns The DOM element(s) for the URL text field.
     */
    private getURLField(): HTMLDivElement {
        const urlFieldContainer: HTMLDivElement = document.createElement("div");
        urlFieldContainer.setAttribute("id", "urlFieldContainer");
        this.urlField = document.createElement("input");
        this.urlField.setAttribute("id", "urlField");
        this.urlField.setAttribute("type", "text");
        if (this.settings.ShortCuts.Global) {
            this.urlField.setAttribute("class", "mousetrap");
        }
        this.urlField.addEventListener("keypress", this.loadURLItemListener.bind(this), false);
        urlFieldContainer.appendChild(this.urlField);
        return urlFieldContainer;
    }

    /**
     * Build the webview tag.
     * @returns A completely configured Electron.WebviewTag.
     */
    private getWebView(): Electron.WebviewTag {
        const webView: Electron.WebviewTag = document.createElement("webview");
        webView.setAttribute("id", "webView");
        webView.setAttribute("autosize", "");
        if (this.settings.AllowPlugins) {
            webView.setAttribute("plugins", "");
        }
        if (this.settings.AllowPopups) {
            webView.setAttribute("allowpopups", "");
        }
        webView.setAttribute("useragent", this.settings.UserAgent);
        webView.setAttribute("preload", "./lib/preload.js");
        webView.addEventListener("did-navigate", this.onDidNavigate.bind(this), false);
        webView.addEventListener("did-navigate-in-page", this.onDidNavigateInPage.bind(this), false);
        webView.addEventListener("did-finish-load", this.onDidFinishLoad.bind(this), false);
        webView.addEventListener("did-fail-load", this.onDidFailLoad.bind(this), false);
        webView.addEventListener("dom-ready", this.onDOMReady.bind(this), false);
        webView.addEventListener("page-title-updated", this.onPageTitleUpdated.bind(this), false);
        webView.addEventListener("console-message", this.onConsoleMessage.bind(this), false);
        webView.addEventListener("new-window", this.onNewWindow.bind(this), false);
        webView.addEventListener("ipc-message", this.onWebViewIPCMessage.bind(this), false);
        return webView;
    }

}
