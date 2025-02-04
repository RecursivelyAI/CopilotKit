import React from "react";
import { AnimatedCard } from "@/components/animated-card";
import { useGlobalState } from "@/lib/stages";
import { Car, CardInfo, ContactInfo, FinancingInfo, Order } from "@/lib/types";

import { RenderFunctionStatus } from "@copilotkit/react-core";

interface ConfirmOrderProps {
  onConfirm: (order: Order) => void;
  onCancel: () => void;
  status: RenderFunctionStatus;
}

export const ConfirmOrder = ({ onConfirm, onCancel, status }: ConfirmOrderProps) => {
  const { selectedCar, contactInfo, cardInfo, financingInfo } = useGlobalState();

  return (
    <AnimatedCard className="bg-white rounded-lg shadow p-6 max-w-md" status={status}>
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Order Summary</h2>

      <div className="space-y-3">
        <div className="flex justify-between items-center border-b border-blue-100 pb-2">
          <span className="font-medium">Vehicle</span>
          <span className="text-gray-600">
            {selectedCar?.year} {selectedCar?.make} {selectedCar?.model}
          </span>
        </div>

        <div className="flex justify-between items-center border-b border-blue-100 pb-2">
          <span className="font-medium">Price</span>
          <span className="text-gray-600">${selectedCar?.price?.toLocaleString()}</span>
        </div>

        <div className="flex justify-between items-center border-b border-blue-100 pb-2">
          <span className="font-medium">Customer</span>
          <span className="text-gray-600">{contactInfo?.name}</span>
        </div>

        <div className="flex justify-between items-center border-b border-blue-100 pb-2">
          <span className="font-medium">Payment</span>
          <span className="text-gray-600">
            {cardInfo?.type} ****{cardInfo?.cardNumber?.slice(-4)}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="font-medium">Financing</span>
          <span className="text-gray-600">{financingInfo?.loanTerm} months</span>
        </div>
      </div>

      {status !== "complete" && (
        <ActionButtons
          onConfirm={() =>
            onConfirm({
              car: selectedCar || ({} as Car),
              contactInfo: contactInfo || ({} as ContactInfo),
              cardInfo: cardInfo || ({} as CardInfo),
              financingInfo: financingInfo || ({} as FinancingInfo),
              paymentType: cardInfo ? "card" : "financing",
            })
          }
          onCancel={onCancel}
        />
      )}
    </AnimatedCard>
  );
};

const ActionButtons = ({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) => (
  <div className="flex justify-end gap-4 mt-6">
    <button
      onClick={onCancel}
      className="px-6 py-2.5 w-full text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors duration-200 font-medium"
    >
      Cancel
    </button>
    <button
      onClick={onConfirm}
      className="px-6 py-2.5 w-full text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium"
    >
      Confirm Order
    </button>
  </div>
);
