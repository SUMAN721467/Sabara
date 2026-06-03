export interface OrderItem {
  productId: string;
  productName: string;
  productImage: string;
  qty: number;
  price: number;
}

export interface ShippingAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  date: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: OrderItem[];
  total: number;
  status: "Pending" | "Shipped" | "Delivered" | "Cancelled" | "Cancelled by Seller";
  shippingAddress: ShippingAddress;
  cancellationReason?: string;
  customerStatus?: "Pending" | "Cancelled by Customer";
  sellerInstruction?: string;
}

// In-memory store for orders with high-quality seed data
export let ordersState: Order[] = [
  {
    id: "ord-1",
    orderNumber: "LW-2026-9812",
    date: "2026-05-22T14:32:00Z",
    customerName: "Alex Mercer",
    customerEmail: "alex.mercer@example.com",
    customerPhone: "+1 (555) 234-5678",
    items: [
      {
        productId: "1",
        productName: "The Belgian Waffle Knit Throw",
        productImage: "https://images.unsplash.com/photo-1580301762395-21ce84d00bc6?q=80&w=800",
        qty: 1,
        price: 185
      },
      {
        productId: "3",
        productName: "Elysian Merino Wool Blanket",
        productImage: "https://images.unsplash.com/photo-1543294001-f7cbfe92237e?q=80&w=800",
        qty: 1,
        price: 320
      }
    ],
    total: 505,
    status: "Pending",
    shippingAddress: {
      street: "42 Wallaby Way",
      city: "Sydney",
      state: "NSW",
      zipCode: "2000"
    }
  },
  {
    id: "ord-2",
    orderNumber: "LW-2026-9813",
    date: "2026-05-21T09:15:00Z",
    customerName: "Suman Mondal",
    customerEmail: "suman.customer@example.com",
    customerPhone: "+91 98765 43210",
    items: [
      {
        productId: "2",
        productName: "Heritage Flax Linen Set",
        productImage: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?q=80&w=800",
        qty: 1,
        price: 260
      }
    ],
    total: 260,
    status: "Shipped",
    shippingAddress: {
      street: "12 Riverside Drive",
      city: "Kolkata",
      state: "West Bengal",
      zipCode: "700001"
    }
  },
  {
    id: "ord-3",
    orderNumber: "LW-2026-9814",
    date: "2026-05-20T18:45:00Z",
    customerName: "Sophia Loren",
    customerEmail: "sophia.loren@example.com",
    customerPhone: "+33 6 1234 5678",
    items: [
      {
        productId: "4",
        productName: "Classic Oxford Cotton Sheets",
        productImage: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?q=80&w=800",
        qty: 2,
        price: 145
      }
    ],
    total: 290,
    status: "Delivered",
    shippingAddress: {
      street: "7 Avenue des Champs-Élysées",
      city: "Paris",
      state: "Île-de-France",
      zipCode: "75008"
    }
  },
  {
    id: "ord-4",
    orderNumber: "LW-2026-9815",
    date: "2026-05-19T11:20:00Z",
    customerName: "Kenji Sato",
    customerEmail: "kenji.sato@example.com",
    customerPhone: "+81 90 1234 5678",
    items: [
      {
        productId: "5",
        productName: "Thermal Ribbed Cotton Quilt",
        productImage: "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?q=80&w=800",
        qty: 1,
        price: 210
      }
    ],
    total: 210,
    status: "Delivered",
    shippingAddress: {
      street: "3-chome-1-1 Shibakoen",
      city: "Minato-ku",
      state: "Tokyo",
      zipCode: "105-0011"
    }
  }
];

export function addOrder(order: Omit<Order, "id" | "orderNumber" | "date" | "status">): Order {
  const newOrder: Order = {
    ...order,
    id: `ord-${Math.random().toString(36).substring(7)}`,
    orderNumber: `LW-2026-${Math.floor(1000 + Math.random() * 9000)}`,
    date: new Date().toISOString(),
    status: "Pending"
  };
  ordersState = [newOrder, ...ordersState];
  return newOrder;
}

export function updateOrderStatus(id: string, status: Order["status"]): boolean {
  let found = false;
  ordersState = ordersState.map((o) => {
    if (o.id === id) {
      found = true;
      return { ...o, status };
    }
    return o;
  });
  return found;
}
