"use strict";

/** @module login */

/** 
 * @typedef {{ 
 *   selfListen?: boolean, 
 *   selfListenEvent?: boolean | string, 
 *   listenEvents?: boolean, 
 *   listenTyping?: boolean, 
 *   updatePresence?: boolean, 
 *   forceLogin?: boolean, 
 *   autoMarkDelivery?: boolean, 
 *   autoMarkRead?: boolean, 
 *   autoReconnect?: boolean, 
 *   online?: boolean, 
 *   emitReady?: boolean, 
 *   randomUserAgent?: boolean, 
 *   userAgent?: string, 
 *   proxy?: string, 
 *   bypassRegion?: string, 
 *   pageID?: string, 
 *   OnAutoLoginProcess?: boolean,
 *   refresh_dtsg?: boolean 
 * }} LoginOptions 
 */
/** @typedef {{ key: string, value: string, domain?: string, path?: string, expires?: number }} Cookie */
/** @typedef {{ code: string, name: string, location: string }} Region */
/** @typedef {{ av: string, fb_api_caller_class: string, fb_api_req_friendly_name: string, variables: string, server_timestamps: boolean, doc_id: string, fb_dtsg: string, jazoest: string, lsd: string }} FormBypass */
/** @typedef {{ userID: string, jar: any, clientID: string, globalOptions: LoginOptions, loggedIn: boolean, access_token: string, clientMutationId: number, mqttClient: any, lastSeqId: number | undefined, syncToken: string | undefined, mqttEndpoint: string, region: string, firstListen: boolean, req_ID: number, callback_Task: Record<string, any>, fb_dtsg: string }} APIContext */
/** @typedef {{ setOptions: (options: LoginOptions) => Promise<void>, getAppState: () => Cookie[], getCookie: () => string, [key: string]: any }} API */
/** @typedef {(error: Error | null, api: API | null) => void} LoginCallback */
/** @typedef {{ appState?: Cookie[] | string | { cookies: Cookie[] }, email?: string, password?: string }} LoginCredentials */

const utils = require("./utils");
const log = require("npmlog");
const fs = require("fs");
const path = require("path");
const cron = require("node-cron");
const cheerio = require("cheerio");
const readline = require("readline/promises");

const config = {
  logRecordSize: 100,
  defaultRegions: [
    { code: "PRN", name: "Pacific Northwest Region", location: "Pacific Northwest" },
    { code: "VLL", name: "Valley Region", location: "Valley" },
    { code: "ASH", name: "Ashburn Region", location: "Ashburn" },
    { code: "DFW", name: "Dallas/Fort Worth Region", location: "Dallas/Fort Worth" },
    { code: "LLA", name: "Los Angeles Region", location: "Los Angeles" },
    { code: "FRA", name: "Frankfurt", location: "Frankfurt" },
    { code: "SIN", name: "Singapore", location: "Singapore" },
    { code: "NRT", name: "Tokyo", location: "Japan" },
    { code: "HKG", name: "Hong Kong", location: "Hong Kong" },
    { code: "SYD", name: "Sydney", location: "Sydney" },
    { code: "PNB", name: "Pacific Northwest - Beta", location: "Pacific Northwest" },
  ],
};

const state = {
  checkVerified: null,
  globalOptions: {},
  behaviorDetected: false,
};

log.maxRecordSize = config.logRecordSize;

/**
 * Validates a region code against supported regions.
 * @param {string} regionCode - The region code to validate.
 * @returns {Region | null} The region object if valid, null otherwise.
 */
function validateRegion(regionCode) {
  if (!regionCode || typeof regionCode !== "string") return null;
  const code = regionCode.trim().toUpperCase();
  const region = config.defaultRegions.find((r) => r.code === code);
  if (!region) {
    const supportedRegions = config.defaultRegions.map((r) => r.code).join(", ");
    log.warn("validateRegion", `Invalid region code: ${code}. Supported regions: ${supportedRegions}`);
    return null;
  }
  return region;
}

/**
 * Selects a random region from default regions.
 * @returns {Region} A random region object.
 */
function getRandomRegion() {
  const randomIndex = Math.floor(Math.random() * config.defaultRegions.length);
  return config.defaultRegions[randomIndex];
}

