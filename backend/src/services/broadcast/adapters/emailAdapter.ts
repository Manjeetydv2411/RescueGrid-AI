import { logger } from "../../../utils/logger.js";
import { DeliveryStatus } from "../../../models/BroadcastDelivery.js";
import { SendMessageOptions, AdapterResult } from "./smsAdapter.js";

export interface EmailMessageOptions extends SendMessageOptions {
  severity?: string;
  location?: string;
}

/**
 * Dual-Transport Email Adapter (Resend API & Gmail / SMTP Nodemailer).
 */
export const sendEmail = async (options: EmailMessageOptions): Promise<AdapterResult> => {
  try {
    const provider = (process.env.EMAIL_PROVIDER || "").toUpperCase().trim();
    const hasResend = Boolean(process.env.RESEND_API_KEY);
    const hasSmtp = Boolean(process.env.SMTP_HOST && (process.env.SMTP_USER || process.env.SMTP_PASS));

    const selectedProvider = provider || (hasResend ? "RESEND" : hasSmtp ? "SMTP" : "SIMULATED");

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(options.to)) {
      return {
        status: "FAILED",
        errorMessage: `Invalid recipient email address: ${options.to}`,
      };
    }

    const htmlContent = `
      <div style="font-family: monospace; background: #0f172a; color: #f8fafc; padding: 20px; border-radius: 8px;">
        <h2 style="color: #ef4444; border-bottom: 2px solid #ef4444; padding-bottom: 8px;">🚨 EMERGENCY ALERT: ${options.title}</h2>
        <p><strong>Severity:</strong> <span style="color: #ef4444;">${options.severity || "HIGH"}</span></p>
        <p><strong>Message:</strong></p>
        <div style="background: #1e293b; padding: 12px; border-left: 4px solid #38bdf8; margin: 10px 0; white-space: pre-wrap;">${options.message}</div>
        ${options.location ? `<p><strong>Location:</strong> ${options.location}</p>` : ""}
        <hr style="border-color: #334155; margin-top: 20px;" />
        <p style="font-size: 11px; color: #94a3b8;">RescueGrid AI Command Center — Automated Emergency Notification</p>
      </div>
    `;

    if (selectedProvider === "SMTP") {
      if (!process.env.SMTP_HOST) {
        logger.info(`[EMAIL SIMULATOR - SMTP] To: ${options.to} | SMTP_HOST not configured`);
        return {
          status: "SIMULATED",
          providerResponse: "Simulated email dispatch (SMTP not configured)",
        };
      }

      try {
        let nodemailer: any;
        try {
          nodemailer = await import("nodemailer");
        } catch {
          return {
            status: "FAILED",
            errorMessage: "Nodemailer package is not installed",
          };
        }

        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || "587", 10),
          secure: process.env.SMTP_PORT === "465",
          auth: process.env.SMTP_USER && process.env.SMTP_PASS ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          } : undefined,
          connectionTimeout: 10000,
          greetingTimeout: 10000,
        });

        const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER || "alerts@rescuegrid.ai";

        const info = await transporter.sendMail({
          from: fromEmail,
          to: options.to,
          subject: `[EMERGENCY] ${options.title}`,
          html: htmlContent,
        });

        logger.info(`[EMAIL SMTP SENT] MessageId: ${info?.messageId} | To: ${options.to}`);
        return {
          status: "SENT",
          providerResponse: `SMTP accepted (ID: ${info?.messageId || "sent"})`,
        };
      } catch (smtpError) {
        const err = smtpError as Error;
        logger.error(`SMTP sending error for ${options.to}: ${err.message}`);
        return {
          status: "FAILED",
          errorMessage: `SMTP Error: ${err.message}`,
        };
      }
    }

    if (selectedProvider === "RESEND" || hasResend) {
      const apiKey = process.env.RESEND_API_KEY;
      const fromEmail = process.env.RESEND_FROM_EMAIL || "alerts@rescuegrid.ai";

      if (!apiKey) {
        logger.info(`[EMAIL SIMULATOR - RESEND] To: ${options.to} | RESEND_API_KEY not configured`);
        return {
          status: "SIMULATED",
          providerResponse: "Simulated email dispatch (RESEND_API_KEY not configured)",
        };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [options.to],
          subject: `[EMERGENCY] ${options.title}`,
          html: htmlContent,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await response.json() as any;

      if (!response.ok) {
        const errMsg = data?.message || `Resend API error status ${response.status}`;
        logger.error(`Resend API rejection for ${options.to}: ${errMsg}`);
        return {
          status: "FAILED",
          errorMessage: errMsg,
        };
      }

      logger.info(`[EMAIL RESEND SENT] ID: ${data?.id} | To: ${options.to}`);
      return {
        status: "SENT",
        providerResponse: `Resend ID: ${data?.id || "accepted"}`,
      };
    }

    // Default fallback simulation
    logger.info(`[EMAIL SIMULATOR] To: ${options.to} | Subject: ${options.title}`);
    return {
      status: "SIMULATED",
      providerResponse: "Simulated email dispatch (no email provider credentials configured)",
    };
  } catch (error) {
    const err = error as Error;
    logger.error(`Email adapter error for ${options.to}: ${err.message}`);
    return {
      status: "FAILED",
      errorMessage: err.message,
    };
  }
};
