"use client";

import React from "react";
import { Stage, Layer, Rect, Text, Group } from "react-konva";

interface DPTableVisualizerProps {
  state: any;
  width: number;
  height: number;
}

export default function DPTableVisualizer({ state, width, height }: DPTableVisualizerProps) {
  const dp: number[][] = state?.dp || [];
  if (dp.length === 0) return null;

  const rows = dp.length;
  const cols = dp[0].length;

  const weights = state?.weights || [];
  const values = state?.values || [];
  const capacity = state?.capacity || 0;

  const activeCell = state?.activeCell;
  const traceback: { r: number; c: number }[] = state?.traceback || [];

  // Table sizing
  const maxCellSize = 42;
  const tableWidth = cols * maxCellSize;
  const tableHeight = rows * maxCellSize;

  const startX = Math.max(50, (width - tableWidth) / 2);
  const startY = Math.max(60, (height - tableHeight) / 2 - 20);

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
        {/* Draw active formula label on top */}
        {state.formula && (
          <Text
            x={startX}
            y={startY - 35}
            text={state.formula}
            fontSize={12}
            fontFamily="JetBrains Mono"
            fill={ACCENT}
            fontStyle="bold"
          />
        )}

        {/* Draw the grid */}
        {dp.map((row, rIdx) => {
          return (
            <Group key={`row-${rIdx}`}>
              {/* Row Label (Items) */}
              <Text
                x={startX - 45}
                y={startY + rIdx * maxCellSize + (maxCellSize / 2 - 5)}
                text={rIdx === 0 ? "Empty" : `i=${rIdx} (w=${weights[rIdx - 1]})`}
                fontSize={10}
                fontFamily="Sora"
                fill="rgba(238, 238, 238, 0.45)"
              />

              {row.map((val, cIdx) => {
                const x = startX + cIdx * maxCellSize;
                const y = startY + rIdx * maxCellSize;

                const isActive = activeCell?.r === rIdx && activeCell?.c === cIdx;
                const isTraceback = traceback.some(t => t.r === rIdx && t.c === cIdx);
                const isLookedUp =
                  activeCell &&
                  rIdx === activeCell.r - 1 &&
                  (cIdx === activeCell.c || cIdx === activeCell.c - weights[activeCell.r - 1]);

                let fillColor = "rgba(57, 62, 70, 0.15)";
                let strokeColor = "rgba(0, 173, 181, 0.12)";
                let strokeWidth = 1;
                let textColor = "rgba(238, 238, 238, 0.3)";

                if (isActive) {
                  fillColor = ACCENT;
                  strokeColor = "#FFFFFF";
                  strokeWidth = 1.5;
                  textColor = "#FFFFFF";
                } else if (isTraceback) {
                  fillColor = "#FFB74D";
                  strokeColor = "#FFB74D";
                  textColor = "#222831";
                } else if (isLookedUp) {
                  fillColor = "rgba(0, 173, 181, 0.25)";
                  strokeColor = ACCENT;
                  textColor = TEXT_PRIMARY;
                } else if (rIdx < state.currentI || (rIdx === state.currentI && cIdx <= state.currentW)) {
                  fillColor = NODE_DEFAULT;
                  textColor = TEXT_PRIMARY;
                }

                return (
                  <Group key={`cell-${rIdx}-${cIdx}`}>
                    <Rect
                      x={x}
                      y={y}
                      width={maxCellSize}
                      height={maxCellSize}
                      fill={fillColor}
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                    />
                    
                    <Text
                      x={x}
                      y={y + (maxCellSize / 2 - 6)}
                      width={maxCellSize}
                      text={String(val)}
                      align="center"
                      fontSize={11}
                      fontFamily="JetBrains Mono"
                      fill={textColor}
                    />

                    {/* Column Weight Indices (rendered on top row only) */}
                    {rIdx === 0 && (
                      <Text
                        x={x}
                        y={startY - 18}
                        width={maxCellSize}
                        text={`w=${cIdx}`}
                        align="center"
                        fontSize={9}
                        fontFamily="JetBrains Mono"
                        fill="rgba(238, 238, 238, 0.45)"
                      />
                    )}
                  </Group>
                );
              })}
            </Group>
          );
        })}
      </Layer>
    </Stage>
  );
}
