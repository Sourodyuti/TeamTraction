"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export interface ScrollRevealProps {
  children: ReactNode;
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
  delay?: number;
  direction?: "up" | "down" | "left" | "right" | "scale";
  className?: string;
  style?: React.CSSProperties;
  onReveal?: () => void;
}

export function ScrollReveal({
  children,
  threshold = 0.1,
  rootMargin = "0px",
  triggerOnce = true,
  delay = 0,
  direction = "up",
  className = "",
  style,
  onReveal,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [hasTriggered, setHasTriggered] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (delay > 0) {
            setTimeout(() => {
              setIsVisible(true);
              if (!hasTriggered) {
                setHasTriggered(true);
                onReveal?.();
              }
            }, delay);
          } else {
            setIsVisible(true);
            if (!hasTriggered) {
              setHasTriggered(true);
              onReveal?.();
            }
          }
          if (triggerOnce) {
            observer.unobserve(element);
          }
        } else if (!triggerOnce) {
          setIsVisible(false);
          setHasTriggered(false);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold, rootMargin, triggerOnce, delay, hasTriggered, onReveal]);

  const directionStyles: Record<string, React.CSSProperties> = {
    up: { transform: "translateY(40px)", opacity: 0 },
    down: { transform: "translateY(-40px)", opacity: 0 },
    left: { transform: "translateX(-40px)", opacity: 0 },
    right: { transform: "translateX(40px)", opacity: 0 },
    scale: { transform: "scale(0.8)", opacity: 0 },
  };

  const visibleStyles: React.CSSProperties = {
    transform: "translate(0) scale(1)",
    opacity: 1,
    transition: "all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
  };

  const hiddenStyles = directionStyles[direction] || directionStyles.up;

  return (
    <div
      ref={ref}
      className={className}
      style={{
        ...hiddenStyles,
        ...(isVisible ? visibleStyles : {}),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* Stagger container for multiple children */
export interface StaggerContainerProps {
  children: ReactNode;
  staggerDelay?: number;
  className?: string;
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
  delay?: number;
  direction?: "up" | "down" | "left" | "right" | "scale";
  style?: React.CSSProperties;
  onReveal?: () => void;
}

export function StaggerContainer({
  children,
  staggerDelay = 100,
  className = "",
  ...props
}: StaggerContainerProps) {
  const childArray = Array.isArray(children) ? children : [children];

  return (
    <ScrollReveal {...props} className={className}>
      {childArray.map((child, index) => (
        <StaggerItem key={index} delay={index * staggerDelay}>
          {child}
        </StaggerItem>
      ))}
    </ScrollReveal>
  );
}

function StaggerItem({ children, delay }: { children: ReactNode; delay: number }) {
  return <ScrollReveal delay={delay}>{children}</ScrollReveal>;
}