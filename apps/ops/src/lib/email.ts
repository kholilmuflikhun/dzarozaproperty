type SendEmailInput = { to: string; subject: string; html: string; text: string; attachments?: Array<{ filename: string; content: string }> };

export async function sendTransactionalEmail(input: SendEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return { sent: false as const, reason: "not-configured" as const };
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from, to: [input.to], subject: input.subject, html: input.html, text: input.text,
        ...(input.attachments?.length ? { attachments: input.attachments } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      return { sent: false as const, reason: "provider-error" as const, status: response.status };
    }
    const result = await response.json().catch(() => ({})) as { id?: string };
    return { sent: true as const, messageId: result.id ?? null };
  } catch {
    return { sent: false as const, reason: "provider-error" as const, status: null };
  }
}
