"use client";

import { useState, useEffect } from "react";
import MaxWidthWrapper from "@/components/MaxWidthWrapper";

export default function LoginPage() {
  const [scrollY, setScrollY] = useState(0);
  const [isLogin, setIsLogin] = useState(true);

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
      <MaxWidthWrapper classname="relative h-full flex items-center justify-center">
        <div className="w-full max-w-sm">
          {/* Login Card */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 shadow-xl border border-white/20 relative">
            <div className="text-center mb-6">
              {" "}
              {/* Reduced margin from mb-8 */}
              <h1 className="text-2xl font-bold text-white">
                {" "}
                {/* Reduced from text-3xl */}
                Ko<span className="text-yellow-500">Tsek</span>
              </h1>
              <p className="text-white/80 mt-1 text-sm">
                {" "}
                {/* Reduced text size */}
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
                <form className="space-y-4">
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
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all"
                      placeholder="Enter your password"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="remember"
                        className="h-3 w-3 rounded border-white/20 bg-white/10 text-yellow-500 focus:ring-yellow-500"
                      />
                      <label
                        htmlFor="remember"
                        className="ml-2 block text-xs text-white/90"
                      >
                        Remember me
                      </label>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-yellow-500 hover:text-yellow-400 transition-all"
                    >
                      Forgot password?
                    </button>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-yellow-500 text-white py-2 px-4 rounded-lg font-medium hover:bg-yellow-400 transition-all duration-200 text-sm"
                  >
                    Sign In
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
                }}
              >
                <form className="space-y-4">
                  <div>
                    <label
                      htmlFor="name"
                      className="block text-sm font-medium text-white/90 mb-1"
                    >
                      Full Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all"
                      placeholder="Enter your full name"
                    />
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
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all"
                      placeholder="Confirm your password"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-yellow-500 text-white py-2 px-4 rounded-lg font-medium hover:bg-yellow-400 transition-all duration-200 text-sm"
                  >
                    Create Account
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
      </MaxWidthWrapper>
    </div>
  );
}
