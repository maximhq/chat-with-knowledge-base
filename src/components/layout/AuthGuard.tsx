"use client";

import React from "react";
import { useSession, signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { data: session, status } = useSession();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showOtpInput, setShowOtpInput] = useState(false);

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Welcome</CardTitle>
            <CardDescription>
              Sign in to access your knowledge base chat
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!showOtpInput ? (
              // Email input step
              <>
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium">
                    Email address
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter" && email) {
                        handleSignIn();
                      }
                    }}
                    disabled={isLoading}
                  />
                </div>
                <Button
                  onClick={handleSignIn}
                  disabled={!email || isLoading}
                  className="w-full"
                >
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Sending OTP...</span>
                    </div>
                  ) : (
                    "Send OTP"
                  )}
                </Button>
                <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
                  We&apos;ll generate an OTP for you to sign in securely
                </p>
              </>
            ) : (
              // OTP input step
              <>
                <div className="space-y-2">
                  <label htmlFor="otp" className="text-sm font-medium">
                    Enter OTP
                  </label>
                  <Input
                    id="otp"
                    type="text"
                    placeholder="Enter the 6-digit OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.toUpperCase())}
                    onKeyPress={(e) => {
                      if (e.key === "Enter" && otp) {
                        handleOtpVerification();
                      }
                    }}
                    disabled={isLoading}
                    maxLength={6}
                  />
                </div>
                <Button
                  onClick={handleOtpVerification}
                  disabled={!otp || otp.length !== 6 || isLoading}
                  className="w-full"
                >
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Verifying...</span>
                    </div>
                  ) : (
                    "Verify OTP"
                  )}
                </Button>
                <div className="space-y-2">
                  <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
                    Check the console for your OTP (sent to: {email})
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowOtpInput(false);
                      setOtp("");
                    }}
                    className="w-full"
                    disabled={isLoading}
                  >
                    Back to Email
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  async function handleSignIn() {
    if (!email) return;

    setIsLoading(true);
    try {
      const result = await signIn("email", { email, redirect: false });
      if (result?.ok) {
        setShowOtpInput(true);
      } else {
        console.error("Sign in failed:", result?.error);
      }
    } catch (error) {
      console.error("Sign in error:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleOtpVerification() {
    if (!otp) return;

    setIsLoading(true);
    try {
      // For NextAuth.js with custom OTP, we need to construct the verification URL
      // The OTP is used as the token in the verification URL
      const callbackUrl = `${
        window.location.origin
      }/api/auth/callback/email?token=${otp}&email=${encodeURIComponent(
        email,
      )}`;
      window.location.href = callbackUrl;
    } catch (error) {
      console.error("OTP verification error:", error);
      setIsLoading(false);
    }
  }

  return <>{children}</>;
}

export default AuthGuard;
