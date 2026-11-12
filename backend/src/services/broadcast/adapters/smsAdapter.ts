import { logger } from "../../../utils/logger.js";
import { DeliveryStatus } from "../../../models/BroadcastDelivery.js";

export interface SendMessageOptions {
  to: string;
  message: string;
  title: string;
  severity?: string;
  location?: string;
}

export interface AdapterResult {
  status: DeliveryStatus;
  providerResponse?: string;
  errorMessage?: string;
}

/**
 * MSG91 SMS Flow API Adapter.
 * Supports Indian phone numbers in international format (+91 / 91).
 * Falls back to SIMULATED status if MSG91_AUTH_KEY is not configured.
 */
export const sendSms = async (options: SendMessageOptions): Promise<AdapterResult> => {
  try {
    const authKey = process.env.MSG91_AUTH_KEY;
    const templateId = process.env.MSG91_TEMPLATE_ID;

    if (!authKey || !templateId) {
      logger.info(`[SMS SIMULATOR] To: ${options.to} | Message: ${options.message}`);
      return {
        status: "SIMULATED",
        providerResponse: "Simulated SMS dispatch (MSG91 credentials not configured)",
      };
    }

    // Normalize phone number (handle +91, 91, or 10-digit Indian numbers)
    let cleanedPhone = options.to.replace(/\D/g, "");
    if (cleanedPhone.length === 10) {
      cleanedPhone = `91${cleanedPhone}`;
    } else if (cleanedPhone.startsWith("0") && cleanedPhone.length === 11) {
      cleanedPhone = `91${cleanedPhone.substring(1)}`;
    }

    if (cleanedPhone.length < 10) {
      return {
        status: "FAILED",
        errorMessage: `Invalid recipient phone number for SMS: ${options.to}`,
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    // MSG91 Flow API payload
    const payload = {
      template_id: templateId,
      sender: "RSCGRD",
      short_url: "0",
      mobiles: cleanedPhone,
      var1: options.title.substring(0, 50),
      var2: options.severity || "HIGH",
      var3: options.message.substring(0, 160),
      var4: options.location || "System Command Center",
    };

    const response = await fetch("https://control.msg91.com/api/v5/flow/", {
      method: "POST",
      headers: {
        "authkey": authKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json() as any;

    if (!response.ok || (data?.type && data.type !== "success")) {
      const errMsg = data?.message || `MSG91 API error status ${response.status}`;
      logger.error(`MSG91 API rejection for ${cleanedPhone}: ${errMsg}`);
      return {
        status: "FAILED",
        errorMessage: errMsg,
      };
    }

    logger.info(`[SMS MSG91 SENT] Mobiles: ${cleanedPhone} | MessageId: ${data?.message || data?.code}`);
    return {
      status: "SENT",
      providerResponse: `MSG91 accepted (ID: ${data?.message || data?.code || "success"})`,
    };
  } catch (error) {
    const err = error as Error;
    logger.error(`SMS adapter error for ${options.to}: ${err.message}`);
    return {
      status: "FAILED",
      errorMessage: err.name === "AbortError" ? "MSG91 API request timed out (10s)" : err.message,
    };
  }
};