/**
 * Normalizes appState input into a standard array format.
 * @param {Cookie[] | string | { cookies: Cookie[] }} appState - The appState input.
 * @returns {Cookie[]} Normalized array of cookie objects.
 * @throws {Error} If the input format is invalid.
 */
function normalizeAppState(appState) {
  if (!appState) return [];

  if (typeof appState === "string") {
    try {
      return appState
        .split(";")
        .filter((c) => c.trim())
        .map((c) => {
          const [key, value] = c.split("=");
          if (!key || !value) throw new Error("Invalid cookie string format");
          return {
            key: key.trim(),
            value: value.trim(),
            domain: ".facebook.com",
            path: "/",
            expires: new Date().getTime() + 1000 * 60 * 60 * 24 * 365,
          };
        });
    } catch (error) {
      throw new Error(`Failed to parse appState string: ${error.message}`);
    }
  }

  if (Array.isArray(appState)) {
    return appState.map((c) => {
      const key = c.key || c.name;
      if (!key || !c.value) throw new Error("Invalid cookie object in array");
      return {
        key: key.trim(),
        value: c.value.trim(),
        domain: c.domain || ".facebook.com",
        path: c.path || "/",
        expires: c.expires || new Date().getTime() + 1000 * 60 * 60 * 24 * 365,
      };
    });
  }

  if (typeof appState === "object" && appState.cookies) {
    return normalizeAppState(appState.cookies);
  }

  throw new Error("Unsupported appState format");
}

/**
 * Sets global configuration options for the application.
 * @param {LoginOptions} [options={}] - Configuration options to apply.
 * @returns {Promise<void>}
 */
async function setOptions(options = {}) {
  for (const [key, value] of Object.entries(options)) {
    switch (key) {
      case "online":
        state.globalOptions.online = Boolean(value);
        break;
      case "selfListen":
        state.globalOptions.selfListen = Boolean(value);
        break;
      case "selfListenEvent":
        state.globalOptions.selfListenEvent = value;
        break;
      case "listenEvents":
        state.globalOptions.listenEvents = Boolean(value);
        break;
      case "pageID":
        state.globalOptions.pageID = String(value);
        break;
      case "updatePresence":
        state.globalOptions.updatePresence = Boolean(value);
        break;
      case "forceLogin":
        state.globalOptions.forceLogin = Boolean(value);
        break;
      case "userAgent":
        state.globalOptions.userAgent = value;
        break;
      case "autoMarkDelivery":
        state.globalOptions.autoMarkDelivery = Boolean(value);
        break;
      case "autoMarkRead":
        state.globalOptions.autoMarkRead = Boolean(value);
        break;
      case "listenTyping":
        state.globalOptions.listenTyping = Boolean(value);
        break;
      case "proxy":
        if (typeof value !== "string") {
          delete state.globalOptions.proxy;
          utils.setProxy();
        } else {
          state.globalOptions.proxy = value;
          utils.setProxy(value);
        }
        break;
      case "autoReconnect":
        state.globalOptions.autoReconnect = Boolean(value);
        break;
      case "emitReady":
        state.globalOptions.emitReady = Boolean(value);
        break;
      case "randomUserAgent":
        state.globalOptions.randomUserAgent = Boolean(value);
        if (value) {
          state.globalOptions.userAgent = utils.generateUserAgent();
          log.warn("setOptions", "Random user agent enabled. Use at your own risk.");
          log.warn("randomUserAgent", `UA selected: ${state.globalOptions.userAgent}`);
        }
        break;
      case "bypassRegion":
        const region = validateRegion(value);
        if (region) {
          state.globalOptions.bypassRegion = region.code;
          log.info("setOptions", `Bypass region set to: ${region.code} (${region.name})`);
        } else {
          const fallbackRegion = getRandomRegion();
          state.globalOptions.bypassRegion = fallbackRegion.code;
          log.info("setOptions", `Invalid or no bypassRegion provided; using random region: ${fallbackRegion.code} (${fallbackRegion.name})`);
        }
        break;
      case "refresh_dtsg":
        state.globalOptions.refresh_dtsg = Boolean(value);
        log.info("setOptions", `DTSG refresh set to: ${state.globalOptions.refresh_dtsg}`);
        break;
    }
  }
}

