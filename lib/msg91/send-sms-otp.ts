function getMsg91Config() {
  return {
    authKey: process.env.MSG91_AUTH_KEY || "",
    templateId: process.env.MSG91_TEMPLATE_ID || "",
    senderId: process.env.MSG91_SENDER_ID || "OWEGON",
    timeoutMs: Number.parseInt(process.env.MSG91_TIMEOUT_MS || "5000", 10),
  };
}

export async function sendLoginOtpSms(
  mobile: string,
  otp: string,
  expiryMinutes: number,
): Promise<void> {
  const { authKey, templateId, senderId, timeoutMs } = getMsg91Config();

  if (!authKey || !templateId) {
    throw new Error("MSG91 is not configured");
  }

  const params = new URLSearchParams({
    template_id: templateId,
    mobile,
    otp,
    otp_expiry: String(expiryMinutes),
    otp_length: "6",
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const parseResponse = async (response: Response) => {
    const bodyText = await response.text();
    let body: Record<string, unknown> = {};
    try {
      body = JSON.parse(bodyText) as Record<string, unknown>;
    } catch {
      body = { message: bodyText };
    }
    return { response, body, bodyText };
  };

  try {
    const v5 = await fetch(
      `https://control.msg91.com/api/v5/otp?${params.toString()}`,
      {
        method: "POST",
        headers: {
          authkey: authKey,
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({ sender: senderId }),
        signal: controller.signal,
      },
    );

    const { response, body, bodyText } = await parseResponse(v5);
    const type = String(body.type || "").toLowerCase();

    if (response.ok && (!type || type === "success")) {
      return;
    }

    const legacyParams = new URLSearchParams({
      authkey: authKey,
      mobile,
      otp,
      sender: senderId,
      otp_expiry: String(expiryMinutes),
      otp_length: "6",
    });

    const legacy = await fetch(
      `https://api.msg91.com/api/sendotp.php?${legacyParams.toString()}`,
      { method: "GET", signal: controller.signal },
    );
    const legacyResult = await parseResponse(legacy);
    const legacyType = String(legacyResult.body.type || "").toLowerCase();

    if (legacyResult.response.ok && (!legacyType || legacyType === "success")) {
      return;
    }

    throw new Error(
      `MSG91 error: ${String(
        legacyResult.body.message || body.message || bodyText,
      )}`,
    );
  } finally {
    clearTimeout(timeout);
  }
}
