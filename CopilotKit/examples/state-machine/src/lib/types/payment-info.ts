export type CardInfo = {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  cardNumber: string;
  cardExpiration: string;
  cardCvv: string;
  type: string;
};

export const availableCardInfo: CardInfo[] = [
  {
    name: "John Doe",
    email: "john.doe@example.com",
    phone: "1234567890",
    address: "123 Main St, Anytown, USA",
    city: "Anytown",
    state: "CA",
    zip: "12345",
    cardNumber: "1234-5678-9012-3456",
    cardExpiration: "12/24",
    cardCvv: "123",
    type: "Visa",
  },
  {
    name: "Jane Doe",
    email: "jane.doe@example.com",
    phone: "0987654321",
    address: "456 Main St, Anytown, USA",
    city: "Anytown",
    state: "CA",
    zip: "12345",
    cardNumber: "1234-5678-9012-3456",
    cardExpiration: "12/24",
    cardCvv: "123",
    type: "Mastercard",
  },
  {
    name: "John Smith",
    email: "john.smith@example.com",
    phone: "1122334455",
    address: "789 Main St, Anytown, USA",
    city: "Anytown",
    state: "CA",
    zip: "12345",
    cardNumber: "1234-5678-9012-3456",
    cardExpiration: "12/24",
    cardCvv: "123",
    type: "Visa",
  },
];