/**
 * Updates Facebook DTSG token and saves it to a file.
 * @param {{ body: string, headers: Record<string, string> }} res - HTTP response object.
 * @param {Cookie[]} appstate - Normalized application state.
 * @param {any} jar - Cookie jar object.
 * @param {string} [ID] - User ID.
 * @returns {{ body: string, headers: Record<string, string> } | null} Updated response or null if an error occurs.
 */
function updateDTSG(res, appstate, jar, ID) {
  try {
    let UID = ID;

    if (!UID) {
      const appstateCUser = appstate.find((i) => i.key === "i_user" || i.key === "c_user");
      if (!appstateCUser) {
        const cookies = jar.getCookies("https://www.facebook.com");
        const userCookie = cookies.find((cookie) => cookie.key === "c_user" || cookie.key === "i_user");
        UID = userCookie?.value;
      } else {
        UID = appstateCUser.value;
      }
    }

    if (!res?.body) {
      throw new Error("Invalid response: Response body is missing.");
    }

    const fb_dtsg = utils.getFrom(res.body, '["DTSGInitData",[],{"token":"', '","');
    const jazoest = utils.getFrom(res.body, "jazoest=", '",');

    if (fb_dtsg && jazoest) {
      const filePath = path.join(__dirname, "fb_dtsg_data.json");
      const existingData = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf8")) : {};

      existingData[UID] = { fb_dtsg, jazoest };
      fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2), "utf8");
      log.info("updateDTSG", "fb_dtsg_data.json updated successfully.");
    }

    return res;
  } catch (error) {
    log.error("updateDTSG", `Error updating DTSG for user ${UID || "unknown"}: ${error.message}`);
    return null;
  }
}

/**
 * Bypasses automated behavior detection by Facebook.
 * @param {{ body: string, headers: Record<string, string>, request: { uri: { href: string } } }} resp - HTTP response object.
 * @param {any} jar - Cookie jar object.
 * @param {Cookie[]} appstate - Normalized application state.
 * @param {string} [ID] - User ID.
 * @returns {Promise<{ body: string, headers: Record<string, string>, request: { uri: { href: string } } } | undefined>} Response object or undefined on error.
 */
async function bypassAutoBehavior(resp, jar, appstate, ID) {
  try {
    let UID = ID;

    if (!UID) {
      const appstateCUser = appstate.find((i) => i.key === "i_user" || i.key === "c_user");
      if (!appstateCUser) {
        const cookies = jar.getCookies("https://www.facebook.com");
        const userCookie = cookies.find((cookie) => cookie.key === "c_user" || cookie.key === "i_user");
        UID = userCookie?.value;
      } else {
        UID = appstateCUser.value;
      }
    }

    if (resp?.request?.uri?.href?.includes("https://www.facebook.com/checkpoint/")) {
      if (resp.request.uri.href.includes("601051028565049")) {
        const fb_dtsg = utils.getFrom(resp.body, '["DTSGInitData",[],{"token":"', '","');
        const jazoest = utils.getFrom(resp.body, "jazoest=", '",');
        const lsd = utils.getFrom(resp.body, '["LSD",[],{"token":"', '"}');

        const formBypass = {
          av: UID,
          fb_api_caller_class: "RelayModern",
          fb_api_req_friendly_name: "FBScrapingWarningMutation",
          variables: JSON.stringify({}),
          server_timestamps: true,
          doc_id: "6339492849481770",
          fb_dtsg,
          jazoest,
          lsd,
        };

        log.warn("bypassAutoBehavior", `Automated behavior detected for user ${UID}.`);
        state.behaviorDetected = true;
        return utils
          .post("https://www.facebook.com/api/graphql/", jar, formBypass, state.globalOptions)
          .then(utils.saveCookies(jar));
      }
    }
    return resp;
  } catch (error) {
    log.error("bypassAutoBehavior", error.message);
  }
}

/**
 * Checks if the account is suspended.
 * @param {{ body: string, headers: Record<string, string>, request: { uri: { href: string } } }} resp - HTTP response object.
 * @param {Cookie[]} appstate - Normalized application state.
 * @param {any} jar - Cookie jar object.
 * @param {string} [ID] - User ID.
 * @returns {Promise<{ suspended: boolean, suspendReasons: { durationInfo?: string, longReason?: string, shortReason?: string } } | undefined>} Suspension details or undefined if not suspended.
 */
