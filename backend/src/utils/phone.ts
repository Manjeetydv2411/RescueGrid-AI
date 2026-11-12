/**
 * Phone number validation and E.164 normalization utilities for RescueGrid AI.
 * Standardizes international numbers and provides sensible defaults for India (+91).
 */

export const DEFAULT_COUNTRY_CODE = "+91";

export interface PhoneValidationResult {
  isValid: boolean;
  normalized?: string;
  error?: string;
}

export const COUNTRY_CODES = [
  { code: "+91", label: "India (+91)", flag: "🇮🇳" },
  { code: "+1", label: "United States / Canada (+1)", flag: "🇺🇸" },
  { code: "+44", label: "United Kingdom (+44)", flag: "🇬🇧" },
  { code: "+61", label: "Australia (+61)", flag: "🇦🇺" },
  { code: "+49", label: "Germany (+49)", flag: "🇩🇪" },
  { code: "+81", label: "Japan (+81)", flag: "🇯🇵" },
  { code: "+971", label: "UAE (+971)", flag: "🇦🇪" },
  { code: "+65", label: "Singapore (+65)", flag: "🇸🇬" },
] as const;

/**
 * Validates and normalizes phone numbers into standard E.164 format (+[country][national]).
 * E.164 format: + followed by 1-3 digits country code and 6-14 subscriber digits.
 */
export function normalizePhoneNumber(
  rawPhone: unknown,
  defaultCountryCode: string = DEFAULT_COUNTRY_CODE
): PhoneValidationResult {
  if (rawPhone === undefined || rawPhone === null) {
    return {
      isValid: false,
      error: "Contact phone number is required",
    };
  }

  const str = String(rawPhone).trim();
  if (str.length === 0) {
    return {
      isValid: false,
      error: "Contact phone number is required",
    };
  }

  // Strip all whitespace, hyphens, brackets, dots
  let cleaned = str.replace(/[\s\-\(\)\.]+/g, "");

  // Convert international double zero (e.g., 0091) to +91
  if (cleaned.startsWith("00")) {
    cleaned = "+" + cleaned.slice(2);
  }

  // If already starts with '+', validate as international E.164
  if (cleaned.startsWith("+")) {
    // E.164 format: + followed by country code (1-3 digits) and national number (6-14 digits)
    const e164Regex = /^\+[1-9]\d{6,14}$/;
    if (!e164Regex.test(cleaned)) {
      return {
        isValid: false,
        error: "Invalid phone number format. Please enter a valid international phone number (e.g. +91 9876543210).",
      };
    }

    // Specific validation for India (+91)
    if (cleaned.startsWith("+91")) {
      const national = cleaned.slice(3);
      if (!/^[6-9]\d{9}$/.test(national)) {
        return {
          isValid: false,
          error: "Invalid Indian phone number. Must be a 10-digit mobile number starting with 6, 7, 8, or 9.",
        };
      }
    }

    return {
      isValid: true,
      normalized: cleaned,
    };
  }

  // Remove leading 0 if present (common domestic trunk prefix)
  if (cleaned.startsWith("0")) {
    cleaned = cleaned.slice(1);
  }

  // If 10 digits, apply the default country code
  if (/^\d{10}$/.test(cleaned)) {
    if (defaultCountryCode === "+91") {
      if (!/^[6-9]\d{9}$/.test(cleaned)) {
        return {
          isValid: false,
          error: "Invalid Indian phone number. Must be a 10-digit mobile number starting with 6, 7, 8, or 9.",
        };
      }
    }
    return {
      isValid: true,
      normalized: `${defaultCountryCode}${cleaned}`,
    };
  }

  // General fallback: if digits between 7 and 14, prepend default country code and check E.164
  if (/^\d{7,14}$/.test(cleaned)) {
    const candidate = `${defaultCountryCode}${cleaned}`;
    if (/^\+[1-9]\d{6,14}$/.test(candidate)) {
      return {
        isValid: true,
        normalized: candidate,
      };
    }
  }

  return {
    isValid: false,
    error: "Invalid phone number format. Please provide a valid 10-digit mobile number or full international number.",
  };
}
