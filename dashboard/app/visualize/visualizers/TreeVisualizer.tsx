"use client";

import React, { useMemo } from "react";
import { Stage, Layer, Circle, Line, Text, Group } from "react-konva";
import { computeTreeLayout } from "./utils/treeLayout";

interface TreeVisualizerProps {
  state: any;
  width: number;
  height: number;
}

export default function TreeVisualizer({ state, width, height }: TreeVisualizerProps) {
  const tree = state?.tree;
  
  // Calculate nodes & edges layout
  const { nodes, edges } = useMemo(() => {
    return computeTreeLayout(tree, width, height);
  }, [tree, width, height]);

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
        {/* Draw Edges first so they sit behind nodes */}
        {edges.map((edge, idx) => {
          const isActive =
            state.traversalPath?.includes(edge.from) &&
            state.traversalPath?.includes(edge.to);
          
          return (
            <Group key={`edge-${idx}`}>
              <Line
                points={[edge.fromX, edge.fromY, edge.toX, edge.toY]}
                stroke={isActive ? ACCENT : "rgba(238, 238, 238, 0.2)"}
                strokeWidth={isActive ? 2.5 : 1.5}
                dash={edge.to.toString().startsWith("null-") ? [4, 4] : undefined}
              />
              
              {/* Draw L/R labels in midpoint */}
              {edge.label && !edge.to.toString().startsWith("null-") && (
                <Text
                  x={(edge.fromX + edge.toX) / 2 - 8}
                  y={(edge.fromY + edge.toY) / 2 - 8}
                  text={edge.label}
                  fontSize={10}
                  fontFamily="JetBrains Mono"
                  fill="rgba(238, 238, 238, 0.45)"
                  backgroundColor="#222831"
                  padding={2}
                />
              )}
            </Group>
          );
        })}

        {/* Draw Nodes */}
        {nodes.map((node) => {
          const isDummy = node.isDummy;
          const isActive = state.activeNodeId === node.id;
          const isInPath = state.traversalPath?.includes(node.id);

          let fillColor = NODE_DEFAULT;
          let strokeColor = "rgba(0, 173, 181, 0.18)";
          let strokeWidth = 1.5;

          if (isDummy) {
            fillColor = "rgba(34, 40, 49, 0.5)";
            strokeColor = "rgba(238, 238, 238, 0.15)";
          } else if (isActive) {
            fillColor = NODE_COMPARE;
            strokeColor = "#FFB74D";
            strokeWidth = 2.5;
          } else if (isInPath) {
            fillColor = NODE_ACTIVE;
            strokeColor = ACCENT;
          }

          return (
            <Group key={node.id}>
              {/* Node Circle */}
              <Circle
                x={node.x}
                y={node.y}
                radius={isDummy ? 12 : 22}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                dash={isDummy ? [3, 3] : undefined}
              />

              {/* Node Value Text */}
              <Text
                x={node.x - 20}
                y={node.y - (isDummy ? 5 : 7)}
                width={40}
                text={String(node.val)}
                align="center"
                fontSize={isDummy ? 9 : 13}
                fontFamily="JetBrains Mono"
                fill={isDummy ? "rgba(238,238,238,0.25)" : TEXT_PRIMARY}
              />
            </Group>
          );
        })}

        {/* Legend / Status Overlay in Bottom Left */}
        {state.currentVal !== undefined && state.currentVal !== null && (
          <Group x={20} y={height - 50}>
            <Text
              text={`Inserting Value: ${state.currentVal}`}
              fontSize={14}
              fontFamily="Sora"
              fill={ACCENT}
              fontStyle="bold"
            />
          </Group>
        )}
      </Layer>
    </Stage>
  );
}
