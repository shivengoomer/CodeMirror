"use client";

import React from "react";
import { Stage, Layer, Rect, Text, Group } from "react-konva";

interface StackQueueVisualizerProps {
  state: any;
  width: number;
  height: number;
}

export default function StackQueueVisualizer({ state, width, height }: StackQueueVisualizerProps) {
  const list: any[] = state?.list || [];
  const pointer = state?.pointer;
  const activeOp: string = state?.activeOp || "";

  // Check if stack or queue based on activeOp name
  const isQueue = activeOp.includes("ENQUEUE") || activeOp.includes("DEQUEUE");

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
        {/* Floating operation label */}
        {activeOp && (
          <Text
            x={20}
            y={20}
            text={`Operation: ${activeOp}`}
            fontSize={14}
            fontFamily="Sora"
            fill="#FFB74D"
            fontStyle="bold"
          />
        )}

        {isQueue ? (
          // Render Queue (Horizontal conveyor)
          <Group x={Math.max(50, (width - list.length * 75) / 2)} y={height / 2 - 30}>
            {list.map((val, idx) => {
              const x = idx * 75;
              const isFront = idx === 0;
              const isRear = idx === list.length - 1;

              return (
                <Group key={idx}>
                  <Rect
                    x={x}
                    y={0}
                    width={60}
                    height={60}
                    fill={NODE_DEFAULT}
                    stroke={ACCENT}
                    strokeWidth={1.5}
                    cornerRadius={8}
                  />
                  
                  <Text
                    x={x}
                    y={22}
                    width={60}
                    text={String(val)}
                    align="center"
                    fontSize={14}
                    fontFamily="JetBrains Mono"
                    fill={TEXT_PRIMARY}
                    fontStyle="bold"
                  />

                  {/* Pointers */}
                  {isFront && (
                    <Text
                      x={x}
                      y={-22}
                      width={60}
                      text="FRONT"
                      align="center"
                      fontSize={10}
                      fontFamily="Sora"
                      fill={ACCENT}
                      fontStyle="bold"
                    />
                  )}

                  {isRear && (
                    <Text
                      x={x}
                      y={72}
                      width={60}
                      text="REAR"
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
          </Group>
        ) : (
          // Render Stack (Vertical tower)
          <Group x={width / 2 - 40} y={height - 50}>
            {list.map((val, idx) => {
              // Draw blocks stacked upwards from base
              const h = 40;
              const y = - (idx + 1) * (h + 8);
              const isTop = idx === list.length - 1;

              return (
                <Group key={idx}>
                  <Rect
                    x={0}
                    y={y}
                    width={80}
                    height={h}
                    fill={isTop ? "rgba(0, 173, 181, 0.25)" : NODE_DEFAULT}
                    stroke={isTop ? "#FFB74D" : ACCENT}
                    strokeWidth={1.5}
                    cornerRadius={4}
                  />
                  
                  <Text
                    x={0}
                    y={y + 13}
                    width={80}
                    text={String(val)}
                    align="center"
                    fontSize={13}
                    fontFamily="JetBrains Mono"
                    fill={TEXT_PRIMARY}
                    fontStyle="bold"
                  />

                  {/* Top Pointer */}
                  {isTop && (
                    <Text
                      x={90}
                      y={y + 14}
                      text="◀ TOP"
                      fontSize={11}
                      fontFamily="Sora"
                      fill="#FFB74D"
                      fontStyle="bold"
                    />
                  )}
                </Group>
              );
            })}

            {/* Base platform */}
            <Rect
              x={-20}
              y={0}
              width={120}
              height={6}
              fill="rgba(0, 173, 181, 0.4)"
              cornerRadius={2}
            />
          </Group>
        )}
      </Layer>
    </Stage>
  );
}
