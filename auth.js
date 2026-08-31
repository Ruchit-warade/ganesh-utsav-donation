/**
 * auth.js — shared auth-state helper (re-export).
 *
 * The concrete auth-state logic used by the public pages lives in
 * script.js (navbar + session). This file exists to keep the project
 * structure complete and to give a single import point for any page
 * that wants only the auth bootstrap. It is OPTIONAL — the app works
 * without importing this file.
 */

export { initAuth } from "./script.js";