async function checkIfSuspended(resp, appstate, jar, ID) {
  try {
    let UID = ID;

    if (!UID) {
      const appstateCUser = appstate.find((i) => i.key === "i_user" || i.key === "c_user");
      if (!appstateCUser) {
        const cookies = jar.getCookies("https://www.facebook.com");
        const userCookie = cookies.find((cookie) => cookie.key === "c_user" || cookie.key === "i_user");
        UID = userCookie?.value;
      } else {
        UID = appstateCUser.value;
      }
    }

    if (resp?.request?.uri?.href?.includes("https://www.facebook.com/checkpoint/")) {
      if (resp.request.uri.href.includes("1501092823525282")) {
        const suspendReasons = {};
        const daystoDisable = resp.body?.match(/"log_out_uri":"(.*?)","title":"(.*?)"/);
        if (daystoDisable?.[2]) {
          suspendReasons.durationInfo = daystoDisable[2];
          log.error("checkIfSuspended", `Suspension time remaining: ${suspendReasons.durationInfo}`);
        }

        const reasonDescription = resp.body?.match(/"reason_section_body":"(.*?)"/);
        if (reasonDescription?.[1]) {
          suspendReasons.longReason = reasonDescription[1];
          const reasonReplace = suspendReasons.longReason
            ?.toLowerCase()
            ?.replace("your account, or activity on it, doesn't follow our community standards on ", "");
          suspendReasons.shortReason = reasonReplace?.charAt(0).toUpperCase() + reasonReplace?.slice(1);
          log.error(`Alert on ${UID}:`, "Account has been suspended!");
          log.error(`Why suspended:`, suspendReasons.longReason);
          log.error(`Reason on suspension:`, suspendReasons.shortReason);
        }

        return { suspended: true, suspendReasons };
      }
    }
  } catch (error) {
    log.error("checkIfSuspended", error.message);
  }
}

/**
 * Checks if the account is locked.
 * @param {{ body: string, headers: Record<string, string>, request: { uri: { href: string } } }} resp - HTTP response object.
 * @param {Cookie[]} appstate - Normalized application state.
 * @param {any} jar - Cookie jar object.
 * @param {string} [ID] - User ID.
 * @returns {Promise<{ locked: boolean, lockedReasons: { reason?: string } } | undefined>} Lock details or undefined if not locked.
 */
async function checkIfLocked(resp, appstate, jar, ID) {
  try {
    let UID = ID;

    if (!UID) {
      const appstateCUser = appstate.find((i) => i.key === "i_user" || i.key === "c_user");
      if (!appstateCUser) {
        const cookies = jar.getCookies("https://www.facebook.com");
        const userCookie = cookies.find((cookie) => cookie.key === "c_user" || cookie.key === "i_user");
        UID = userCookie?.value;
      } else {
        UID = appstateCUser.value;
      }
    }

    if (resp?.request?.uri?.href?.includes("https://www.facebook.com/checkpoint/")) {
      if (resp.request.uri.href.includes("828281030927956")) {
        const lockedReasons = {};
        const lockDesc = resp.body.match(/"is_unvetted_flow":true,"title":"(.*?)"/);
        if (lockDesc?.[1]) {
          lockedReasons.reason = lockDesc[1];
          log.error(`Alert on ${UID}:`, lockedReasons.reason);
        }
        return { locked: true, lockedReasons };
      }
    }
  } catch (error) {
    log.error("checkIfLocked", error.message);
  }
}

/**
 * Builds the API object with context and default functions.
 * @param {string} html - HTML response from Facebook.
 * @param {any} jar - Cookie jar object.
 * @returns {{ ctx: APIContext, api: API }} API context and functions.
 */
