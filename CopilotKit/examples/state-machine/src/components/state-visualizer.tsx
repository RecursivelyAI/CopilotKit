import ReactFlow, { Node, Edge, Position, MarkerType } from "reactflow";
import "reactflow/dist/style.css";
import { useGlobalState } from "@/lib/stages";
import { useMemo } from "react";

export function StateVisualizer() {
  const { stage } = useGlobalState();

  const activeNodeStyles = "ring-4 ring-blue-500 animate-pulse";
  const inactiveNodeStyles = "border border-gray-200";

  const nodes: Node[] = useMemo(
    () => [
      {
        id: "getContactInfo",
        data: { label: "Contact Info" },
        position: { x: 250, y: 0 },
        className: stage === "getContactInfo" ? activeNodeStyles : inactiveNodeStyles,
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      },
      {
        id: "buildCar",
        data: { label: "Build Car" },
        position: { x: 250, y: 100 },
        className: stage === "buildCar" ? activeNodeStyles : inactiveNodeStyles,
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      },
      {
        id: "sellFinancing",
        data: { label: "Sell Financing" },
        position: { x: 250, y: 200 },
        className: stage === "sellFinancing" ? activeNodeStyles : inactiveNodeStyles,
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      },
      {
        id: "getPaymentInfo",
        data: { label: "Payment Info" },
        position: { x: 150, y: 300 },
        className: stage === "getPaymentInfo" ? activeNodeStyles : inactiveNodeStyles,
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      },
      {
        id: "getFinancingInfo",
        data: { label: "Financing Info" },
        position: { x: 350, y: 300 },
        className: stage === "getFinancingInfo" ? activeNodeStyles : inactiveNodeStyles,
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      },
      {
        id: "confirmOrder",
        data: { label: "Confirm Order" },
        position: { x: 250, y: 400 },
        className: stage === "confirmOrder" ? activeNodeStyles : inactiveNodeStyles,
        targetPosition: Position.Top,
      },
    ],
    [stage],
  );

  const activeEdgeStyles = "stroke-blue-500 stroke-2";
  const inactiveEdgeStyles = "stroke-gray-200 stroke-1";

  const edges: Edge[] = [
    {
      id: "getContactInfo-buildCar",
      source: "getContactInfo",
      target: "buildCar",
      markerEnd: { type: MarkerType.Arrow },
      className: stage === "getContactInfo" ? activeEdgeStyles : inactiveEdgeStyles,
    },
    {
      id: "buildCar-sellFinancing",
      source: "buildCar",
      target: "sellFinancing",
      markerEnd: { type: MarkerType.Arrow },
      className: stage === "buildCar" ? activeEdgeStyles : inactiveEdgeStyles,
    },
    {
      id: "sellFinancing-getPaymentInfo",
      source: "sellFinancing",
      target: "getPaymentInfo",
      markerEnd: { type: MarkerType.Arrow },
      type: "smoothstep",
      className: stage === "sellFinancing" ? activeEdgeStyles : inactiveEdgeStyles,
    },
    {
      id: "sellFinancing-getFinancingInfo",
      source: "sellFinancing",
      target: "getFinancingInfo",
      markerEnd: { type: MarkerType.Arrow },
      type: "smoothstep",
      className: stage === "sellFinancing" ? activeEdgeStyles : inactiveEdgeStyles,
    },
    {
      id: "getPaymentInfo-confirmOrder",
      source: "getPaymentInfo",
      target: "confirmOrder",
      markerEnd: { type: MarkerType.Arrow },
      className: stage === "getPaymentInfo" ? activeEdgeStyles : inactiveEdgeStyles,
      type: "smoothstep",
    },
    {
      id: "getFinancingInfo-confirmOrder",
      source: "getFinancingInfo",
      target: "confirmOrder",
      markerEnd: { type: MarkerType.Arrow },
      className: stage === "getFinancingInfo" ? activeEdgeStyles : inactiveEdgeStyles,
      type: "smoothstep",
    },
  ];

  return (
    <div className="h-full w-full border rounded-lg">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        draggable={false}
        nodesDraggable={false}
        nodesConnectable={false}
        preventScrolling={true}
        panOnDrag={false}
      />
    </div>
  );
}
