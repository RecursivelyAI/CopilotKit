import { Car, ContactInfo, CardInfo, FinancingInfo, cars, availableCardInfo } from "@/lib/types";

export type Order = {
  car: Car;
  contactInfo: ContactInfo;
  cardInfo?: CardInfo;
  financingInfo?: FinancingInfo;
  paymentType: "card" | "financing";
};

export const defaultOrders: Order[] = [
  {
    car: cars[0],
    contactInfo: {
      name: "John Doe",
      email: "john.doe@example.com",
      phone: "1234567890",
    },
    cardInfo: availableCardInfo[0],
    paymentType: "card",
  },
];
