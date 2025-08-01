'use client';

import React from 'react';
import { useSession, signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { data: session, status } = useSession();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (status === 'loading') {
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
                  if (e.key === 'Enter' && email) {
                    handleSignIn();
                  }
                }}
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
                  <span>Sending magic link...</span>
                </div>
              ) : (
                'Sign in with Email'
              )}
            </Button>
            <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
              We'll send you a magic link to sign in securely
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  async function handleSignIn() {
    if (!email) return;
    
    setIsLoading(true);
    try {
      await signIn('email', { email, redirect: false });
      // Show success message or redirect to verification page
    } catch (error) {
      console.error('Sign in error:', error);
    } finally {
      setIsLoading(false);
    }
  }

  return <>{children}</>;
}

export default AuthGuard;
