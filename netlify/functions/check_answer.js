function json(statusCode, obj) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type"
    },
    body: JSON.stringify(obj)
  };
}

function normalizeAnswer(text) {
  const t0 = String(text || "").trim().toLowerCase();
  const t1 = t0.replace(/\s+/g, " ");
  const t2 = t1.replace(/[^a-z0-9 .\-+/]/g, "");
  return t2;
}

exports.handler = async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { correct: false });
  }

  const correct = normalizeAnswer(payload.correct_answer);
  const user = normalizeAnswer(payload.user_answer);

  if (!correct || !user) return json(200, { correct: false });
  if (user === correct) return json(200, { correct: true });
  if (correct.length >= 4 && user.includes(correct)) return json(200, { correct: true });
  if (user.length >= 4 && correct.includes(user)) return json(200, { correct: true });

  return json(200, { correct: false });
};
