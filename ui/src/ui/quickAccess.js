function fold(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .trim();
}

function searchableSession(session) {
  return fold([
    session?.date,
    session?.provider,
    session?.location,
    session?.vehicle,
    session?.connector,
    session?.tags,
    session?.note,
    session?.energy_kwh,
  ].filter(Boolean).join(" "));
}

function searchableAction(action) {
  return fold([action?.label, action?.description, ...(action?.keywords || [])].filter(Boolean).join(" "));
}

function matchesTokens(haystack, tokens) {
  return tokens.every((token) => haystack.includes(token));
}

export function buildQuickAccessResults({ actions = [], sessions = [], query = "", actionLimit = 8, sessionLimit = 6 } = {}) {
  const tokens = fold(query).split(/\s+/).filter(Boolean);
  const actionResults = actions
    .filter((action) => !tokens.length || matchesTokens(searchableAction(action), tokens))
    .slice(0, actionLimit)
    .map((action) => ({ ...action, resultType: "action", resultId: `action-${action.id}` }));

  const sessionResults = [...sessions]
    .filter((session) => !tokens.length || matchesTokens(searchableSession(session), tokens))
    .sort((left, right) => String(right?.date || "").localeCompare(String(left?.date || "")))
    .slice(0, tokens.length ? sessionLimit : Math.min(sessionLimit, 4))
    .map((session) => ({
      id: session?.id,
      resultId: `session-${session?.id}`,
      resultType: "session",
      session,
    }));

  return { actions: actionResults, sessions: sessionResults, total: actionResults.length + sessionResults.length };
}

export function isQuickAccessTypingTarget(target) {
  const tagName = String(target?.tagName || "").toLowerCase();
  return Boolean(target?.isContentEditable || ["input", "textarea", "select"].includes(tagName));
}