function buildAPI(html, jar) {
  let fb_dtsg = html.match(/DTSGInitialData.*?token":"(.*?)"/)?.[1];

  let userID;
  const cookies = jar.getCookies("https://www.facebook.com");
  const primary_profile = cookies.find((val) => val.key === "c_user");
  const secondary_profile = cookies.find((val) => val.key === "i_user");

  if (!primary_profile && !secondary_profile) {
    throw new Error("Error retrieving userID. Try logging in with a browser to verify.");
  }

  if (html.includes("/checkpoint/block/?next")) {
    log.warn("buildAPI", "Checkpoint detected. Please log in with a browser to verify.");
    throw new Error("Checkpoint detected.");
  }

  userID = secondary_profile?.value?.toString() || primary_profile?.value?.toString();
  if (secondary_profile) {
    log.warn("buildAPI", "Using secondary profile (i_user) instead of primary (c_user).");
  }

  log.info("buildAPI", `Logged in as ${userID}`);

  try {
    clearInterval(state.checkVerified);
  } catch (_) {}

  const clientID = (Math.random() * 2147483648 | 0).toString(16);

  let mqttEndpoint, region, irisSeqID;

  // Region selection logic: Use bypassRegion if provided and valid, otherwise randomize
  const regionObj = state.globalOptions.bypassRegion ? validateRegion(state.globalOptions.bypassRegion) : null;
  if (regionObj) {
    region = regionObj.code;
    log.info("buildAPI", `Using provided bypassRegion: ${region} (${regionObj.name})`);
  } else {
    const fallbackRegion = getRandomRegion();
    region = fallbackRegion.code;
    log.info("buildAPI", `No valid bypassRegion provided; using random region: ${region} (${fallbackRegion.name})`);
  }

  mqttEndpoint = `wss://edge-chat.facebook.com/chat?region=${region}&sid=${userID}`;
  log.info("buildAPI", `Server region set to ${region}`);

  const ctx = {
    userID,
    jar,
    clientID,
    globalOptions: state.globalOptions,
    loggedIn: true,
    access_token: "NONE",
    clientMutationId: 0,
    mqttClient: undefined,
    lastSeqId: irisSeqID,
    syncToken: undefined,
    mqttEndpoint,
    region,
    firstListen: true,
    req_ID: 0,
    callback_Task: {},
    fb_dtsg,
  };

  const api = {
    /**
     * Sets configuration options.
     * @param {LoginOptions} options - Options to set.
     */
    setOptions: setOptions,

    /**
     * Retrieves the application state.
     * @returns {Cookie[]} Filtered application state.
     */
    getAppState() {
      let appState = utils.getAppState(jar);
      appState = normalizeAppState(appState);
      const uniqueAppState = appState.filter(
        (item, index, self) => self.findIndex((t) => t.key === item.key) === index
      );

      const fallbackState = uniqueAppState.length > 0 ? uniqueAppState : appState;
      const primaryProfile = fallbackState.find((val) => val.key === "c_user");
      const secondaryProfile = fallbackState.find((val) => val.key === "i_user");

      return fallbackState.filter((val) => {
        const key = val.key;
        return secondaryProfile ? key !== "c_user" : key !== "i_user";
      });
    },

    /**
     * Retrieves cookies as a semicolon-separated string.
     * @returns {string} Cookie string.
     */
    getCookie() {
      let appState = utils.getAppState(jar);
      appState = normalizeAppState(appState);
      if (!appState.length) return "";

      const importantKeys = new Set([
        "datr",
        "sb",
        "ps_l",
        "ps_n",
        "m_pixel_ratio",
        "c_user",
        "fr",
        "xs",
        "i_user",
        "locale",
        "fbl_st",
        "vpd",
        "wl_cbv",
      ]);

      return appState
        .map((val) => `${val.key}=${val.value}`)
        .filter((cookie) => importantKeys.has(cookie.split("=")[0]))
        .join("; ");
    },
  };

  const defaultFuncs = utils.makeDefaults(html, userID, ctx);

  fs.readdirSync(path.join(__dirname, "src"))
    .filter((file) => file.endsWith(".js"))
    .forEach((file) => {
      const functionName = file.replace(".js", "");
      api[functionName] = require(`./src/${file}`)(defaultFuncs, api, ctx);
    });

  /**
   * Refreshes the Facebook DTSG token if refresh_dtsg is enabled.
   */
  function refreshAction() {
    try {
      const filePath = path.join(__dirname, "fb_dtsg_data.json");
      const fbDtsgData = JSON.parse(fs.readFileSync(filePath, "utf8"));

      if (fbDtsgData?.[userID]) {
        api
          .refreshFb_dtsg(fbDtsgData[userID])
          .then(() => log.info("refreshAction", `Fb_dtsg refreshed successfully for user ${userID}`))
          .catch((err) => log.error("refreshAction", `Error during Fb_dtsg refresh for user ${userID}: ${err.message}`));
      } else {
        log.error("refreshAction", `No fb_dtsg data found for user ${userID}`);
      }
    } catch (err) {
      log.error("refreshAction", `Error reading fb_dtsg_data.json: ${err.message}`);
    }
  }

  // Schedule DTSG refresh only if refresh_dtsg is true
  if (state.globalOptions.refresh_dtsg !== false) {
    cron.schedule("0 0 * * *", refreshAction, { timezone: "Asia/Manila" });
    log.info("buildAPI", "DTSG refresh scheduled (daily at midnight Asia/Manila)");
  } else {
    log.info("buildAPI", "DTSG refresh disabled");
  }

  return { ctx, api };
}

/**
 * Initiates the login process to Facebook.
 * @param {any} jar - Cookie jar object.
 * @param {{ email?: string, password?: string }} credentials - Login credentials.
 * @returns {(res: { body: string, headers: Record<string, string> }) => Promise<{ body: string, headers: Record<string, string> }>} Function to handle login response.
 */
function makeLogin(jar, { email, password } = {}) {
  return async (res) => {
    const html = res.body;
    const $ = cheerio.load(html);
    const arr = $("#login_form input")
      .map((i, v) => ({ val: $(v).val(), name: $(v).attr("name") }))
      .get()
      .filter((v) => v.val && v.val.length);

    const form = utils.arrToForm(arr);
    form.lsd = utils.getFrom(html, '["LSD",[],{"token":"', '"]');
    form.lgndim = Buffer.from('{"w":1440,"h":900,"aw":1440,"ah":834,"c":24}').toString("base64");
    if (email) form.email = email;
    if (password) form.pass = password;
    form.default_persistent = email ? "1" : "0";
    form.locale = "en_US";
    form.timezone = "0";
    form.lgnjs = ~~(Date.now() / 1000);

    html
      .split('"_js_')
      .slice(1)
      .forEach((val) => {
        jar.setCookie(
          utils.formatCookie(JSON.parse(`["${utils.getFrom(val, "", "]")}]`), "facebook"),
          "https://www.facebook.com"
        );
      });

    return utils
      .post(
        "https://www.facebook.com/login/device-based/regular/login/?login_attempt=1",
        jar,
        form,
        state.globalOptions
      )
      .then(utils.saveCookies(jar))
      .then(async (resData) => {
        const headers = resData.headers;
        if (!headers.location) throw new Error("Invalid credentials.");

        if (headers.location.includes("https://www.facebook.com/checkpoint/")) {
          return handle2FA(headers, jar, form);
        }
        return utils
          .get("https://www.facebook.com/", jar, null, state.globalOptions)
          .then(utils.saveCookies(jar));
      });
  };
}

/**
 * Handles two-factor authentication.
 * @param {Record<string, string>} headers - HTTP response headers.
 * @param {any} jar - Cookie jar object.
 * @param {Record<string, string>} form - Login form data.
 * @returns {Promise<{ body: string, headers: Record<string, string> }>} Response after handling 2FA.
 */
async function handle2FA(headers, jar, form) {
  const nextURL = "https://www.facebook.com/checkpoint/?next=https%3A%2F%2Fwww.facebook.com%2Fhome.php";

  const res = await utils
    .get(headers.location, jar, null, state.globalOptions)
    .then(utils.saveCookies(jar));
  const html = res.body;
  const $ = cheerio.load(html);
  const arr = $("form input")
    .map((i, v) => ({ val: $(v).val(), name: $(v).attr("name") }))
    .get()
    .filter((v) => v.val && v.val.length);
  Object.assign(form, utils.arrToForm(arr));

  if (html.includes("checkpoint/?next")) {
    const code = await promptFor2FACode();
    return submit2FACode(code, form, jar, nextURL);
  }
  return res;
}

/**
 * Prompts user for 2FA code asynchronously.
 * @returns {Promise<string>} 2FA code entered by the user.
 */
async function promptFor2FACode() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const code = await rl.question("Enter 2FA code: ");
    return code;
  } catch (error) {
    log.error("promptFor2FACode", `Error reading 2FA code: ${error.message}`);
    throw error;
  } finally {
    rl.close();
  }
}

