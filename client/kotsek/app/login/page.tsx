import LoginComponent from "@/components/LoginComponent";
import { Suspense } from "react";
import LoginFallback from "@/components/LoginFallback";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginComponent />
    </Suspense>
  );
}
