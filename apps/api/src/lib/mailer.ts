import { isProduction } from "../env";

export interface MailInput {
  to: string;
  name: string;
  /** Full link the user must open. */
  url: string;
  token: string;
}

/**
 * Swap this interface's implementation for Resend / Postmark / SES later.
 * Nothing else in the codebase needs to change.
 */
export interface Mailer {
  sendVerificationEmail(input: MailInput): Promise<void>;
  sendPasswordResetEmail(input: MailInput): Promise<void>;
}

function printMail(kind: string, input: MailInput): void {
  const line = "=".repeat(72);
  console.log(
    [
      "",
      line,
      `[MAIL - console mailer] ${kind}`,
      `To:    ${input.name} <${input.to}>`,
      `Link:  ${input.url}`,
      `Token: ${input.token}`,
      line,
      "",
    ].join("\n"),
  );
}

/** Development mailer: prints the email instead of sending it. */
export const consoleMailer: Mailer = {
  async sendVerificationEmail(input) {
    printMail("Verify your email address", input);
  },
  async sendPasswordResetEmail(input) {
    printMail("Reset your password", input);
  },
};

export const mailer: Mailer = consoleMailer;

if (isProduction) {
  console.warn(
    "[mailer] The console mailer is active in production: no real emails are being sent.",
  );
}
