"use client";

import React, { useState, useEffect } from "react";
import { Stage, Layer, Circle, Line, Arrow, Text, Group, Rect } from "react-konva";
import { computeGraphLayout, GraphNodeData, GraphEdgeData } from "./utils/forceLayout";

interface GraphVisualizerProps {
  state: any;
  width: number;
  height: number;
}

export default function GraphVisualizer({ state, width, height }: GraphVisualizerProps) {
  const nodes: GraphNodeData[] = state?.nodes || [];
  const edges: GraphEdgeData[] = state?.edges || [];
  const queue: string[] = state?.queue || [];
  const visited: string[] = state?.visited || [];
  const activeNodeId = state?.activeNodeId;
  const checkingNeighbor = state?.checkingNeighbor;

  // Local state for dragging coordinates
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});

  // Compute force layout once when nodes/edges change or dimensions change
  useEffect(() => {
    if (nodes.length > 0) {
      const layout = computeGraphLayout(nodes, edges, width, height - 100);
      setNodePositions(layout);
    }
  }, [nodes, edges, width, height]);

  // Handle Drag Move on Nodes
  const handleDragMove = (nodeId: string, e: any) => {
    const stage = e.target.getStage();
    const x = e.target.x();
    const y = e.target.y();
    setNodePositions(prev => ({
      ...prev,
      [nodeId]: { x, y }
    }));
  };

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
        {/* Draw Edges */}
        {edges.map((edge, idx) => {
          const fromPos = nodePositions[edge.from];
          const toPos = nodePositions[edge.to];

          if (!fromPos || !toPos) return null;

          const isActive =
            (activeNodeId === edge.from && checkingNeighbor === edge.to) ||
            (activeNodeId === edge.to && checkingNeighbor === edge.from);

          // Midpoint calculation for weight labels
          const midX = (fromPos.x + toPos.x) / 2;
          const midY = (fromPos.y + toPos.y) / 2;

          return (
            <Group key={`edge-${idx}`}>
              <Line
                points={[fromPos.x, fromPos.y, toPos.x, toPos.y]}
                stroke={isActive ? "#FFB74D" : "rgba(238, 238, 238, 0.2)"}
                strokeWidth={isActive ? 2.5 : 1.5}
              />
              
              {/* Optional weight rendering */}
              {edge.weight !== undefined && (
                <Text
                  x={midX - 10}
                  y={midY - 8}
                  text={String(edge.weight)}
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
          const pos = nodePositions[node.id];
          if (!pos) return null;

          const isActive = activeNodeId === node.id;
          const isChecking = checkingNeighbor === node.id;
          const isVisited = visited.includes(node.id);
          const isQueued = queue.includes(node.id);

          let fillColor = NODE_DEFAULT;
          let strokeColor = "rgba(0, 173, 181, 0.18)";
          let strokeWidth = 1.5;

          if (isActive) {
            fillColor = NODE_COMPARE;
            strokeColor = "#FFB74D";
            strokeWidth = 2.5;
          } else if (isChecking) {
            fillColor = "rgba(255, 183, 77, 0.5)";
            strokeColor = "#FFB74D";
          } else if (isQueued) {
            fillColor = "rgba(0, 173, 181, 0.3)";
            strokeColor = ACCENT;
          } else if (isVisited) {
            fillColor = NODE_DONE;
            strokeColor = ACCENT;
          }

          return (
            <Group
              key={node.id}
              x={pos.x}
              y={pos.y}
              draggable
              onDragMove={(e) => handleDragMove(node.id, e)}
            >
              <Circle
                x={0}
                y={0}
                radius={20}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
              />
              
              <Text
                x={-15}
                y={-6}
                width={30}
                text={node.id}
                align="center"
                fontSize={12}
                fontFamily="Sora"
                fill={TEXT_PRIMARY}
                fontStyle="bold"
              />
            </Group>
          );
        })}

        {/* Draw Frontier Queue / Stack at bottom */}
        <Group x={paddingForQueue(width, queue.length)} y={height - 75}>
          {queue.length > 0 && (
            <Text
              x={-60}
              y={10}
              text="QUEUE:"
              fontSize={11}
              fontFamily="JetBrains Mono"
              fill={ACCENT}
              fontStyle="bold"
            />
          )}

          {queue.map((nodeId, idx) => {
            const cellWidth = 32;
            const x = idx * (cellWidth + 6);
            return (
              <Group key={`queued-${idx}`}>
                <Rect
                  x={x}
                  y={0}
                  width={cellWidth}
                  height={32}
                  fill="rgba(0, 173, 181, 0.15)"
                  stroke={ACCENT}
                  strokeWidth={1}
                  cornerRadius={4}
                />
                
                <Text
                  x={x}
                  y={10}
                  width={cellWidth}
                  text={nodeId}
                  align="center"
                  fontSize={11}
                  fontFamily="JetBrains Mono"
                  fill={TEXT_PRIMARY}
                  fontStyle="bold"
                />
              </Group>
            );
          })}
        </Group>
      </Layer>
    </Stage>
  );
}

function paddingForQueue(width: number, queueLength: number): number {
  const cellWidth = 32;
  const spacing = 6;
  const totalWidth = queueLength * (cellWidth + spacing);
  return Math.max(100, (width - totalWidth) / 2);
}
