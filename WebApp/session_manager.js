import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const SESSION_FILE = join(process.cwd(), "bionic-session.json");

/**
 * Save current conversation state to a JSON file.
 * Call this after each `chat.send(...)` to persist context.
 */
function saveSession(chat, messages) {
  const state = {
    responseId: chat.responseId,
    model: chat.model,
    updatedAt: new Date().toISOString(),
    messages,
  };
  writeFileSync(SESSION_FILE, JSON.stringify(state, null, 2));
}

/**
 * Restore a previously saved session.
 * Returns the loaded state, or null if no file exists.
 */
function loadSession() {
  if (!existsSync(SESSION_FILE)) return null;
  return JSON.parse(readFileSync(SESSION_FILE, "utf-8"));
}

/**
 * Clear the saved session file.
 */
function clearSession() {
  if (existsSync(SESSION_FILE)) {
    const { unlinkSync } = require("fs");
    unlinkSync(SESSION_FILE);
  }
}