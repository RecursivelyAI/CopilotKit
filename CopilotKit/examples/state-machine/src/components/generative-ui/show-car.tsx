import { cn } from "@/lib/utils/cn";
import { Car } from "@/lib/types";
import { AnimatedCard } from "@/components/animated-card";
import { motion } from "motion/react";
import { useState } from "react";
import Image from "next/image";

import { RenderFunctionStatus } from "@copilotkit/react-core";

interface ShowCarProps {
  car: Car;
  onSelect: () => void;
  onReject?: () => void;
  status: RenderFunctionStatus;
  className?: string;
}

const ColorDisplay = ({ color }: { color?: string }) => {
  if (!color) return null;

  return (
    <span className="flex items-center gap-2">
      <span
        className="w-5 h-5 rounded-full border border-gray-200 shadow-sm"
        style={{ backgroundColor: color }}
      />
      <span className="text-gray-600 text-sm">{color}</span>
    </span>
  );
};

const CarImage = ({ car }: { car: Car }) => {
  return (
    <div className="relative aspect-[3/3] w-full overflow-hidden h-[250px]">
      <Image
        width={300}
        height={250}
        src={car?.image?.src || ""}
        alt={car?.image?.alt || ""}
        className="object-cover w-full h-full hover:scale-105 transition-transform duration-300 transform-gpu"
        style={{
          imageRendering: "auto",
          WebkitFontSmoothing: "antialiased",
        }}
      />
    </div>
  );
};

export function ShowCar({ car, onSelect, onReject, status, className }: ShowCarProps) {
  const carDetails = [
    { label: "Make", value: car.make },
    { label: "Model", value: car.model },
    { label: "Year", value: car.year },
    { label: "Color", value: <ColorDisplay color={car.color} /> },
    { label: "Price", value: `$${car.price?.toLocaleString()}`, bold: true },
  ];

  const cardStyles = cn(
    "min-w-[300px] max-w-sm bg-white rounded-xl overflow-hidden p-0 gap-0",
    className,
  );
  const informationWrapperStyles = cn("space-y-6 pt-4 pb-4");
  const acceptButtonStyles = cn(
    "flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md",
  );
  const rejectButtonStyles = cn(
    "flex-1 bg-gray-50 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-100 transition-all duration-200",
  );

  return (
    <AnimatedCard status={status} className={cardStyles}>
      <CarImage car={car} />

      <div className={informationWrapperStyles}>
        <div className="space-y-2 px-6">
          <div className="text-2xl font-semibold text-gray-900">
            {car.year} {car.make} {car.model}
          </div>
          {carDetails.map(({ label, value, bold }) => (
            <div key={label} className="flex justify-between items-center py-1">
              <span className="text-gray-500 text-sm">{label}</span>
              <span className={cn("text-gray-900", bold ? "font-semibold text-lg" : "text-sm")}>
                {value}
              </span>
            </div>
          ))}
        </div>

        <div className={cn("px-6 pt-2", status === "complete" ? "hidden" : "animate-fade-in")}>
          <hr className="mb-4 border-gray-100" />
          <div className="flex gap-3">
            {onReject && (
              <button className={rejectButtonStyles} onClick={onReject}>
                Other options
              </button>
            )}
            <button className={acceptButtonStyles} onClick={onSelect}>
              Select
            </button>
          </div>
        </div>
      </div>
    </AnimatedCard>
  );
}

interface ShowCarsProps {
  cars: Car[];
  onSelect: (car: Car) => void;
  status: RenderFunctionStatus;
}

export function ShowCars({ cars, onSelect, status }: ShowCarsProps) {
  const [selectedCar, setSelectedCar] = useState<Car | null>(null);

  const handleSelect = (car: Car) => {
    setSelectedCar(car);
    onSelect(car);
  };

  return (
    <div className="flex flex-row overflow-x-auto gap-4 py-4 space-x-6">
      {cars.map((car, index) => {
        // Don't render if there's a selected car and this isn't it
        if (selectedCar && car !== selectedCar) return null;

        return (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.2 }}
          >
            <ShowCar car={car} onSelect={() => handleSelect(car)} status={status} />
          </motion.div>
        );
      })}
    </div>
  );
}
