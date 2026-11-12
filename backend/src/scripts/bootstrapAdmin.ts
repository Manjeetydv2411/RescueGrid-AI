/**
 * Create the first administrator without placing credentials in source control.
 *
 * Usage:
 *   ADMIN_NAME="Operations Admin" ADMIN_EMAIL="admin@example.com" \
 *   ADMIN_PASSWORD="a-unique-password-at-least-12-chars" npm run bootstrap:admin
 *
 * This command is intentionally one-shot: it refuses to run when any admin
 * already exists, preserving existing users and preventing an unexpected
 * second privileged account.
 */

import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { connectDatabase, disconnectDatabase } from "../config/database.js";
import User, { hashUserPassword } from "../models/User.js";
import { logger } from "../utils/logger.js";

const prompt = async (message: string, secret = false): Promise<string> => {
  if (secret && process.stdin.isTTY) {
    const answer = await new Promise<string>((resolve) => {
      process.stdout.write(message);
      process.stdin.setRawMode?.(true);
      let value = "";
      const onData = (chunk: Buffer) => {
        const text = chunk.toString();
        if (text === "\u0003") process.exit(1);
        if (text === "\r" || text === "\n") {
          process.stdin.setRawMode?.(false);
          process.stdin.off("data", onData);
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        if (text === "\u007f") {
          value = value.slice(0, -1);
          return;
        }
        value += text;
      };
      process.stdin.on("data", onData);
    });
    return answer;
  }

  const rl = readline.createInterface({ input, output });
  const answer = await rl.question(message);
  rl.close();
  return answer;
};

const required = (value: string | undefined, name: string): string => {
  if (!value?.trim()) throw new Error(`${name} is required`);
  return value.trim();
};

const main = async (): Promise<void> => {
  if (!process.env.ADMIN_PASSWORD && !process.stdin.isTTY) {
    throw new Error("ADMIN_PASSWORD is required in non-interactive mode");
  }

  const name = required(
    process.env.ADMIN_NAME || await prompt("Administrator name: "),
    "ADMIN_NAME"
  );
  const email = required(
    process.env.ADMIN_EMAIL || await prompt("Administrator email: "),
    "ADMIN_EMAIL"
  ).toLowerCase();
  const password = process.env.ADMIN_PASSWORD || await prompt("Administrator password: ", true);

  if (password.length < 12) {
    throw new Error("Administrator password must be at least 12 characters");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Administrator email is invalid");
  }

  await connectDatabase();
  try {
    const adminCount = await User.countDocuments({ role: "ADMIN" });
    if (adminCount > 0) {
      throw new Error("An administrator already exists; use admin user management instead");
    }
    const existing = await User.findOne({ email });
    if (existing) throw new Error("That email is already registered");

    const user = await User.create({
      name,
      email,
      password: await hashUserPassword(password),
      role: "ADMIN",
    });

    logger.info(`Initial administrator created: ${user.email}`);
  } finally {
    await disconnectDatabase();
  }
};

main().catch(async (error) => {
  logger.error("Administrator bootstrap failed:", error as Error);
  await disconnectDatabase();
  process.exitCode = 1;
});
