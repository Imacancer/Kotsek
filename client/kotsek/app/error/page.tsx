"use client";

import React, { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle, RefreshCcw, User2 } from "lucide-react";

interface ErrorDetail {
  title: string;
  description: string;
  code: string;
}

type ErrorMapKeys =
  | "missing_user_info"
  | "user_creation_failed"
  | "token_exchange_failed"
  | "access_denied"
  | "user_info_failed";

type ErrorMap = {
  [key in ErrorMapKeys]: ErrorDetail;
};

const ErrorPage = () => {
  const [errorDetails, setErrorDetails] = useState<ErrorDetail>({
    title: "Unknown Error",
    description: "An unknown error has occurred.",
    code: "303",
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get("error");

    if (errorParam) {
      const errorMap: ErrorMap = {
        missing_user_info: {
          title: "Missing User Info",
          description: "The user info is missing.",
          code: "303",
        },
        user_creation_failed: {
          title: "User Creation Failed",
          description: "The user creation failed.",
          code: "303",
        },
        token_exchange_failed: {
          title: "Token Exchange Failed",
          description: "The token exchange failed.",
          code: "303",
        },
        user_info_failed: {
          title: "User Info Failed",
          description: "The user info failed.",
          code: "303",
        },
        access_denied: {
          title: "Access Denied",
          description: "You do not have permission to access this resource.",
          code: "403",
        },
      };

      // Type-safe check using type predicate
      const isValidErrorKey = (key: string): key is ErrorMapKeys => {
        return Object.keys(errorMap).includes(key);
      };

      if (isValidErrorKey(errorParam)) {
        setErrorDetails(errorMap[errorParam]);
      } else {
        setErrorDetails({
          title: `Error: ${errorParam}`,
          description: "An error has occurred.",
          code: "500",
        });
      }
    }
  }, []);

  const handleGoHome = () => {
    window.location.href = "/login";
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-4">
        <Card className="border-yellow-200 shadow-lg">
          <CardHeader className="border-b pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl font-bold text-yellow-300">
                {errorDetails.title}
              </CardTitle>
              <div className="text-5xl font-bold text-yellow-300 opacity-80">
                {errorDetails.code}
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{errorDetails.description}</AlertDescription>
            </Alert>

            <p className="text-sm text-gray-500 mt-4">
              If you believe this is a mistake, please try refreshing the page
              or contact support if the issue persists.
            </p>
          </CardContent>

          <CardFooter className="flex justify-between border-t pt-4">
            <Button variant="outline" onClick={handleGoHome}>
              <User2 className="mr-2 h-4 w-4" />
              Login
            </Button>
            <Button variant="default" onClick={handleRefresh}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default ErrorPage;
