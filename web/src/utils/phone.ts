export const DEFAULT_COUNTRY_CODE = "+91";

export interface PhoneValidationResult {
  isValid: boolean;
  normalized?: string;
  error?: string;
}

export function normalizePhoneNumber(
  rawPhone: string,
  defaultCountryCode: string = DEFAULT_COUNTRY_CODE
): PhoneValidationResult {
  if (!rawPhone || rawPhone.trim().length === 0) {
    return { isValid: false, error: "Contact phone number is required" };
  }

  let cleaned = rawPhone.trim().replace(/[\s\-\(\)\.]+/g, "");

  // Convert international double zero (e.g., 0091) to +91
  if (cleaned.startsWith("00")) {
    cleaned = "+" + cleaned.slice(2);
  }

  // If already starts with '+', validate as international E.164
  if (cleaned.startsWith("+")) {
    const e164Regex = /^\+[1-9]\d{6,14}$/;
    if (!e164Regex.test(cleaned)) {
      return {
        isValid: false,
        error: "Invalid phone number format. Please enter a valid international phone number (e.g. +91 9876543210).",
      };
    }
    return { isValid: true, normalized: cleaned };
  }

  // Remove leading 0 if present (common domestic trunk prefix)
  if (cleaned.startsWith("0")) {
    cleaned = cleaned.slice(1);
  }

  // If 10 digits, apply the default country code
  if (/^\d{10}$/.test(cleaned)) {
    return { isValid: true, normalized: `${defaultCountryCode}${cleaned}` };
  }

  return {
    isValid: false,
    error: "Invalid phone number format. Please provide a valid 10-digit mobile number or full international number.",
  };
}

export const phone = { normalizePhoneNumber };
