"use client";

import { useState } from "react";
import MaxWidthWrapper from "@/components/MaxWidthWrapper";
import axios from "axios";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

interface OTPVerificationProps {
  email: string;
  onBack: () => void;
  isRegistration?: boolean;
}

export default function OTPVerification({
  email,
  onBack,
  isRegistration = false,
}: OTPVerificationProps) {
  const router = useRouter();
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL;

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const endpoint = isRegistration
        ? "/verify-registration"
        : "/verify-login";
      const response = await axios.post(`${SERVER_URL}${endpoint}`, {
        email,
        otp,
      });

      const { access_token, refresh_token, user } = response.data;

      if (access_token && refresh_token) {
        sessionStorage.setItem("access_token", access_token);
        sessionStorage.setItem("refresh_token", refresh_token);
        sessionStorage.setItem("user", JSON.stringify(user));

        toast.success(
          isRegistration ? "Account created successfully!" : "Login successful!"
        );
        router.push("/detect");
      }
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.error || "Verification failed. Please try again.";
      setError(errorMessage);
      toast.error("Verification failed", {
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 shadow-xl border border-white/20 relative">
        {error && (
          <Alert
            variant="destructive"
            className="mb-4 bg-red-500/10 text-red-500 border border-red-500/20"
          >
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white">Verify Your Email</h1>
          <p className="text-white/80 mt-1 text-sm">
            We've sent a verification code to {email}
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleVerifyOTP}>
          <div>
            <label
              htmlFor="otp"
              className="block text-sm font-medium text-white/90 mb-1"
            >
              Enter Verification Code
            </label>
            <input
              type="text"
              id="otp"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all"
              placeholder="Enter the code"
              maxLength={6}
            />
          </div>

          <button
            type="submit"
            className="w-full bg-yellow-500 text-white py-2 px-4 rounded-lg font-medium hover:bg-yellow-400 transition-all duration-200 text-sm disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? "Verifying..." : "Verify Code"}
          </button>

          <button
            type="button"
            onClick={onBack}
            className="w-full text-white/60 hover:text-white transition-all duration-200 text-sm"
          >
            Back to {isRegistration ? "Register" : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}