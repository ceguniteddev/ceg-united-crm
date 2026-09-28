"use client";

import React from "react";

interface ScoreRingProps {
  score: number;
}

export function ScoreRing({ score }: ScoreRingProps) {
  let levelColor = "#3b82f6";
  if (score >= 70) {
    levelColor = "#ef4444"; // critical red
  } else if (score >= 40) {
    levelColor = "#f59e0b"; // warn amber
  }

  return (
    <div
      className="pc-score"
      style={
        {
          "--p": score,
          "--lvl": levelColor,
          background: `conic-gradient(${levelColor} ${score}%, rgba(255, 255, 255, 0.07) 0)`,
        } as React.CSSProperties
      }
    >
      <span>{score}</span>
    </div>
  );
}
