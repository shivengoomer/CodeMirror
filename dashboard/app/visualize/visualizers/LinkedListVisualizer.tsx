"use client";

import React from "react";
import { Stage, Layer, Rect, Text, Arrow, Group, Line } from "react-konva";

interface LinkedListVisualizerProps {
  state: any;
  width: number;
  height: number;
}

export default function LinkedListVisualizer({ state, width, height }: LinkedListVisualizerProps) {
  const list: string[] = state?.list || [];
  const activeIndex = state?.activeIndex;
  
  const nodeWidth = 90;
  const valWidth = 60;
  const ptrWidth = 30;
  const nodeHeight = 40;
  const gap = 55;

  const totalWidth = list.length * (nodeWidth + gap) - gap;
  const startX = Math.max(40, (width - totalWidth) / 2);
  const startY = height / 2 - 20;

  // Colors
  const BG_SURFACE = "#393E46";
  const ACCENT = "#00ADB5";
  const TEXT_PRIMARY = "#EEEEEE";
  const NODE_DEFAULT = "#393E46";
  const NODE_ACTIVE = "#00ADB5";
  const NODE_COMPARE = "#FFB74D";
  const NODE_DONE = "rgba(0,173,181,0.6)";

  return (
    <Stage width={width} height={height}>
      <Layer>
        {list.map((val, idx) => {
          const x = startX + idx * (nodeWidth + gap);
          const y = startY;

          const isActive = activeIndex === idx;

          return (
            <Group key={idx}>
              {/* Value Compartment */}
              <Rect
                x={x}
                y={y}
                width={valWidth}
                height={nodeHeight}
                fill={isActive ? "rgba(0, 173, 181, 0.25)" : NODE_DEFAULT}
                stroke={isActive ? "#FFB74D" : ACCENT}
                strokeWidth={1.5}
                cornerRadius={[6, 0, 0, 6]}
              />
              
              <Text
                x={x}
                y={y + 14}
                width={valWidth}
                text={val}
                align="center"
                fontSize={12}
                fontFamily="JetBrains Mono"
                fill={TEXT_PRIMARY}
                fontStyle="bold"
              />

              {/* Next Pointer Compartment */}
              <Rect
                x={x + valWidth}
                y={y}
                width={ptrWidth}
                height={nodeHeight}
                fill="rgba(238, 238, 238, 0.05)"
                stroke={isActive ? "#FFB74D" : ACCENT}
                strokeWidth={1.5}
                cornerRadius={[0, 6, 6, 0]}
              />

              {/* Pointer Center Dot */}
              <Rect
                x={x + valWidth + ptrWidth / 2 - 3}
                y={y + nodeHeight / 2 - 3}
                width={6}
                height={6}
                fill={ACCENT}
                cornerRadius={3}
              />

              {/* Arrow pointer link to next node */}
              {idx < list.length - 1 ? (
                <Arrow
                  points={[
                    x + valWidth + ptrWidth / 2,
                    y + nodeHeight / 2,
                    x + nodeWidth + gap - 4,
                    y + nodeHeight / 2
                  ]}
                  pointerLength={6}
                  pointerWidth={6}
                  fill={ACCENT}
                  stroke={ACCENT}
                  strokeWidth={1.5}
                />
              ) : (
                // Draw NULL/Slash pointer at the end of list
                <Group>
                  <Text
                    x={x + valWidth}
                    y={y + nodeHeight + 8}
                    width={ptrWidth}
                    text="Ø"
                    align="center"
                    fontSize={14}
                    fontFamily="JetBrains Mono"
                    fill="rgba(238, 238, 238, 0.3)"
                  />
                </Group>
              )}

              {/* HEAD & TAIL pointer badges */}
              {idx === 0 && (
                <Text
                  x={x}
                  y={y - 20}
                  width={nodeWidth}
                  text="HEAD"
                  align="center"
                  fontSize={10}
                  fontFamily="Sora"
                  fill={ACCENT}
                  fontStyle="bold"
                />
              )}

              {idx === list.length - 1 && (
                <Text
                  x={x}
                  y={y - 20}
                  width={nodeWidth}
                  text="TAIL"
                  align="center"
                  fontSize={10}
                  fontFamily="Sora"
                  fill="#FF6B6B"
                  fontStyle="bold"
                />
              )}
            </Group>
          );
        })}
      </Layer>
    </Stage>
  );
}