/**
 * Submits 2FA code to complete authentication.
 * @param {string} code - 2FA code.
 * @param {Record<string, string>} form - Form data.
 * @param {any} jar - Cookie jar object.
 * @param {string} nextURL - Next URL to post to.
 * @returns {Promise<{ body: string, headers: Record<string, string> }>} Response after 2FA submission.
 */
async function submit2FACode(code, form, jar, nextURL) {
  form.approvals_code = code;
  form["submit[Continue]"] = "Continue";

  const res = await utils
    .post(nextURL, jar, form, state.globalOptions)
    .then(utils.saveCookies(jar));

  delete form.no_fido;
  delete form.approvals_code;
  form.name_action_selected = "save_device";

  const secondRes = await utils
    .post(nextURL, jar, form, state.globalOptions)
    .then(utils.saveCookies(jar));

  if (!secondRes.headers?.location && secondRes.headers?.["set-cookie"]?.[0]?.includes("checkpoint")) {
    throw new Error("Failed to verify 2FA code.");
  }

  return utils
    .get("https://www.facebook.com/", jar, null, state.globalOptions)
    .then(utils.saveCookies(jar));
}

/**
 * Validates and normalizes login credentials.
 * @param {LoginCredentials} loginData - Login credentials.
 * @returns {{ appState?: Cookie[], email?: string, password?: string }} Normalized credentials.
 * @throws {Error} If credentials are invalid.
 */
