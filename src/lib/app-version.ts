import packageJson from "../../package.json";

/** Versión visible de la app (package.json). */
export const APP_VERSION = String(packageJson.version || "0.0.0");

export const APP_VERSION_LABEL = `v${APP_VERSION.replace(/^v/i, "")}`;
