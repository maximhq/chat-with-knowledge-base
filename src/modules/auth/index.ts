// Auth Module - Authentication using Auth.js v5 with Email OTP
import NextAuth from "next-auth";
import Email from "next-auth/providers/nodemailer";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/modules/storage";
import type { Session, User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { generate as GenerateOtp } from "otp-generator";

const EmailOtpProvider = Email({
  server: {},
  id: "email",
  maxAge: 5 * 60,
  generateVerificationToken: async () => {
    const otp = GenerateOtp(6, {
      upperCaseAlphabets: true,
      lowerCaseAlphabets: false,
      specialChars: false,
    });
    console.log(">>> EMAIL OTP: ", otp);
    return otp;
  },
  sendVerificationRequest: async (req) => {
    // no-op
  },
});

// NextAuth.js v5 configuration
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [EmailOtpProvider],
  pages: {
    signIn: "/auth/signin",
    verifyRequest: "/auth/verify-request",
    error: "/auth/error",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }: { token: JWT; user?: User }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (token && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
    async signIn({ user }: { user: User }) {
      // Additional validation can be added here
      console.log("User signing in:", user.email);
      return true;
    },
  },
  events: {
    async createUser({ user }: { user: User }) {
      console.log("New user created:", user.email);
    },
    async signIn({ user, isNewUser }: { user: User; isNewUser?: boolean }) {
      console.log(
        "User signed in:",
        user.email,
        isNewUser ? "(new user)" : "(existing user)"
      );
    },
  },
});

// Auth utilities
export class AuthUtils {
  /**
   * Check if user is authenticated
   */
  static isAuthenticated(session: Session | null): boolean {
    return !!session?.user?.id;
  }

  /**
   * Get user ID from session
   */
  static getUserId(session: Session | null): string | null {
    return session?.user?.id || null;
  }

  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Generate secure verification token
   */
  static generateVerificationToken(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }
}

// Route protection middleware for NextAuth.js v5
export function withAuth<T extends Record<string, unknown>>(
  handler: (
    req: NextRequest,
    res: NextResponse,
    session: Session | null
  ) => Promise<T>
) {
  return async (req: NextRequest, res: NextResponse) => {
    try {
      const session = await auth();

      if (!AuthUtils.isAuthenticated(session)) {
        return NextResponse.json(
          {
            success: false,
            error: "Authentication required",
          },
          { status: 401 }
        );
      }

      return await handler(req, res, session);
    } catch (error) {
      console.error("Auth middleware error:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Internal server error",
        },
        { status: 500 }
      );
    }
  };
}

// Client-side auth hook for NextAuth.js v5
// Note: This function should only be used in client components
export function useAuthGuard() {
  // Dynamic import to avoid SSR issues - this is intentional for client-only usage
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useSession } = require("next-auth/react");
  const { data: session, status } = useSession();

  return {
    session,
    isLoading: status === "loading",
    isAuthenticated: AuthUtils.isAuthenticated(session),
    userId: AuthUtils.getUserId(session),
  };
}

// Export the auth function as default for compatibility
export { auth as default };
