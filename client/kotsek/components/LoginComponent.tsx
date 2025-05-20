"use client";

import { useState, useEffect, useRef } from "react";
import MaxWidthWrapper from "@/components/MaxWidthWrapper";
import axios from "axios";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import OTPVerification from "@/components/OTPVerification";

type ApiError = {
  response?: {
    data?: {
      error?: string;
    };
  };
  message?: string;
};

interface User {
  id: number;
  email: string;
  username: string;
  profile_image: string | null;
}

export default function LoginComponent() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [scrollY, setScrollY] = useState(0);
  const [isLogin, setIsLogin] = useState(true);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showOTP, setShowOTP] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");

  const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL;
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");

  useEffect(() => {
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
    }
  }, [errorParam]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      if (!email || !password) {
        setError("Email and password are required");
        setIsLoading(false);
        return;
      }

      const response = await axios.post(`${SERVER_URL}/login`, {
        email,
        password,
      });

      if (response.data.requires_otp) {
        setPendingEmail(email);
        setShowOTP(true);
        toast.info("OTP sent to your email");
      }
    } catch (err: unknown) {
      const error = err as ApiError;
      setError(
        error.response?.data?.error || "Login failed. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfileImage(file);
      // Create a preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    // Form validation
    if (!registerEmail || !registerPassword || !name) {
      setError("All fields are required");
      setIsLoading(false);
      return;
    }

    if (registerPassword !== confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("email", registerEmail);
      formData.append("username", name);
      formData.append("password", registerPassword);

      if (profileImage) {
        formData.append("profile_image", profileImage);
      }

      const response = await axios.post(`${SERVER_URL}/register`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (response.data.requires_otp) {
        setPendingEmail(registerEmail);
        setShowOTP(true);
        toast.info("OTP sent to your email");
      }
    } catch (err: unknown) {
      const error = err as ApiError;
      const errorMessage =
        error.response?.data?.error || "Registration failed. Please try again.";
      setError(errorMessage);
      toast.error("Registration failed", {
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      window.location.href = `${SERVER_URL}/google/login`;
    } catch (error) {
      console.error("Error logging in:", error);
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* Background with parallax effect */}
      <div
        className="absolute inset-0 w-full h-full"
        style={{
          transform: `translateY(${scrollY * 0.5}px)`,
          willChange: "transform",
        }}
      >
        <img
          src="/parkinglot.jpeg"
          className="absolute inset-0 w-full h-full object-cover"
          alt="Parking Lot Background"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/60" />
      </div>
      {/* Content */}
      {currentUser && (
        <div className="text-white/80 text-sm">
          Logged in as {currentUser.username}
        </div>
      )}
      <MaxWidthWrapper classname="relative h-full flex items-center justify-center">
        {showOTP ? (
          <OTPVerification
            email={pendingEmail}
            onBack={() => {
              setShowOTP(false);
              setPendingEmail("");
            }}
            isRegistration={!isLogin}
          />
        ) : (
          <div className="w-full max-w-sm">
            {/* Login Card */}
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 shadow-xl border border-white/20 relative">
              {/* Error message */}
              {error && (
                <Alert
                  variant="destructive"
                  className="mb-4 bg-red-500/10 text-red-500 border border-red-500/20"
                >
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Success message */}
              {success && (
                <Alert
                  variant="default"
                  className="mb-4 bg-green-500/10 text-green-500 border border-green-500/20"
                >
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}

              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-white">
                  Ko<span className="text-yellow-500">Tsek</span>
                </h1>
                <p className="text-white/80 mt-1 text-sm">
                  Welcome back! Please login to continue.
                </p>
              </div>

              {/* Tab Switcher */}
              <div className="relative mb-6 flex bg-black/20 rounded-lg p-1">
                <div
                  className="absolute inset-y-1 w-1/2 bg-yellow-500 rounded-md transition-transform duration-200"
                  style={{
                    transform: `translateX(${isLogin ? "0%" : "100%"})`,
                  }}
                />
                <button
                  onClick={() => setIsLogin(true)}
                  className={`flex-1 text-sm font-medium py-1 text-center relative z-10 transition-colors duration-200 ${
                    isLogin ? "text-white" : "text-white/60"
                  }`}
                >
                  Login
                </button>
                <button
                  onClick={() => setIsLogin(false)}
                  className={`flex-1 text-sm font-medium py-1 text-center relative z-10 transition-colors duration-200 ${
                    !isLogin ? "text-white" : "text-white/60"
                  }`}
                >
                  Register
                </button>
              </div>

              {/* Forms Container */}
              <div
                className="relative overflow-hidden"
                style={{ height: isLogin ? "400px" : "460px" }}
              >
                <div
                  className="absolute w-full transition-transform duration-300 ease-in-out"
                  style={{
                    transform: `translateX(${isLogin ? "0%" : "-100%"})`,
                  }}
                >
                  {/* Login Form */}
                  <form className="space-y-4" onSubmit={handleLogin}>
                    <div>
                      <label
                        htmlFor="email"
                        className="block text-sm font-medium text-white/90 mb-1"
                      >
                        Email Address
                      </label>
                      <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all"
                        placeholder="Enter your email"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="password"
                        className="block text-sm font-medium text-white/90 mb-1"
                      >
                        Password
                      </label>
                      <input
                        type="password"
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all"
                        placeholder="Enter your password"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        className="text-xs text-yellow-500 hover:text-yellow-400 transition-all"
                      >
                        Forgot password?
                      </button>
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-yellow-500 text-white py-2 px-4 rounded-lg font-medium hover:bg-yellow-400 transition-all duration-200 text-sm disabled:opacity-50"
                      disabled={isLoading}
                    >
                      {isLoading ? "Signing in..." : "Sign In"}
                    </button>

                    <div className="relative my-4">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-white/20"></div>
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="px-2 text-white/60 bg-black/20 backdrop-blur-lg">
                          Or continue with
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="w-full bg-white/10 border border-white/20 text-white py-2 px-4 rounded-lg font-medium hover:bg-white/20 transition-all duration-200 flex items-center justify-center gap-2 text-sm"
                      onClick={handleGoogleLogin}
                      disabled={!isLogin || isLoading}
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="currentColor"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      Continue with Google
                    </button>
                  </form>
                </div>

                {/* Register Form */}
                <div
                  className="absolute w-full transition-transform duration-300 ease-in-out"
                  style={{
                    transform: `translateX(${isLogin ? "100%" : "0%"})`,
                    height: isLogin ? "0" : "460px",
                    overflow: isLogin ? "hidden" : "auto",
                  }}
                >
                  <form className="space-y-4" onSubmit={handleRegister}>
                    <div>
                      <label
                        htmlFor="name"
                        className="block text-sm font-medium text-white/90 mb-1"
                      >
                        Username
                      </label>
                      <input
                        type="text"
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all"
                        placeholder="Enter your username"
                      />
                    </div>
                    <div className="mb-4 text-center overflow-hidden">
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                      <div
                        className="w-24 h-24 mx-auto rounded-full border border-white/30 flex items-center justify-center overflow-hidden cursor-pointer bg-white/10"
                        onClick={handleImageClick}
                      >
                        {imagePreview ? (
                          <img
                            src={imagePreview}
                            alt="Profile Preview"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xs text-white/60">
                            Upload Image
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="register-email"
                        className="block text-sm font-medium text-white/90 mb-1"
                      >
                        Email Address
                      </label>
                      <input
                        type="email"
                        id="register-email"
                        value={registerEmail}
                        onChange={(e) => setRegisterEmail(e.target.value)}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all"
                        placeholder="Enter your email"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="register-password"
                        className="block text-sm font-medium text-white/90 mb-1"
                      >
                        Password
                      </label>
                      <input
                        type="password"
                        id="register-password"
                        value={registerPassword}
                        onChange={(e) => setRegisterPassword(e.target.value)}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all"
                        placeholder="Create a password"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="confirm-password"
                        className="block text-sm font-medium text-white/90 mb-1"
                      >
                        Confirm Password
                      </label>
                      <input
                        type="password"
                        id="confirm-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all"
                        placeholder="Confirm your password"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-yellow-500 text-white py-2 px-4 rounded-lg font-medium hover:bg-yellow-400 transition-all duration-200 text-sm disabled:opacity-50"
                      disabled={isLoading}
                    >
                      {isLoading ? "Creating Account..." : "Create Account"}
                    </button>

                    <div className="relative my-4">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-white/20"></div>
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="px-2 text-white/60 bg-black/20 backdrop-blur-lg">
                          Or continue with
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="w-full bg-white/10 border border-white/20 text-white py-2 px-4 rounded-lg font-medium hover:bg-white/20 transition-all duration-200 flex items-center justify-center gap-2 text-sm"
                      disabled={isLoading}
                      onClick={handleGoogleLogin}
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="currentColor"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      Sign up with Google
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}
      </MaxWidthWrapper>
    </div>
  );
}