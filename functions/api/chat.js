/**
 * Cloudflare Pages Function — Grok proxy (SpaceXAI / xAI)
 *
 * Deploy this folder with Cloudflare Pages and set secret:
 *   XAI_API_KEY = your key from https://console.x.ai
 *
 * Client posts OpenAI-compatible chat body to /api/chat
 */
export async function onRequestPost(context) {
  const key = context.env.XAI_API_KEY;
  if (!key) {
    return json({ error: "XAI_API_KEY not configured" }, 503);
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const payload = {
    model: body.model || "grok-4.5",
    messages: body.messages || [],
    temperature: body.temperature ?? 0.5,
    max_tokens: body.max_tokens ?? 800,
  };

  if (!payload.messages.length) {
    return json({ error: "messages required" }, 400);
  }

  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
