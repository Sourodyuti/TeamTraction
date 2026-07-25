"use client";

import { Hero } from "@/components/landing/Hero";
import { ProblemSolution } from "@/components/landing/ProblemSolution";
import { Architecture } from "@/components/landing/Architecture";
import { Spells } from "@/components/landing/Spells";
import { LiveDemo } from "@/components/landing/LiveDemo";
import { Team } from "@/components/landing/Team";
import { Sponsors } from "@/components/landing/Sponsors";
import { Footer } from "@/components/landing/Footer";
import { CustomCursor } from "@/components/landing/CustomCursor";

export default function LandingPageClient() {
  return (
    <>
      <Hero />
      <ProblemSolution />
      <Architecture />
      <Spells />
      <LiveDemo />
      <Team />
      <Sponsors />
      <Footer />
      <CustomCursor />
    </>
  );
}