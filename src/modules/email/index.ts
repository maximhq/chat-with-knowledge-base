import { Resend } from "resend";

class EmailService {
  private static instance: EmailService;
  private resendClient: Resend;
  private emailFrom: string;
  private allowedDomains: string[];

  private constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not set");
    }
    this.resendClient = new Resend(apiKey);

    const emailFrom = process.env.EMAIL_FROM;
    if (!emailFrom) {
      throw new Error("EMAIL_FROM is not set");
    }
    this.emailFrom = emailFrom;

    const domains = process.env.ALLOWED_EMAIL_DOMAINS;
    this.allowedDomains = domains ? domains.split(",") : [];
  }

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  public async sendVerificationEmail(to: string, token: string): Promise<void> {
    const domain = to.split("@")[1];
    console.log("Allowed domains:", this.allowedDomains);
    console.log("Target domain:", domain);

    if (!this.allowedDomains.includes(domain)) {
      console.log(`Domain ${domain} not allowed. Skipping email send.`);
      return;
    }

    console.log("Sending OTP to:", to);
    await this.resendClient.emails.send({
      from: this.emailFrom,
      to,
      subject: "Verify your email address",
      html: `<p>Use the following OTP to verify your email address: ${token}</p>`,
    });
  }
}

export { EmailService };

export async function createEmailSender(): Promise<EmailService> {
  return EmailService.getInstance();
}
