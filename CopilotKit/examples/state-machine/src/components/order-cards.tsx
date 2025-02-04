import { motion } from "motion/react";
import { Order } from "@/lib/types";
import Image from "next/image";

interface OrderCardsProps {
  orders: Order[];
}

export function OrderCards({ orders }: OrderCardsProps) {
  if (!orders.length)
    return (
      <p className="text-gray-500 text-center">
        You currently have no orders. Talk to Fio to get started.
      </p>
    );

  return (
    <div className="grid gap-4 p-4">
      {orders.map((order, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: index * 0.1 }}
        >
          <OrderCard order={order} index={index} />
        </motion.div>
      ))}
    </div>
  );
}

export function OrderCard({ order, index }: { order: Order; index: number }) {
  const wrapperStyles = "bg-white rounded-lg border-2 border-blue-300 p-4 sm:p-6";
  const imageStyles =
    "object-cover w-full max-w-[300px] mx-auto aspect-square lg:w-40 lg:h-40 rounded-lg shadow-lg hover:scale-105 transition-transform duration-300 transform-gpu";

  return (
    <div className={wrapperStyles}>
      <div className="flex flex-col xl:flex-row gap-4 xl:gap-6">
        <div className="w-full xl:w-auto">
          <Image
            width={300}
            height={300}
            src={order.car.image?.src || ""}
            alt={order.car.image?.alt || ""}
            className={imageStyles}
            style={{ imageRendering: "auto", WebkitFontSmoothing: "antialiased" }}
          />
        </div>

        <div className="flex-1">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">Order #{index + 1}</h3>
            <span className="text-sm text-gray-500">${order.car.price?.toLocaleString()}</span>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500">Vehicle</p>
                <p className="text-gray-900">
                  {order.car.year} {order.car.make} {order.car.model}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Customer</p>
                <p className="text-gray-900">{order.contactInfo.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Payment Method</p>
                {order.paymentType === "card" ? (
                  <p className="text-gray-900">Card •••• {order.cardInfo?.cardNumber?.slice(-4)}</p>
                ) : (
                  <div>
                    <p className="text-gray-900">Financing</p>
                    <p className="text-sm text-gray-500">{order.financingInfo?.loanTerm} months</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
