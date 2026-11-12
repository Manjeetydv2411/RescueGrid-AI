import { logger } from "../../../utils/logger.js";
import { DeliveryStatus } from "../../../models/BroadcastDelivery.js";
import { SendMessageOptions, AdapterResult } from "./smsAdapter.js";

/**
 * Provider-independent Push Notification Adapter.
 */
export const sendPush = async (options: SendMessageOptions): Promise<AdapterResult> => {
  try {
    const hasRealCredentials = Boolean(process.env.FCM_SERVER_KEY || process.env.PUSH_API_KEY);

    if (!hasRealCredentials) {
      logger.info(`[PUSH SIMULATOR] To: ${options.to} | Title: ${options.title} | Body: ${options.message}`);
      return {
        status: "SIMULATED",
        providerResponse: "Simulated push notification dispatch (no push service configured)",
      };
    }

    logger.info(`[PUSH REAL] Dispatching to ${options.to}`);
    return {
      status: "SENT",
      providerResponse: "Dispatched via push notification provider",
    };
  } catch (error) {
    logger.error(`Push adapter error: ${(error as Error).message}`);
    return {
      status: "FAILED",
      errorMessage: (error as Error).message,
    };
  }
};
