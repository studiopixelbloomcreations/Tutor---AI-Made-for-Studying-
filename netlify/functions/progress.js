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

exports.handler = async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });

  // NOTE: Netlify Functions are stateless. This endpoint is implemented as a best-effort
  // compatibility layer so the frontend doesn't fail, but it does not persist data.

  if (event.httpMethod === "GET") {
    const email = (event.queryStringParameters && event.queryStringParameters.email) || "guest@student.com";
    return json(200, { email, progress: null });
  }

  if (event.httpMethod === "POST") {
    return json(200, { ok: true });
  }

  return json(405, { error: "Method not allowed" });
};
