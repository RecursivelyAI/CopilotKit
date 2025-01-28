import { useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils/cn";
import { availableCardInfo, CardInfo } from "@/lib/types";

interface PaymentCardsProps {
  onSubmit: (cardInfo: CardInfo) => void;
}

export function PaymentCards({ onSubmit }: PaymentCardsProps) {
  const [selectedCard, setSelectedCard] = useState<string | null>(null);

  const handleCardSelect = (cardInfo: CardInfo) => {
    setSelectedCard(cardInfo.name);
    onSubmit(cardInfo);
  };

  const renderCard = (cardInfo: CardInfo, index: number) => (
    <motion.div
      key={cardInfo.name}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="flex-shrink-0"
    >
      <CreditCard
        cardInfo={cardInfo}
        onClick={() => handleCardSelect(cardInfo)}
        isAnySelected={selectedCard !== null}
      />
    </motion.div>
  );

  return (
    <div className="w-full">
      {!selectedCard && <h1 className="text-2xl font-bold mb-2">Your payment methods</h1>}
      <div className="flex flex-row overflow-x-auto gap-4 py-4 w-full min-w-0 pb-6">
        {availableCardInfo
          .filter((cardInfo) => selectedCard === null || selectedCard === cardInfo.name)
          .map(renderCard)}
      </div>
    </div>
  );
}

// Separate component for credit card display
const CreditCard = ({
  cardInfo,
  onClick,
  isAnySelected,
}: {
  cardInfo: CardInfo;
  onClick: () => void;
  isAnySelected: boolean;
}) => {
  const cardClassName = cn(
    "w-[350px] h-[200px] rounded-xl p-6 relative overflow-hidden transition-all duration-300",
    !isAnySelected
      ? "hover:transform hover:-translate-y-2 hover:shadow-xl cursor-pointer"
      : "cursor-not-allowed",
  );

  return (
    <button
      onClick={onClick}
      className={cardClassName}
      style={{
        background: "linear-gradient(135deg, #000428 0%, #004e92 100%)",
      }}
    >
      <div className="text-white space-y-4">
        {/* Card Header */}
        <div className="flex justify-between items-center">
          <div className="text-xl font-bold">{cardInfo.name}</div>
          <div className="text-2xl">💳</div>
        </div>

        {/* Card Number */}
        <div className="text-2xl tracking-wider flex justify-center w-full font-mono mt-8 mb-4">
          **** **** **** {cardInfo?.cardNumber?.slice(-4)}
        </div>

        {/* Card Footer */}
        <div className="flex justify-between items-end mt-8">
          <div>
            <div className="text-xs opacity-80">VALID THRU</div>
            <div>{cardInfo.cardExpiration}</div>
          </div>
          <div className="text-right">
            <div className="text-xs opacity-80">TYPE</div>
            <div>{cardInfo.type}</div>
          </div>
        </div>
      </div>
    </button>
  );
};
