interface Cookie {
  key: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
}

interface Region {
  code: string;
  name: string;
  location: string;
}

interface LoginCredentials {
  appState?: Cookie[] | string | { cookies: Cookie[] };
  email?: string;
  password?: string;
}

interface LoginOptions {
  selfListen?: boolean;
  selfListenEvent?: boolean | string;
  listenEvents?: boolean;
  listenTyping?: boolean;
  updatePresence?: boolean;
  forceLogin?: boolean;
  autoMarkDelivery?: boolean;
  autoMarkRead?: boolean;
  autoReconnect?: boolean;
  online?: boolean;
  emitReady?: boolean;
  randomUserAgent?: boolean;
  userAgent?: string;
  proxy?: string;
  bypassRegion?: string;
  pageID?: string;
  OnAutoLoginProcess?: boolean;
}

interface APIContext {
  userID: string;
  jar: any;
  clientID: string;
  globalOptions: LoginOptions;
  loggedIn: boolean;
  access_token: string;
  clientMutationId: number;
  mqttClient: any;
  lastSeqId: number | undefined;
  syncToken: string | undefined;
  mqttEndpoint: string;
  region: string;
  firstListen: boolean;
  req_ID: number;
  callback_Task: Record<string, any>;
  fb_dtsg: string;
}

interface API {
  setOptions(options: LoginOptions): Promise<void>;
  getAppState(): Cookie[];
  getCookie(): string;
  [key: string]: any;
}

type LoginCallback = (error: Error | null, api: API | null) => void;

declare function login(
  loginData: LoginCredentials,
  options?: LoginOptions,
  callback?: LoginCallback
): Promise<API> | undefined;

export = login;