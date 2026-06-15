function getMsg91Config() {
  return {
    authKey: process.env.MSG91_AUTH_KEY || "",
    templateId: process.env.MSG91_TEMPLATE_ID || "",
    senderId: process.env.MSG91_SENDER_ID || "OWEGON",
    timeoutMs: Number.parseInt(process.env.MSG91_TIMEOUT_MS || "5000", 10),
    // SMS > Templates (DLT) use Flow API. OTP > Templates use OTP API.
    useOtpApi: process.env.MSG91_USE_OTP_API === "true",
  };
}

type Msg91Response = {
  response: Response;
  body: Record<string, unknown>;
  bodyText: string;
};

async function parseResponse(response: Response): Promise<Msg91Response> {
  const bodyText = await response.text();
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(bodyText) as Record<string, unknown>;
  } catch {
    body = { message: bodyText };
  }
  return { response, body, bodyText };
}

function isMsg91Success(result: Msg91Response): boolean {
  const type = String(result.body.type || "").toLowerCase();
  return result.response.ok && (!type || type === "success");
}

async function sendViaFlowApi(
  authKey: string,
  templateId: string,
  senderId: string,
  mobile: string,
  otp: string,
  signal: AbortSignal,
): Promise<Msg91Response> {
  const response = await fetch("https://control.msg91.com/api/v5/flow/", {
    method: "POST",
    headers: {
      authkey: authKey,
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      flow_id: templateId,
      sender: senderId,
      recipients: [
        {
          mobiles: mobile,
          OTP: otp,
        },
      ],
    }),
    signal,
  });

  return parseResponse(response);
}

async function sendViaOtpApi(
  authKey: string,
  templateId: string,
  senderId: string,
  mobile: string,
  otp: string,
  expiryMinutes: number,
  signal: AbortSignal,
): Promise<Msg91Response> {
  const params = new URLSearchParams({
    template_id: templateId,
    mobile,
    otp,
    otp_expiry: String(expiryMinutes),
    otp_length: "6",
  });

  const response = await fetch(
    `https://control.msg91.com/api/v5/otp?${params.toString()}`,
    {
      method: "POST",
      headers: {
        authkey: authKey,
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({ sender: senderId }),
      signal,
    },
  );

  return parseResponse(response);
}

async function sendViaLegacyOtpApi(
  authKey: string,
  senderId: string,
  mobile: string,
  otp: string,
  expiryMinutes: number,
  signal: AbortSignal,
): Promise<Msg91Response> {
  const legacyParams = new URLSearchParams({
    authkey: authKey,
    mobile,
    otp,
    sender: senderId,
    otp_expiry: String(expiryMinutes),
    otp_length: "6",
  });

  const response = await fetch(
    `https://api.msg91.com/api/sendotp.php?${legacyParams.toString()}`,
    { method: "GET", signal },
  );

  return parseResponse(response);
}

export async function sendLoginOtpSms(
  mobile: string,
  otp: string,
  expiryMinutes: number,
): Promise<void> {
  const { authKey, templateId, senderId, timeoutMs, useOtpApi } = getMsg91Config();

  if (!authKey || !templateId) {
    throw new Error("MSG91 is not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (useOtpApi) {
      const otpResult = await sendViaOtpApi(
        authKey,
        templateId,
        senderId,
        mobile,
        otp,
        expiryMinutes,
        controller.signal,
      );
      if (isMsg91Success(otpResult)) return;

      const legacyResult = await sendViaLegacyOtpApi(
        authKey,
        senderId,
        mobile,
        otp,
        expiryMinutes,
        controller.signal,
      );
      if (isMsg91Success(legacyResult)) return;

      throw new Error(
        `MSG91 OTP API error: ${String(
          legacyResult.body.message || otpResult.body.message || otpResult.bodyText,
        )}`,
      );
    }

    const flowResult = await sendViaFlowApi(
      authKey,
      templateId,
      senderId,
      mobile,
      otp,
      controller.signal,
    );
    if (isMsg91Success(flowResult)) {
      console.log(`[msg91] OTP SMS queued via Flow API to ***${mobile.slice(-4)}`);
      return;
    }

    console.warn(
      "[msg91] Flow API failed, falling back to OTP API:",
      flowResult.body.message || flowResult.bodyText,
    );

    const otpResult = await sendViaOtpApi(
      authKey,
      templateId,
      senderId,
      mobile,
      otp,
      expiryMinutes,
      controller.signal,
    );
    if (isMsg91Success(otpResult)) return;

    throw new Error(
      `MSG91 error: ${String(
        otpResult.body.message || flowResult.body.message || flowResult.bodyText,
      )}`,
    );
  } finally {
    clearTimeout(timeout);
  }
}
