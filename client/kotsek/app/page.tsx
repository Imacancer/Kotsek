"use client";

import MaxWidthWrapper from "@/components/MaxWidthWrapper";
import { useRef, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [scrollY, setScrollY] = useState(0);

  // Refs for sections
  const firstSectionRef = useRef<HTMLDivElement>(null);
  const secondSectionRef = useRef<HTMLDivElement>(null);
  const thirdSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Auth token handling
  useEffect(() => {
    const token = searchParams.get("token");
    const provider = searchParams.get("authProvider");

    if (token && provider) {
      sessionStorage.setItem("jwtToken", token);
      sessionStorage.setItem("authProvider", provider);
    }
  }, [searchParams, router]);

  // Smooth scroll implementation
  const scrollToSection = (ref: React.RefObject<HTMLDivElement>) => {
    ref.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <div className="relative">
      {/* First Section - Parking Lot */}
      <section
        ref={firstSectionRef}
        className="relative h-screen w-full overflow-hidden"
        style={{
          perspective: "1px",
          perspectiveOrigin: "center center",
        }}
      >
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
            alt="Parking Lot"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/60" />
        </div>

        <MaxWidthWrapper classname="relative h-full flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white max-w-4xl mx-auto mb-8">
              Automated Parking System{" "}
              <span className="inline-block bg-yellow-500 px-4 py-2 mt-4">
                To Make People Lives Easier
              </span>
            </h1>
            <button
              onClick={() => scrollToSection(secondSectionRef)}
              className="mx-auto mt-8 block bg-white/20 backdrop-blur-sm text-white px-6 py-3 rounded-full hover:bg-white/30 transition-all duration-700"
            >
              Discover More
            </button>
          </div>
        </MaxWidthWrapper>
      </section>

      {/* Second Section - Modern Building */}
      <section
        ref={secondSectionRef}
        className="relative h-screen w-full overflow-hidden"
        style={{
          perspective: "1px",
          perspectiveOrigin: "center center",
        }}
      >
        <div
          className="absolute inset-0 w-full h-full"
          style={{
            transform: `translateY(${(scrollY - window.innerHeight) * 0.3}px)`,
            willChange: "transform",
          }}
        >
          <img
            src="/bmw.jpg"
            className="absolute inset-0 w-full h-full object-cover"
            alt="Modern Building"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-black/70" />
        </div>

        <MaxWidthWrapper classname="relative h-full flex items-center justify-center">
          <div className="grid md:grid-cols-3 gap-8 px-4">
            {[
              {
                title: "Smart Detection",
                description:
                  "AI-powered vehicle detection and space allocation",
              },
              {
                title: "Real-time Monitoring",
                description: "Track parking space availability instantly",
              },
              {
                title: "Cost Effective",
                description:
                  "Reduce Costs by reducing equipments like Parking Sensors",
              },
            ].map((feature, index) => (
              <div
                key={index}
                className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 transform hover:scale-105 transition-all duration-700"
              >
                <h3 className="text-2xl font-bold text-white mb-4">
                  {feature.title}
                </h3>
                <p className="text-white/80">{feature.description}</p>
              </div>
            ))}
          </div>
        </MaxWidthWrapper>
      </section>

      <section
        ref={thirdSectionRef}
        className="relative h-screen w-full overflow-hidden"
        style={{
          perspective: "1px",
          perspectiveOrigin: "center center",
        }}
      >
        <div
          className="absolute inset-0 w-full h-full"
          style={{
            transform: `translateY(${
              (scrollY - window.innerHeight * 2) * 0.4
            }px)`,
            willChange: "transform",
          }}
        >
          <img
            src="/lamburat.jpg"
            className="absolute inset-0 w-full h-full object-cover"
            alt="Smart City"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-black/30" />
        </div>

        <MaxWidthWrapper classname="relative h-full flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-8">
              The Future of Urban Parking
            </h2>
            <p className="text-xl text-white/90 max-w-2xl mx-auto mb-12">
              Join us in revolutionizing the way cities handle parking
              management
            </p>
            <button className="bg-yellow-500 text-white px-8 py-4 rounded-full font-semibold shadow-lg hover:bg-yellow-400 transition-all duration-700">
              Get Started Now
            </button>
          </div>
        </MaxWidthWrapper>
      </section>

      {/* Navigation Dots */}
      <div className="fixed right-8 top-1/2 transform -translate-y-1/2 z-50 flex flex-col gap-4">
        {[firstSectionRef, secondSectionRef, thirdSectionRef].map(
          (ref, index) => (
            <button
              key={index}
              onClick={() => scrollToSection(ref)}
              className="w-3 h-3 rounded-full bg-white/50 hover:bg-white transition-all duration-700"
              aria-label={`Navigate to section ${index + 1}`}
            />
          )
        )}
      </div>
    </div>
  );
}
