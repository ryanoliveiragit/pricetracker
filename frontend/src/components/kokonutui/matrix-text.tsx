"use client";

/**
 * @author: @dorianbaffier
 * @description: Matrix Text
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

interface LetterState {
  char: string;
  isMatrix: boolean;
  isSpace: boolean;
}

interface MatrixTextProps {
  text?: string;
  className?: string;
  initialDelay?: number;
  letterAnimationDuration?: number;
  letterInterval?: number;
}

const MatrixText = ({
  text = "HelloWorld!",
  className,
  initialDelay = 200,
  letterAnimationDuration = 500,
  letterInterval = 100,
}: MatrixTextProps) => {
  const [letters, setLetters] = useState<LetterState[]>(() =>
    text.split("").map((char) => ({
      char,
      isMatrix: false,
      isSpace: char === " ",
    }))
  );
  const [isAnimating, setIsAnimating] = useState(false);

  const getRandomChar = useCallback(
    () => (Math.random() > 0.5 ? "1" : "0"),
    []
  );

  const animateLetter = useCallback(
    (index: number) => {
      if (index >= text.length) return;

      requestAnimationFrame(() => {
        setLetters((prev) => {
          const newLetters = [...prev];
          if (!newLetters[index].isSpace) {
            newLetters[index] = {
              ...newLetters[index],
              char: getRandomChar(),
              isMatrix: true,
            };
          }
          return newLetters;
        });

        setTimeout(() => {
          setLetters((prev) => {
            const newLetters = [...prev];
            newLetters[index] = {
              ...newLetters[index],
              char: text[index],
              isMatrix: false,
            };
            return newLetters;
          });
        }, letterAnimationDuration);
      });
    },
    [getRandomChar, text, letterAnimationDuration]
  );

  const startAnimation = useCallback(() => {
    if (isAnimating) return;

    setIsAnimating(true);
    let currentIndex = 0;

    const animate = () => {
      if (currentIndex >= text.length) {
        setIsAnimating(false);
        return;
      }

      animateLetter(currentIndex);
      currentIndex++;
      setTimeout(animate, letterInterval);
    };

    animate();
  }, [animateLetter, text, isAnimating, letterInterval]);

  useEffect(() => {
    const timer = setTimeout(startAnimation, initialDelay);
    return () => clearTimeout(timer);
  }, []);

  const motionVariants = useMemo(
    () => ({
      initial: {
        color: "currentColor",
        textShadow: "none",
      },
      matrix: {
        color: "#a78bfa",
        textShadow: "0 0 10px rgba(167, 139, 250, 0.45)",
      },
      normal: {
        color: "currentColor",
        textShadow: "none",
      },
    }),
    []
  );

  return (
    <span
      aria-label="Matrix text animation"
      className={cn(
        "inline-flex items-center gap-[1px] font-mono",
        className
      )}
    >
      {letters.map((letter, index) => (
        <motion.span
          animate={letter.isMatrix ? "matrix" : "normal"}
          className="inline-block w-[1ch] text-center"
          initial="initial"
          key={`${index}-${letter.char}-${index}`}
          style={{
            fontVariantNumeric: "tabular-nums",
          }}
          transition={{
            duration: 0.1,
            ease: "easeInOut",
          }}
          variants={motionVariants}
        >
          {letter.isSpace ? "\u00A0" : letter.char}
        </motion.span>
      ))}
    </span>
  );
};

export default MatrixText;
