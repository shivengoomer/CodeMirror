"use client";

import React, { useMemo } from "react";
import { Stage, Layer, Circle, Line, Rect, Text, Group } from "react-konva";

interface HeapVisualizerProps {
  state: any;
  width: number;
  height: number;
}

export default function HeapVisualizer({ state, width, height }: HeapVisualizerProps) {
  const array: number[] = state?.array || [];
  if (array.length === 0) return null;

  // Let's divide canvas width into 2 halves: Left half = Tree View, Right half = Array View
  const midX = width / 2;

  // Compute node coordinates recursively for the Heap (Binary tree layout on left half)
  const treeNodes: { id: number; val: number; x: number; y: number }[] = [];
  const treeEdges: { fromX: number; fromY: number; toX: number; toY: number }[] = [];

  function getDepth(idx: number): number {
    return Math.floor(Math.log2(idx + 1));
  }

  const maxDepth = getDepth(array.length - 1);

  function layoutHeapNode(idx: number, x: number, y: number) {
    if (idx >= array.length) return;

    treeNodes.push({ id: idx, val: array[idx], x, y });

    const leftChild = 2 * idx + 1;
    const rightChild = 2 * idx + 2;
    const depth = getDepth(idx);
    
    // Spread offset decreases as we go deeper
    const offset = (midX / 2.2) / Math.pow(2, depth + 1);
    const nextY = y + 70;

    if (leftChild < array.length) {
      const lx = x - offset;
      treeEdges.push({ fromX: x, fromY: y, toX: lx, toY: nextY });
      layoutHeapNode(leftChild, lx, nextY);
    }
    if (rightChild < array.length) {
      const rx = x + offset;
      treeEdges.push({ fromX: x, fromY: y, toX: rx, toY: nextY });
      layoutHeapNode(rightChild, rx, nextY);
    }
  }

  layoutHeapNode(0, midX / 2, 50);

  // Array view positions (Right half)
  const cellWidth = Math.max(24, Math.min(48, (midX - 60) / array.length));
  const arrayStartX = midX + 30;
  const arrayY = height / 2 - 20;

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
        {/* Max Heap Label */}
        <Text
          x={20}
          y={20}
          text="MAX HEAPIFY SYNCHRONIZATION"
          fontSize={12}
          fontFamily="Sora"
          fill={ACCENT}
          fontStyle="bold"
        />

        {/* --- LEFT HALF: Tree view --- */}
        {treeEdges.map((edge, idx) => (
          <Line
            key={`edge-${idx}`}
            points={[edge.fromX, edge.fromY, edge.toX, edge.toY]}
            stroke="rgba(238, 238, 238, 0.2)"
            strokeWidth={1.5}
          />
        ))}

        {treeNodes.map((node) => {
          const isComparing = state.comparing?.includes(node.id);
          const isSwap = state.activeSwap?.includes(node.id);

          let fillColor = NODE_DEFAULT;
          let strokeColor = "rgba(0, 173, 181, 0.18)";
          let strokeWidth = 1.5;

          if (isSwap) {
            fillColor = "rgba(255, 183, 77, 0.4)";
            strokeColor = "#FFB74D";
            strokeWidth = 2.5;
          } else if (isComparing) {
            fillColor = NODE_COMPARE;
            strokeColor = "#FFB74D";
          }

          return (
            <Group key={`tree-node-${node.id}`}>
              <Circle
                x={node.x}
                y={node.y}
                radius={18}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
              />
              <Text
                x={node.x - 15}
                y={node.y - 6}
                width={30}
                text={String(node.val)}
                align="center"
                fontSize={11}
                fontFamily="JetBrains Mono"
                fill={TEXT_PRIMARY}
                fontStyle="bold"
              />
              <Text
                x={node.x - 15}
                y={node.y + 20}
                width={30}
                text={`[${node.id}]`}
                align="center"
                fontSize={8}
                fontFamily="JetBrains Mono"
                fill="rgba(238, 238, 238, 0.35)"
              />
            </Group>
          );
        })}

        {/* Divider Line between views */}
        <Line
          points={[midX, 20, midX, height - 20]}
          stroke="rgba(0, 173, 181, 0.1)"
          strokeWidth={1}
          dash={[5, 5]}
        />

        {/* --- RIGHT HALF: Synced Array representation --- */}
        {array.map((val, idx) => {
          const x = arrayStartX + idx * cellWidth;
          const y = arrayY;

          const isComparing = state.comparing?.includes(idx);
          const isSwap = state.activeSwap?.includes(idx);

          let fillColor = NODE_DEFAULT;
          let strokeColor = "rgba(0, 173, 181, 0.18)";

          if (isSwap) {
            fillColor = "rgba(255, 183, 77, 0.4)";
            strokeColor = "#FFB74D";
          } else if (isComparing) {
            fillColor = NODE_COMPARE;
            strokeColor = "#FFB74D";
          }

          return (
            <Group key={`arr-cell-${idx}`}>
              <Rect
                x={x}
                y={y}
                width={cellWidth - 4}
                height={40}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={1.5}
                cornerRadius={4}
              />
              <Text
                x={x}
                y={y + 13}
                width={cellWidth - 4}
                text={String(val)}
                align="center"
                fontSize={12}
                fontFamily="JetBrains Mono"
                fill={TEXT_PRIMARY}
                fontStyle="bold"
              />
              <Text
                x={x}
                y={y + 46}
                width={cellWidth - 4}
                text={String(idx)}
                align="center"
                fontSize={9}
                fontFamily="JetBrains Mono"
                fill="rgba(238, 238, 238, 0.35)"
              />
            </Group>
          );
        })}
      </Layer>
    </Stage>
  );
}
