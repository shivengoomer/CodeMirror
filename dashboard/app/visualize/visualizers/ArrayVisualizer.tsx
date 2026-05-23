"use client";

import React from "react";
import { Stage, Layer, Rect, Text, Line, Group } from "react-konva";

interface ArrayVisualizerProps {
  state: any; // from TraceStep.state
  width: number;
  height: number;
}

export default function ArrayVisualizer({ state, width, height }: ArrayVisualizerProps) {
  if (!state || !state.array) return null;

  const array: number[] = state.array;
  const size = array.length;
  if (size === 0) return null;

  // Layout parameters
  const padding = 40;
  const availWidth = width - padding * 2;
  const barGap = 12;
  const totalGapsWidth = barGap * (size - 1);
  const barWidth = Math.max(25, Math.min(80, (availWidth - totalGapsWidth) / size));
  const startX = padding + (availWidth - (barWidth * size + barGap * (size - 1))) / 2;

  // Determine if it's sorting (bars with heights) or searching/pointers (fixed heights)
  const isSorting = state.i !== undefined || state.comparing?.length > 0;
  const maxVal = Math.max(...array, 1);
  const maxBarHeight = height * 0.45;
  const baseLineY = height * 0.7;

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
        {/* Draw base line */}
        <Line
          points={[padding, baseLineY, width - padding, baseLineY]}
          stroke="rgba(0, 173, 181, 0.18)"
          strokeWidth={2}
        />

        {array.map((val, idx) => {
          // Compute bar dimensions
          const barHeight = isSorting
            ? (val / maxVal) * maxBarHeight
            : 50; // uniform height for search/two-pointers
          
          const x = startX + idx * (barWidth + barGap);
          const y = baseLineY - barHeight;

          // Compute state colors
          let fillColor = NODE_DEFAULT;
          let strokeColor = "rgba(0, 173, 181, 0.18)";
          let strokeWidth = 1;

          if (state.comparing?.includes(idx)) {
            fillColor = NODE_COMPARE;
            strokeColor = "#FFB74D";
          } else if (state.sorted?.includes(idx)) {
            fillColor = NODE_DONE;
          } else if (state.mid === idx) {
            fillColor = NODE_COMPARE;
            strokeColor = "#FFB74D";
            strokeWidth = 2;
          } else if (state.status === "found" && state.mid === idx) {
            fillColor = ACCENT;
            strokeColor = "#FFFFFF";
          } else if (
            state.status === "left-eliminated" &&
            idx < state.low
          ) {
            fillColor = "rgba(57, 62, 70, 0.25)"; // faded out
          } else if (
            state.status === "right-eliminated" &&
            idx > state.high
          ) {
            fillColor = "rgba(57, 62, 70, 0.25)"; // faded out
          }

          // In Binary Search: highlight active search space [low, high]
          const isInSearchRange =
            state.low !== undefined &&
            state.high !== undefined &&
            idx >= state.low &&
            idx <= state.high;

          if (state.low !== undefined && !isInSearchRange) {
            fillColor = "rgba(57, 62, 70, 0.2)"; // Muted/eliminated
          }

          // Draw bar/rect
          return (
            <Group key={idx}>
              <Rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                cornerRadius={6}
              />

              {/* Value Text */}
              <Text
                x={x}
                y={y - 20}
                width={barWidth}
                text={String(val)}
                align="center"
                fontSize={13}
                fontFamily="JetBrains Mono"
                fill={TEXT_PRIMARY}
              />

              {/* Index Number */}
              <Text
                x={x}
                y={baseLineY + 10}
                width={barWidth}
                text={String(idx)}
                align="center"
                fontSize={11}
                fontFamily="JetBrains Mono"
                fill="rgba(238, 238, 238, 0.45)"
              />

              {/* Pointer Triangles & Labels */}
              {state.low === idx && (
                <Group>
                  <Text
                    x={x}
                    y={baseLineY + 30}
                    width={barWidth}
                    text="L"
                    align="center"
                    fontSize={12}
                    fontFamily="JetBrains Mono"
                    fill={ACCENT}
                    fontStyle="bold"
                  />
                </Group>
              )}

              {state.high === idx && (
                <Group>
                  <Text
                    x={x}
                    y={baseLineY + 45}
                    width={barWidth}
                    text="H"
                    align="center"
                    fontSize={12}
                    fontFamily="JetBrains Mono"
                    fill="#FF6B6B"
                    fontStyle="bold"
                  />
                </Group>
              )}

              {state.mid === idx && (
                <Group>
                  <Text
                    x={x}
                    y={y - 38}
                    width={barWidth}
                    text="MID"
                    align="center"
                    fontSize={11}
                    fontFamily="Sora"
                    fill="#FFB74D"
                    fontStyle="bold"
                  />
                </Group>
              )}

              {state.j === idx && (
                <Group>
                  <Text
                    x={x}
                    y={y - 38}
                    width={barWidth}
                    text="j"
                    align="center"
                    fontSize={12}
                    fontFamily="JetBrains Mono"
                    fill={ACCENT}
                  />
                </Group>
              )}
            </Group>
          );
        })}
      </Layer>
    </Stage>
  );
}