function normalizeLoginCredentials(loginData) {
  if (!loginData || typeof loginData !== "object") {
    throw new Error("Invalid loginData: must be an object");
  }

  const { appState, email, password } = loginData;

  if (appState) {
    return { appState: normalizeAppState(appState) };
  }

  if (email && password) {
    if (typeof email !== "string" || typeof password !== "string") {
      throw new Error("Invalid email or password: must be strings");
    }
    return { email: email.trim(), password };
  }

  throw new Error("Invalid credentials: provide appState, email/password");
}

/**
 * Helper function for login process.
 * @param {{ appState?: Cookie[], email?: string, password?: string }} credentials - Normalized credentials.
 * @param {LoginCallback} callback - Callback function.
 * @returns {Promise<void>}
 */
async function loginHelper(credentials, callback) {
  const jar = utils.getJar();
  let mainPromise;

  try {
    const { appState, email, password } = credentials;

    if (appState?.length) {
      appState.forEach((c) => {
        const str = `${c.key}=${c.value}; expires=${c.expires}; domain=${c.domain}; path=${c.path};`;
        jar.setCookie(str, `http://${c.domain}`);
      });
      mainPromise = utils
        .get("https://www.facebook.com/", jar, null, state.globalOptions, { noRef: true })
        .then(utils.saveCookies(jar));
    } else if (email && password) {
      mainPromise = utils
        .get("https://www.facebook.com/", jar, null, state.globalOptions)
        .then(utils.saveCookies(jar))
        .then(makeLogin(jar, { email, password }));
    } else {
      throw new Error("Unsupported credential type");
    }

    /**
     * Checks and fixes errors in the response, including region-related errors.
     * @param {{ body: string, headers: Record<string, string> }} res - HTTP response object.
     * @param {boolean} fastSwitch - Whether to skip checks.
     * @returns {Promise<{ body: string, headers: Record<string, string> }>} Processed response.
     */
    async function checkAndFixErr(res, fastSwitch) {
      if (fastSwitch) return res;
      if (/7431627028261359627/.test(res.body)) {
        const data = JSON.stringify(res.body);
        const dtCheck = data.split("2Fhome.php&gfid=")[1];
        if (!dtCheck) return res;
        const fid = dtCheck.split("\\")[0];
        if (!fid) return res;
        const redirectLink = `https://m.facebook.com/a/preferences.php?basic_site_devices=m_basic&uri=${encodeURIComponent(
          "https://m.facebook.com/home.php"
        )}&gfid=${fid}`;
        log.info("checkAndFixErr", `Attempting to bypass region error with redirect: ${redirectLink}`);
        return utils
          .get(redirectLink, jar, null, state.globalOptions)
          .then(utils.saveCookies(jar));
      }
      return res;
    }

    /**
     * Handles redirects in the response.
     * @param {{ body: string, headers: Record<string, string> }} res - HTTP response object.
     * @param {boolean} fastSwitch - Whether to skip redirects.
     * @returns {Promise<{ body: string, headers: Record<string, string> }>} Processed response.
     */
    async function redirect(res, fastSwitch) {
      if (fastSwitch) return res;
      const reg = /<meta http-equiv="refresh" content="0;url=([^"]+)[^>]+>/;
      const redirectMatch = reg.exec(res.body);
      if (redirectMatch?.[1]) {
        log.info("redirect", `Following redirect to: ${redirectMatch[1]}`);
        return utils.get(redirectMatch[1], jar, null, state.globalOptions);
      }
      return res;
    }

    let ctx, api;
    mainPromise = mainPromise
      .then((res) => redirect(res))
      .then((res) => checkAndFixErr(res))
      .then((res) => {
        if (state.globalOptions.OnAutoLoginProcess) return res;
        if (!/MPageLoadClientMetrics/.test(res.body)) {
          return utils.get("https://www.facebook.com/", jar, null, state.globalOptions, { noRef: true });
        }
        return res;
      })
      .then((res) => bypassAutoBehavior(res, jar, credentials.appState || []))
      .then((res) => updateDTSG(res, credentials.appState || [], jar))
      .then(async (res) => {
        const url = "https://www.facebook.com/home.php";
        return utils.get(url, jar, null, state.globalOptions);
      })
      .then((res) => redirect(res, state.globalOptions.OnAutoLoginProcess))
      .then((res) => checkAndFixErr(res, state.globalOptions.OnAutoLoginProcess))
      .then(async (res) => {
        const html = res.body;
        const obj = buildAPI(html, jar);
        ctx = obj.ctx;
        api = obj.api;
        return res;
      });

    if (state.globalOptions.pageID) {
      mainPromise = mainPromise
        .then(() =>
          utils.get(
            `https://www.facebook.com/${ctx.globalOptions.pageID}/messages/?section=messages&subsection=inbox`,
            ctx.jar,
            null,
            state.globalOptions
          )
        )
        .then((resData) => {
          const url = utils
            .getFrom(resData.body, 'window.location.replace("https:\\/\\/www.facebook.com\\', '");')
            .split("\\")
            .join("");
          return utils.get(
            `https://www.facebook.com${url.substring(0, url.length - 1)}`,
            ctx.jar,
            null,
            state.globalOptions
          );
        });
    }

    mainPromise
      .then(async (res) => {
        const detectLocked = await checkIfLocked(res, credentials.appState || [], jar);
        if (detectLocked) throw detectLocked;
        const detectSuspension = await checkIfSuspended(res, credentials.appState || [], jar);
        if (detectSuspension) throw detectSuspension;
        log.info("loginHelper", "Done logging in.");
        callback(null, api);
      })
      .catch((error) => callback(error));
  } catch (error) {
    log.error("loginHelper", error.message);
    callback(error);
  }
}

