// Use browser localStorage instead of filesystem
const SESSION_KEY = "bionic-session";

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
  localStorage.setItem(SESSION_KEY, JSON.stringify(state));
}

/**
 * Restore a previously saved session.
 * Returns the loaded state, or null if no file exists.
 */
function loadSession() {
  const data = localStorage.getItem(SESSION_KEY);
  if (!data) return null;
  return JSON.parse(data);
}

/**
 * Clear the saved session file.
 */
function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

/**
 * Append a new assistant response (and the preceding user message) to the stored session.
 * @param {string|null} responseId - Identifier of the assistant response.
 * @param {Array<{role: string, content: string}>} messages - Array containing the user and assistant messages that just occurred.
 */
function appendSession(responseId, messages) {
  const existing = loadSession();
  let state;
  if (existing) {
    state = existing;
    // Append new messages to existing array
    state.messages.push(...messages);
  } else {
    // No prior session, create a fresh one
    state = {responseId: null, model: null, updatedAt: null, messages: []};
    state.messages.push(...messages);
  }
  // Update with latest response id and timestamp
  state.responseId = responseId;
  state.updatedAt = new Date().toISOString();
  localStorage.setItem(SESSION_KEY, JSON.stringify(state));
}
