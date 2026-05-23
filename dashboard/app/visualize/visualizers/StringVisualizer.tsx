"use client";

import React from "react";
import { Stage, Layer, Rect, Text, Group, Arrow } from "react-konva";

interface StringVisualizerProps {
  state: any;
  width: number;
  height: number;
}

export default function StringVisualizer({ state, width, height }: StringVisualizerProps) {
  const isCompare = state?.s1 !== undefined && state?.s2 !== undefined;

  // Colors
  const BG_SURFACE = "#393E46";
  const ACCENT = "#00ADB5";
  const TEXT_PRIMARY = "#EEEEEE";
  const NODE_DEFAULT = "#393E46";
  const NODE_ACTIVE = "#00ADB5";
  const NODE_COMPARE = "#FFB74D";
  const NODE_DONE = "rgba(0,173,181,0.6)";

  if (isCompare) {
    // Comparing two strings
    const s1: string = state.s1;
    const s2: string = state.s2;
    const cellWidth = 40;
    const gap = 8;
    const activeI = state.i;
    const activeJ = state.j;

    const startX1 = Math.max(50, (width - s1.length * (cellWidth + gap)) / 2);
    const startX2 = Math.max(50, (width - s2.length * (cellWidth + gap)) / 2);

    return (
      <Stage width={width} height={height}>
        <Layer>
          {/* Row 1 (String 1) */}
          <Text
            x={20}
            y={height * 0.25 + 12}
            text="s1:"
            fontSize={12}
            fontFamily="Sora"
            fill="rgba(238, 238, 238, 0.45)"
          />
          {s1.split("").map((char, idx) => {
            const x = startX1 + idx * (cellWidth + gap);
            const y = height * 0.25;
            const isActive = activeI === idx;

            return (
              <Group key={`s1-${idx}`}>
                <Rect
                  x={x}
                  y={y}
                  width={cellWidth}
                  height={cellWidth}
                  fill={isActive ? "rgba(0, 173, 181, 0.25)" : NODE_DEFAULT}
                  stroke={isActive ? "#FFB74D" : ACCENT}
                  strokeWidth={1.5}
                  cornerRadius={4}
                />
                <Text
                  x={x}
                  y={y + 13}
                  width={cellWidth}
                  text={char}
                  align="center"
                  fontSize={14}
                  fontFamily="JetBrains Mono"
                  fill={TEXT_PRIMARY}
                  fontStyle="bold"
                />
                <Text
                  x={x}
                  y={y + cellWidth + 5}
                  width={cellWidth}
                  text={String(idx)}
                  align="center"
                  fontSize={9}
                  fontFamily="JetBrains Mono"
                  fill="rgba(238, 238, 238, 0.3)"
                />
              </Group>
            );
          })}

          {/* Row 2 (String 2) */}
          <Text
            x={20}
            y={height * 0.55 + 12}
            text="s2:"
            fontSize={12}
            fontFamily="Sora"
            fill="rgba(238, 238, 238, 0.45)"
          />
          {s2.split("").map((char, idx) => {
            const x = startX2 + idx * (cellWidth + gap);
            const y = height * 0.55;
            const isActive = activeJ === idx;

            return (
              <Group key={`s2-${idx}`}>
                <Rect
                  x={x}
                  y={y}
                  width={cellWidth}
                  height={cellWidth}
                  fill={isActive ? "rgba(0, 173, 181, 0.25)" : NODE_DEFAULT}
                  stroke={isActive ? "#FFB74D" : ACCENT}
                  strokeWidth={1.5}
                  cornerRadius={4}
                />
                <Text
                  x={x}
                  y={y + 13}
                  width={cellWidth}
                  text={char}
                  align="center"
                  fontSize={14}
                  fontFamily="JetBrains Mono"
                  fill={TEXT_PRIMARY}
                  fontStyle="bold"
                />
                <Text
                  x={x}
                  y={y + cellWidth + 5}
                  width={cellWidth}
                  text={String(idx)}
                  align="center"
                  fontSize={9}
                  fontFamily="JetBrains Mono"
                  fill="rgba(238, 238, 238, 0.3)"
                />
              </Group>
            );
          })}
        </Layer>
      </Stage>
    );
  } else {
    // Palindrome check or single string
    const s: string = state?.s || "";
    const cellWidth = 44;
    const gap = 10;
    const totalWidth = s.length * (cellWidth + gap) - gap;
    const startX = Math.max(40, (width - totalWidth) / 2);
    const startY = height / 2 - 22;

    const leftPtr = state?.left;
    const rightPtr = state?.right;

    return (
      <Stage width={width} height={height}>
        <Layer>
          {s.split("").map((char, idx) => {
            const x = startX + idx * (cellWidth + gap);
            const y = startY;

            const isCurrent = state.comparing?.includes(idx);
            let strokeColor = ACCENT;
            let fillColor = NODE_DEFAULT;

            if (isCurrent) {
              if (state.status === "mismatch") {
                strokeColor = "#FF6B6B";
                fillColor = "rgba(255, 107, 107, 0.15)";
              } else if (state.status === "match") {
                strokeColor = "#00ADB5";
                fillColor = "rgba(0, 173, 181, 0.25)";
              } else {
                strokeColor = "#FFB74D";
                fillColor = "rgba(255, 183, 77, 0.15)";
              }
            } else if (state.status === "success") {
              strokeColor = ACCENT;
              fillColor = "rgba(0, 173, 181, 0.35)";
            }

            return (
              <Group key={idx}>
                <Rect
                  x={x}
                  y={y}
                  width={cellWidth}
                  height={cellWidth}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={1.5}
                  cornerRadius={6}
                />
                
                <Text
                  x={x}
                  y={y + 15}
                  width={cellWidth}
                  text={char}
                  align="center"
                  fontSize={14}
                  fontFamily="JetBrains Mono"
                  fill={TEXT_PRIMARY}
                  fontStyle="bold"
                />

                <Text
                  x={x}
                  y={y + cellWidth + 8}
                  width={cellWidth}
                  text={String(idx)}
                  align="center"
                  fontSize={10}
                  fontFamily="JetBrains Mono"
                  fill="rgba(238, 238, 238, 0.35)"
                />

                {/* Left Pointer label */}
                {leftPtr === idx && (
                  <Text
                    x={x}
                    y={y - 20}
                    width={cellWidth}
                    text="L"
                    align="center"
                    fontSize={11}
                    fontFamily="JetBrains Mono"
                    fill={ACCENT}
                    fontStyle="bold"
                  />
                )}

                {/* Right Pointer label */}
                {rightPtr === idx && (
                  <Text
                    x={x}
                    y={y - 20}
                    width={cellWidth}
                    text="R"
                    align="center"
                    fontSize={11}
                    fontFamily="JetBrains Mono"
                    fill="#FF6B6B"
                    fontStyle="bold"
                  />
                )}
              </Group>
            );
          })}

          {/* If comparing, draw connection arrow between Left and Right pointers */}
          {leftPtr !== undefined && rightPtr !== undefined && leftPtr < rightPtr && (
            <Arrow
              points={[
                startX + leftPtr * (cellWidth + gap) + cellWidth / 2,
                startY - 30,
                startX + rightPtr * (cellWidth + gap) + cellWidth / 2,
                startY - 30
              ]}
              pointerLength={6}
              pointerWidth={6}
              fill="#FFB74D"
              stroke="#FFB74D"
              strokeWidth={1.5}
            />
          )}
        </Layer>
      </Stage>
    );
  }
}
