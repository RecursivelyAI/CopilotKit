export type Car = {
  id?: number;
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  price?: number;
  image?: {
    src: string;
    alt: string;
    author: string;
  };
};

export const cars: Car[] = [
  {
    id: 1,
    make: "Hyundai",
    model: "Kona",
    year: 2025,
    color: "Green",
    price: 25000,
    image: {
      src: "/images/hyundai-kona.jpg",
      alt: "Hyundai Kona",
      author: "Hyundai Motor Group",
    },
  },
  {
    id: 2,
    make: "Kia",
    model: "Tasman",
    year: 2025,
    color: "Green",
    price: 20000,
    image: {
      src: "/images/kia-tasman.jpg",
      alt: "Kia Tasman",
      author: "Hyundai Motor Group",
    },
  },
  {
    id: 3,
    make: "Kia",
    model: "EV6",
    year: 2025,
    color: "Gray",
    price: 22000,
    image: {
      src: "/images/kia-ev6.jpg",
      alt: "Kia EV6",
      author: "Hyundai Motor Group",
    },
  },
  {
    id: 4,
    make: "Kia",
    model: "EV9",
    year: 2025,
    color: "Blue",
    price: 18000,
    image: {
      src: "/images/kia-ev9.jpg",
      alt: "Kia EV9",
      author: "Hyundai Motor Group",
    },
  },
  {
    id: 5,
    make: "Hyundai",
    model: "Santa Fe",
    year: 2025,
    color: "Green",
    price: 15000,
    image: {
      src: "/images/hyundai-santa-fe.jpg",
      alt: "Hyundai Santa Fe",
      author: "Hyundai Motor Group",
    },
  },
  {
    id: 6,
    make: "Hyundai",
    model: "Santa Fe",
    year: 2025,
    color: "Brown",
    price: 27000,
    image: {
      src: "/images/hyundai-santa-fe-brown.jpg",
      alt: "Hyundai Santa Fe",
      author: "Hyundai Motor Group",
    },
  },
  {
    id: 7,
    make: "Hyundai",
    model: "Santa Fe",
    year: 2025,
    color: "Orange",
    price: 25000,
    image: {
      src: "/images/hyundai-santa-fe-orange.jpg",
      alt: "Hyundai Santa Fe",
      author: "Hyundai Motor Group",
    },
  },
];