/**
 * Main login function for Facebook authentication.
 * @param {LoginCredentials} loginData - Login credentials (appState or email/password).
 * @param {LoginOptions} [options={}] - Login configuration options.
 * @param {LoginCallback} [callback] - Callback function.
 * @returns {Promise<API> | undefined} API object or undefined if callback is provided.
 */
async function login(loginData, options = {}, callback) {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }

  const defaultOptions = {
    selfListen: false,
    selfListenEvent: false,
    listenEvents: true,
    listenTyping: false,
    updatePresence: false,
    forceLogin: false,
    autoMarkDelivery: false,
    autoMarkRead: true,
    autoReconnect: true,
    online: true,
    emitReady: false,
    randomUserAgent: false,
    refresh_dtsg: true, // Default to true for backward compatibility
  };

  Object.assign(state.globalOptions, defaultOptions);
  await setOptions(options);

  let credentials;
  try {
    credentials = normalizeLoginCredentials(loginData);
  } catch (error) {
    if (callback) {
      callback(error);
      return;
    }
    throw error;
  }

  if (callback) {
    const loginBox = async () => {
      try {
        await loginHelper(credentials, (error, api) => {
          if (error) {
            if (state.behaviorDetected) {
              log.warn("login", "Failed after behavior detection, retrying...");
              state.behaviorDetected = false;
              loginBox();
            } else {
              log.error("login", error);
              callback(error);
            }
            return;
          }
          callback(null, api);
        });
      } catch (error) {
        callback(error);
      }
    };
    loginBox();
    return;
  }

  return new Promise((resolve, reject) => {
    loginHelper(credentials, (error, api) => {
      if (error) reject(error);
      else resolve(api);
    });
  });
}

module.exports = login;